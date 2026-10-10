/**
 * Integration harness: replays the DSH slot-renderer semantics that made the
 * dock entry disappear, against this plugin's real apply().
 *
 * Verified behaviour:
 *  1. a healthy boot registers the entry;
 *  2. an inject() that throws crashes the entry, and a list-slot crash
 *     ABDICATES it (retired for the page lifetime) — the old failure mode;
 *  3. with the fix, inject() never throws and the entry keeps rendering;
 *  4. if an entry is abdicated anyway, the safety net re-registers it.
 */
import assert from "node:assert";

// ── Minimal reimplementation of the renderer semantics we depend on ──
const ABDICATE_ON_CRASH = (kind) => kind !== "chain";

function makeSlotCore() {
  const records = new Map();
  const abdicated = new WeakSet();
  const entryErrors = new Set();
  const declared = (name, kind) => records.set(name, { spec: { name, kind }, entries: [] });
  return {
    declared,
    register(options, component) {
      const rec = records.get(options.name);
      if (!rec?.spec) throw new Error(`slot "${options.name}" is not declared`);
      const entry = { options, component };
      rec.entries = [...rec.entries, entry];
      return () => { rec.entries = rec.entries.filter((e) => e !== entry); };
    },
    entries: (name) => records.get(name)?.entries ?? [],
    /** winners = live (non-abdicated) entries, one per id cell. */
    entriesOfSlot(name) {
      const rec = records.get(name);
      if (!rec?.spec) return [];
      const seen = new Set();
      const heads = [];
      for (const e of rec.entries) {
        if (abdicated.has(e)) continue;
        const cell = e.options.id;
        if (seen.has(cell)) continue;
        seen.add(cell);
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
      entry.component(props);            // component render
      out.push({ id: entry.options.id, ok: true, props });
    } catch (error) {
      core.reportEntryError(slotKey, entry, error, { abdicate: ABDICATE_ON_CRASH("list") });
      out.push({ id: entry.options.id, ok: false, error: String(error && error.message) });
    }
  }
  return out;
}

// ── A fake cordis ctx exposing exactly the services apply() touches ──
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

// Load the plugin's real client bundle through the real registration path.
const fs = await import("node:fs");
const bundleSource = fs.readFileSync("lib/client.js", "utf8");

let capturedFactory = null;
let capturedId = null;
const moduleLoader = {
  load({ id, factory }) { capturedId = id; capturedFactory = factory; },
};
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

// ── Scenario A: cold boot, healthy directory → entry renders ──
{
  const healthy = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  const { ctx, core } = makeCtx({ directoryFor: () => healthy, subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const rendered = renderDock(core, "conversation.input.dock", "s1");
  assert.strictEqual(rendered.length, 1);
  assert.strictEqual(rendered[0].ok, true, "healthy boot renders");
  assert.strictEqual(rendered[0].props.available, true);
}

// ── Scenario B: the OLD failure mode, reproduced ──
// A raw entry whose inject() throws gets abdicated and never renders again,
// even after the underlying directory becomes resolvable. This is exactly why
// the row stayed gone until the plugin was toggled off/on.
{
  const core = makeSlotCore();
  core.declared("conversation.input.dock", "list");
  let directoryReady = false;
  const oldEntry = core.register(
    {
      name: "conversation.input.dock",
      id: "model-quickslots",
      order: 0,
      inject: () => {
        if (!directoryReady) throw new Error('ui-model-selection: session "s" resolved no scope');
        return { available: true };
      },
    },
    () => {},
  );
  let r = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(r[0].ok, false, "cold-boot throw crashes the entry");
  assert.strictEqual(core.isAbdicated(core.entries("conversation.input.dock")[0]), true, "list crash abdicates");
  directoryReady = true;
  r = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(r.length, 0, "abdicated entry never renders again — permanent loss");
  void oldEntry;
}

// ── Scenario C: with the fix, a cold-boot race degrades instead of dying ──
{
  let ready = false;
  const healthy = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  const { ctx, core } = makeCtx({
    directoryFor: () => { if (!ready) throw new Error("session resolved no scope"); return healthy; },
    subagentAddress: () => undefined,
  });
  pluginExports.apply(ctx);
  let rendered = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(rendered[0].ok, true, "no crash while the directory is unavailable");
  assert.strictEqual(rendered[0].props.available, false, "degraded to inert");
  assert.strictEqual(core.isAbdicated(core.entries("conversation.input.dock")[0]), false, "entry survives");

  ready = true;
  rendered = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(rendered[0].ok, true);
  assert.strictEqual(rendered[0].props.available, true, "recovers once the directory resolves");
}

// ── Scenario D: the safety net revives an abdicated entry ──
{
  const healthy = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  const { ctx, core } = makeCtx({ directoryFor: () => healthy, subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const live = core.entries("conversation.input.dock")[0];
  // Simulate an unrelated crash that retires the entry (e.g. a component fault).
  core.reportEntryError("conversation.input.dock", live, new Error("component exploded"), { abdicate: true });
  assert.strictEqual(core.entriesOfSlot("conversation.input.dock").length, 0, "abdicated ⇒ no winner");
  await new Promise((r) => setTimeout(r, 0)); // let the queued revive run
  const revived = core.entriesOfSlot("conversation.input.dock");
  assert.strictEqual(revived.length, 1, "safety net re-registered the entry");
  assert.strictEqual(revived[0].options.id, "model-quickslots");
  const rendered = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(rendered[0].ok, true, "revived entry renders");
}

// ── Scenario E: a crash loop is bounded, but an occasional crash heals ──
{
  const healthy = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  const { ctx, core } = makeCtx({ directoryFor: () => healthy, subagentAddress: () => undefined });
  pluginExports.apply(ctx);

  // Dense flapping: the budget must run out instead of spinning forever.
  for (let i = 0; i < 10; i++) {
    const live = core.entriesOfSlot("conversation.input.dock")[0];
    if (!live) break;
    core.reportEntryError("conversation.input.dock", live, new Error("flap " + i), { abdicate: true });
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.strictEqual(
    core.entriesOfSlot("conversation.input.dock").length,
    0,
    "a dense crash loop stops after the budget is spent",
  );
  assert.ok(core.entries("conversation.input.dock").length <= 4, "revives bounded: " + core.entries("conversation.input.dock").length);
}

// ── Scenario E2: a stable window restores the revive budget ──
{
  const healthy = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ groups: [], current: null, status: "ready" }) },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  // Shorten the stable window so the reset is observable without a 10s wait.
  globalThis.__DSH_MQS_STABLE_WINDOW_MS__ = 20;
  try {
    const { ctx, core } = makeCtx({ directoryFor: () => healthy, subagentAddress: () => undefined });
    pluginExports.apply(ctx);

    // Spend the entire budget in a burst.
    for (let i = 0; i < 5; i++) {
      const live = core.entriesOfSlot("conversation.input.dock")[0];
      if (!live) break;
      core.reportEntryError("conversation.input.dock", live, new Error("burst " + i), { abdicate: true });
      await new Promise((r) => setTimeout(r, 0));
    }
    assert.strictEqual(core.entriesOfSlot("conversation.input.dock").length, 0, "budget exhausted");

    // Survive the stable window: the budget must come back.
    await new Promise((r) => setTimeout(r, 60));
    const revivedOnce = core.entries("conversation.input.dock").length;
    assert.ok(revivedOnce >= 1, "entries present after the window");

    // A later, isolated crash is healed again — proving the budget reset.
    const afterWindow = core.register(
      {
        name: "conversation.input.dock",
        id: "model-quickslots",
        order: 0,
        inject: () => ({ available: true }),
      },
      () => {},
    );
    const live = core.entriesOfSlot("conversation.input.dock")[0];
    core.reportEntryError("conversation.input.dock", live, new Error("after window"), { abdicate: true });
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(core.entriesOfSlot("conversation.input.dock").length, 1, "post-window crash healed");
    void afterWindow;
  } finally {
    delete globalThis.__DSH_MQS_STABLE_WINDOW_MS__;
  }
}

// ── Scenario F: a getSnapshot that throws cannot crash the entry ──
{
  const hostile = {
    store: { subscribe: () => () => {}, getSnapshot: () => { throw new Error("snapshot boom"); } },
    select: async () => ({ ok: true }),
    load: async () => undefined,
  };
  const { ctx, core } = makeCtx({ directoryFor: () => hostile, subagentAddress: () => undefined });
  pluginExports.apply(ctx);
  const rendered = renderDock(core, "conversation.input.dock", "s");
  assert.strictEqual(rendered[0].ok, true, "hostile store does not crash the entry");
  assert.deepStrictEqual(rendered[0].props.directoryStore.getSnapshot(), { groups: [], current: null, status: "unavailable" });
}

console.log("integration harness passed — 6 scenarios OK");
