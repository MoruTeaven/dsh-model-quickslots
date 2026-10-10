/**
 * Integration harness: replays the DSH slot-renderer semantics that made the
 * dock entry disappear, against this plugin's real apply().
 *
 * The renderer retires ("abdicates") a crashed list-slot entry with no recovery
 * path, so a single throw from the entry's inject factory — which is what a
 * cold-boot scope race or a plugin reload produced — removed the row until the
 * plugin was toggled off and on. These scenarios pin both the old failure mode
 * and the recovery paths that replace it.
 */
import assert from "node:assert";
import fs from "node:fs";

// ── Minimal reimplementation of the renderer semantics we depend on ──
const ABDICATE_ON_CRASH = (kind) => kind !== "chain";

function makeSlotCore() {
  const records = new Map();
  const abdicated = new WeakSet();
  const entryErrors = new Set();
  return {
    declared(name, kind) { records.set(name, { spec: { name, kind }, entries: [] }); },
    register(options, component) {
      const rec = records.get(options.name);
      if (!rec?.spec) throw new Error(`slot "${options.name}" is not declared`);
      const entry = { options, component };
      rec.entries = [...rec.entries, entry];
      return () => { rec.entries = rec.entries.filter((e) => e !== entry); };
    },
    entries: (name) => records.get(name)?.entries ?? [],
    /** Winners: live (non-abdicated) entries, one per id cell. */
    entriesOfSlot(name) {
      const rec = records.get(name);
      if (!rec?.spec) return [];
      const seen = new Set();
      const heads = [];
      for (const e of rec.entries) {
        if (abdicated.has(e)) continue;
        if (seen.has(e.options.id)) continue;
        seen.add(e.options.id);
        heads.push(e);
      }
      return heads;
    },
    reportEntryError(name, entry, error, info) {
      if (info.abdicate) {
        if (abdicated.has(entry)) return;
        abdicated.add(entry);
      }
      for (const fn of [...entryErrors]) fn(name, entry, error, { abdicated: info.abdicate });
    },
    onEntryError(fn) { entryErrors.add(fn); return () => entryErrors.delete(fn); },
    isAbdicated: (e) => abdicated.has(e),
  };
}

/** Replays one render pass of the list outlet. */
function renderDock(core, slotKey, sessionId) {
  const out = [];
  for (const entry of core.entriesOfSlot(slotKey)) {
    try {
      const props = entry.options.inject ? entry.options.inject(sessionId) : {};
      entry.component(props);
      out.push({ id: entry.options.id, ok: true, props });
    } catch (error) {
      core.reportEntryError(slotKey, entry, error, { abdicate: ABDICATE_ON_CRASH("list") });
      out.push({ id: entry.options.id, ok: false, error: String(error && error.message) });
    }
  }
  return out;
}

/** Let queued revives (macrotask timers) run. */
const settle = async (ms = 5) => { await new Promise((r) => setTimeout(r, ms)); };

function makeCtx({ directoryFor, subagentAddress }) {
  const core = makeSlotCore();
  core.declared("conversation.input.dock", "list");
  const ctx = {
    sessions: { subagentAddress },
    modelDirectories: { directoryFor },
    slots: {
      register: (o, c) => core.register(o, c),
      inject: (key, cb) => cb(),
      onEntryError: (fn) => core.onEntryError(fn),
    },
  };
  return { ctx, core };
}

function makeDirectory(overrides = {}) {
  return {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
    ...overrides,
  };
}

// ── Load the plugin's real client bundle through the real registration path ──
const bundleSource = fs.readFileSync("lib/client.js", "utf8");
let capturedId = null;
let capturedFactory = null;
const moduleLoader = { load({ id, factory }) { capturedId = id; capturedFactory = factory; } };
const fakeDocument = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: "", setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
};
// Evaluate the bundle exactly as the browser does: it self-registers.
new Function("window", "document", bundleSource)({ __ModuleLoader__: moduleLoader }, fakeDocument);

