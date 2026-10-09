import assert from "node:assert";
import { loadPresets, savePresets, genId } from "./storage";
import type { Preset } from "./types";

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

console.log("self-test passed — all 5 checks OK");
