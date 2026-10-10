/** One user-configured model preset. */
export interface Preset {
  id: string;
  /** Custom display label — need not be the model name. */
  label: string;
  provider: string;
  model: string;
  /** Optional reasoning-effort id; omit for the model default. */
  reasoningEffort?: string;
}

/** A provider→model→effort selection sent to session.selectModel. */
export interface ModelSelection {
  provider: string;
  model: string;
  reasoningEffort?: string;
}

// ── Catalog snapshot shapes (the subset this plugin reads) ──

export interface CatalogEffort {
  id: string;
  name: string;
}

export interface CatalogReasoning {
  defaultEffort?: string;
  efforts?: CatalogEffort[];
}

export interface CatalogModel {
  id: string;
  name: string;
  reasoning?: CatalogReasoning;
}

export interface CatalogGroup {
  id: string;
  name: string;
  models: CatalogModel[];
}

export interface CatalogSnapshot {
  groups: CatalogGroup[];
  current: ModelSelection | null;
  status: string;
}

/** The per-session directory store (uSES-compatible: subscribe + getSnapshot). */
export interface DirectoryStore {
  subscribe(cb: () => void): () => void;
  getSnapshot(): CatalogSnapshot;
}

/** Outcome of a model selection; failures carry the Remote error. */
export interface SelectionResult {
  ok: boolean;
  error?: { code: string; message: string };
}