assert.strictEqual(capturedId, "@moruteaven/dsh-model-quickslots", "bundle registers its package id");
assert.strictEqual(typeof capturedFactory, "function", "bundle registers a factory");

const reactShim = {
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useCallback: (f) => f,
  createElement: () => null,
};
const jsxShim = { jsx: () => null, jsxs: () => null, Fragment: null };
const pluginExports = capturedFactory((specifier) => {
  if (specifier === "react") return reactShim;
  if (specifier === "react/jsx-runtime") return jsxShim;
  throw new Error("unexpected require: " + specifier);
});

assert.strictEqual(typeof pluginExports.apply, "function", "apply exported");
assert.deepStrictEqual(pluginExports.inject, ["sessions", "slots", "modelDirectories"], "inject list");

const SLOT = "conversation.input.dock";
const SESSION = "s1";

// ── Scenario A: cold boot with a healthy directory renders the row ──
{
  const { ctx, core } = makeCtx({ directoryFor: () => makeDirectory(), subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const rendered = renderDock(core, SLOT, SESSION);
  assert.strictEqual(rendered.length, 1, "one dock entry");
  assert.strictEqual(rendered[0].id, "model-quickslots");
  assert.strictEqual(rendered[0].ok, true, "healthy boot renders");
  assert.strictEqual(rendered[0].props.available, true, "available");
}

// ── Scenario B: the OLD failure mode, reproduced verbatim ──
// A raw entry whose inject() throws is abdicated and never renders again, even
// after the directory becomes resolvable. This is the reported symptom.
{
  const core = makeSlotCore();
  core.declared(SLOT, "list");
  let ready = false;
  core.register(
    {
      name: SLOT,
      id: "model-quickslots",
      order: 0,
      inject: () => {
        if (!ready) throw new Error('ui-model-selection: session "s" resolved no scope');
        return { available: true };
      },
    },
    () => {},
  );
  let rendered = renderDock(core, SLOT, SESSION);
  assert.strictEqual(rendered[0].ok, false, "cold-boot throw crashes the entry");
  assert.strictEqual(core.isAbdicated(core.entries(SLOT)[0]), true, "list crash abdicates");
  ready = true;
  rendered = renderDock(core, SLOT, SESSION);
  assert.strictEqual(rendered.length, 0, "abdicated entry never renders again — permanent loss");
}

// ── Scenario C: a cold-boot scope race degrades, then heals ──
{
  globalThis.__DSH_MQS_TIMING__ = { stableWindowMs: 20, crashDelayMs: 0, unresolvedDelayMs: 0 };
  try {
    let ready = false;
    const { ctx, core } = makeCtx({
      directoryFor: () => {
        if (!ready) throw new Error("session resolved no scope");
        return makeDirectory();
      },
      subagentAddress: () => undefined,
    });
    pluginExports.apply(ctx);

    let rendered = renderDock(core, SLOT, SESSION);
    assert.strictEqual(rendered[0].ok, true, "no crash while the directory is unavailable");
    assert.strictEqual(rendered[0].props.available, false, "degraded to inert");
    assert.strictEqual(core.isAbdicated(core.entries(SLOT)[0]), false, "entry survives");

    // The scope arrives shortly after boot.
    ready = true;
    await settle(10);
    rendered = renderDock(core, SLOT, SESSION);
    assert.strictEqual(rendered[0].ok, true, "still renders");
    assert.strictEqual(rendered[0].props.available, true, "recovers once the directory resolves");
  } finally {
    delete globalThis.__DSH_MQS_TIMING__;
  }
}

// ── Scenario D: a crashed entry is revived by the safety net ──
{
  globalThis.__DSH_MQS_TIMING__ = { stableWindowMs: 20, crashDelayMs: 0, unresolvedDelayMs: 0 };
  try {
    const { ctx, core } = makeCtx({ directoryFor: () => makeDirectory(), subagentAddress: () => undefined });
    pluginExports.apply(ctx);
    const live = core.entriesOfSlot(SLOT)[0];
    core.reportEntryError(SLOT, live, new Error("component exploded"), { abdicate: true });
    assert.strictEqual(core.entriesOfSlot(SLOT).length, 0, "abdicated ⇒ no winner");
    await settle(10);
    const revived = core.entriesOfSlot(SLOT);
    assert.strictEqual(revived.length, 1, "safety net re-registered the entry");
    assert.strictEqual(revived[0].options.id, "model-quickslots");
    const rendered = renderDock(core, SLOT, SESSION);
    assert.strictEqual(rendered[0].ok, true, "revived entry renders");
  } finally {
    delete globalThis.__DSH_MQS_TIMING__;
  }
}

// ── Scenario E: a dense crash loop is bounded, not infinite ──
{
  globalThis.__DSH_MQS_TIMING__ = { stableWindowMs: 10_000, crashDelayMs: 0, unresolvedDelayMs: 0 };
  try {
    const { ctx, core } = makeCtx({ directoryFor: () => makeDirectory(), subagentAddress: () => undefined });
    pluginExports.apply(ctx);
    for (let i = 0; i < 10; i++) {
      const live = core.entriesOfSlot(SLOT)[0];
      if (!live) break;
      core.reportEntryError(SLOT, live, new Error("flap " + i), { abdicate: true });
      await settle(3);
    }
    assert.strictEqual(core.entriesOfSlot(SLOT).length, 0, "budget is spent, loop stops");
    assert.ok(core.entries(SLOT).length <= 4, "revives bounded: " + core.entries(SLOT).length);
  } finally {
    delete globalThis.__DSH_MQS_TIMING__;
  }
}

// ── Scenario F: the revive budget is per stable window, not cumulative ──
// Five isolated crashes, each separated by more than the stable window, must all
// heal on the SAME instance. A cumulative budget of three would stop after the
// third — which is exactly the "occasionally disappears forever" symptom.
{
  globalThis.__DSH_MQS_TIMING__ = { stableWindowMs: 15, crashDelayMs: 0, unresolvedDelayMs: 0 };
  try {
    const { ctx, core } = makeCtx({ directoryFor: () => makeDirectory(), subagentAddress: () => undefined });
    pluginExports.apply(ctx);

    for (let i = 1; i <= 5; i++) {
      await settle(30); // outlive the stable window so the budget refills
      const live = core.entriesOfSlot(SLOT)[0];
      assert.ok(live, `crash #${i}: an entry is present before the crash`);
      core.reportEntryError(SLOT, live, new Error("isolated crash " + i), { abdicate: true });
      await settle(5);
      assert.strictEqual(
        core.entriesOfSlot(SLOT).length,
        1,
        `crash #${i}: healed even though the cumulative count exceeds the budget`,
      );
    }
    const rendered = renderDock(core, SLOT, SESSION);
    assert.strictEqual(rendered[0].ok, true, "still rendering after five isolated crashes");
    assert.strictEqual(rendered[0].props.available, true, "and still functional");
  } finally {
    delete globalThis.__DSH_MQS_TIMING__;
  }
}

// ── Scenario G: a store that throws cannot crash the entry ──
{
  const hostile = makeDirectory({
    store: { subscribe: () => () => {}, getSnapshot: () => { throw new Error("snapshot boom"); } },
  });
  const { ctx, core } = makeCtx({ directoryFor: () => hostile, subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const rendered = renderDock(core, SLOT, SESSION);
  assert.strictEqual(rendered[0].ok, true, "hostile store does not crash the entry");
  assert.deepStrictEqual(
    rendered[0].props.directoryStore.getSnapshot(),
    { groups: [], current: null, status: "unavailable" },
  );
}

// ── Scenario H: a synchronous load() failure cannot crash the entry ──
{
  const broken = makeDirectory({ load: () => { throw new Error("sync load failed"); } });
  const { ctx, core } = makeCtx({ directoryFor: () => broken, subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const rendered = renderDock(core, SLOT, SESSION);
  assert.strictEqual(rendered[0].ok, true, "entry renders");
  rendered[0].props.loadDirectory(); // must not throw
}

console.log("integration harness passed — 8 scenarios OK");
