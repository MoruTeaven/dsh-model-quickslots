import type { Preset } from "./types";

const KEY = "dsh-model-quickslots:presets";

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets));
  } catch {
    /* quota or private mode — silently drop */
  }
}

let counter = 0;
export function genId(): string {
  counter += 1;
  return `preset-${Date.now().toString(36)}-${counter}`;
}
