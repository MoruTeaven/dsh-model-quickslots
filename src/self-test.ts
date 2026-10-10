import assert from "node:assert";
import { loadPresets, savePresets, genId } from "./storage";
import { buildEntryProps, safeStore, EMPTY_STORE, EMPTY_SNAPSHOT } from "./session-props";
import type { Preset, DirectoryStore } from "./types";

// Mock localStorage for Node
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

// Test 1: round-trip preserves data
const presets: Preset[] = [
  { id: genId(), label: "快速", provider: "deepseek-official", model: "deepseek-chat" },
  { id: genId(), label: "推理", provider: "deepseek-official", model: "deepseek-reasoner", reasoningEffort: "high" },
  { id: genId(), label: "默认", provider: "deepseek-account", model: "deepseek-chat" },
];
savePresets(presets);
const loaded = loadPresets();
assert.strictEqual(loaded.length, 3);
assert.deepStrictEqual(loaded, presets);

// Test 2: empty array
savePresets([]);
assert.strictEqual(loadPresets().length, 0);

// Test 3: corrupted JSON returns []
store.set("dsh-model-quickslots:presets", "{bad json");
assert.deepStrictEqual(loadPresets(), []);

// Test 4: genId uniqueness (77 iterations)
const ids = new Set<string>();
for (let i = 0; i < 77; i++) ids.add(genId());
assert.strictEqual(ids.size, 77);

// Test 5: isPresetActive logic (mirrors QuickSlots)
function isActive(current: Preset | null, p: Preset): boolean {
  if (!current) return false;
  return current.provider === p.provider
    && current.model === p.model
    && (current.reasoningEffort ?? undefined) === (p.reasoningEffort ?? undefined);
}
const preset: Preset = { id: "x", label: "L", provider: "p", model: "m", reasoningEffort: "high" };
assert.strictEqual(isActive(preset, preset), true);
assert.strictEqual(isActive({ ...preset, reasoningEffort: undefined }, preset), false);
assert.strictEqual(isActive({ ...preset, model: "other" }, preset), false);
assert.strictEqual(isActive(null, preset), false);
assert.strictEqual(isActive({ ...preset, reasoningEffort: "high" }, { ...preset, reasoningEffort: undefined }), false);

// ── session-props: the dock entry must never throw while building props ──

function makeDirectory(overrides: Partial<any> = {}) {
  return {
    store: {
      subscribe: () => () => {},
      getSnapshot: () => ({ groups: [], current: null, status: "ready" }),
    },
    select: async () => ({ ok: true }),
    load: async () => undefined,
    ...overrides,
  } as any;
}

// Test 6: an unresolvable session yields inert, non-throwing props
let props = buildEntryProps(() => { throw new Error("session resolved no scope"); }, () => false, "s1");
assert.strictEqual(props.available, false);
assert.strictEqual(props.directoryStore, EMPTY_STORE);
assert.strictEqual(await props.selectModel({ provider: "p", model: "m" }), undefined);
props.loadDirectory(); // must not throw

// Test 7: a healthy session resolves normally
props = buildEntryProps(() => makeDirectory(), () => false, "s2");
assert.strictEqual(props.available, true);
assert.deepStrictEqual(await props.selectModel({ provider: "p", model: "m" }), { ok: true });

// Test 8: addressed subagent sessions stay inert but resolvable
props = buildEntryProps(() => makeDirectory(), () => true, "s3");
assert.strictEqual(props.available, false);
assert.strictEqual(await props.selectModel({ provider: "p", model: "m" }), undefined);

// Test 9: an address probe that throws degrades instead of crashing the entry
props = buildEntryProps(() => makeDirectory(), () => { throw new Error("probe failed"); }, "s4");
assert.strictEqual(props.available, false);

// Test 10: a store whose getSnapshot throws is wrapped, never surfaced
const hostile: DirectoryStore = {
  subscribe: () => () => {},
  getSnapshot: () => { throw new Error("boom"); },
};
const wrapped = safeStore(hostile);
assert.deepStrictEqual(wrapped.getSnapshot(), EMPTY_SNAPSHOT);
const unsubscribe = wrapped.subscribe(() => {});
assert.strictEqual(typeof unsubscribe, "function");
unsubscribe();

// Test 11: safeStore tolerates null/undefined/malformed handles
assert.strictEqual(safeStore(null), EMPTY_STORE);
assert.strictEqual(safeStore(undefined), EMPTY_STORE);
assert.strictEqual(safeStore({} as any), EMPTY_STORE);

// Test 12: a store whose subscribe throws still yields a usable unsubscribe
const badSubscribe = safeStore({
  subscribe: () => { throw new Error("nope"); },
  getSnapshot: () => ({ groups: [], current: null, status: "ready" }),
} as any);
const off = badSubscribe.subscribe(() => {});
assert.strictEqual(typeof off, "function");
off();

// Test 13: a synchronous load() failure does not escape the entry
props = buildEntryProps(
  () => makeDirectory({ load: () => { throw new Error("sync load failed"); } }),
  () => false,
  "s5",
);
props.loadDirectory(); // must not throw

// Test 14: a rejected load() is swallowed (no unhandled rejection)
props = buildEntryProps(
  () => makeDirectory({ load: () => Promise.reject(new Error("async load failed")) }),
  () => false,
  "s6",
);
props.loadDirectory();

// Test 15: the wrapped snapshot keeps identity while the source is stable
const stable = safeStore({ subscribe: () => () => {}, getSnapshot: () => EMPTY_SNAPSHOT } as any);
assert.strictEqual(stable.getSnapshot(), stable.getSnapshot());

console.log("self-test passed — all 15 checks OK");
