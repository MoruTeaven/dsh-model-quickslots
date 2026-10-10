import type {
  CatalogSnapshot,
  DirectoryStore,
  ModelSelection,
  SelectionResult,
} from "./types";

/** Props the dock entry hands to the QuickSlots component. */
export interface EntryProps {
  available: boolean;
  selectModel: (selection: ModelSelection) => Promise<SelectionResult | undefined>;
  directoryStore: DirectoryStore;
  loadDirectory: () => void;
}

/** The per-session model directory this entry needs (the subset it calls). */
export interface DirectoryLike {
  store: DirectoryStore;
  select(selection: ModelSelection): Promise<SelectionResult | undefined>;
  load(): Promise<unknown>;
}

/** Stable empty snapshot — one identity, so a fallback never churns React. */
export const EMPTY_SNAPSHOT: CatalogSnapshot = { groups: [], current: null, status: "unavailable" };

/** A store that never changes and always returns the same snapshot. */
export const EMPTY_STORE: DirectoryStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_SNAPSHOT,
};

/**
 * Never hand a broken store to the renderer. A `getSnapshot` that throws (or
 * returns undefined) crashes the slot entry, and a crashed list-slot entry is
 * retired for the rest of the page — so every store crossing this boundary is
 * wrapped to make its failures inert.
 */
export function safeStore(store: DirectoryStore | null | undefined): DirectoryStore {
  if (!store || typeof store.subscribe !== "function" || typeof store.getSnapshot !== "function") {
    return EMPTY_STORE;
  }
  return {
    subscribe: (listener) => {
      try {
        const unsubscribe = store.subscribe(listener);
        return typeof unsubscribe === "function" ? unsubscribe : () => {};
      } catch {
        return () => {};
      }
    },
    getSnapshot: () => {
      try {
        return store.getSnapshot() ?? EMPTY_SNAPSHOT;
      } catch {
        return EMPTY_SNAPSHOT;
      }
    },
  };
}

/** Inert props for a session whose model directory cannot be resolved yet. */
export function unavailableProps(): EntryProps {
  return {
    available: false,
    selectModel: () => Promise.resolve(undefined),
    directoryStore: EMPTY_STORE,
    loadDirectory: () => {},
  };
}

/**
 * Build the dock entry's props for one session.
 *
 * Resolving the session's model directory can throw while its scope is not (or
 * no longer) retained: a cold-boot race, a live plugin reload tearing scopes
 * down, or an addressed subagent session. A throw from a slot `inject` factory
 * is fatal — the renderer retires the entry, and list-slot abdication has no
 * recovery path, so the buttons stayed gone until the plugin was toggled off
 * and on. Degrade to inert props instead.
 *
 * The entry's inject result is cached per (entry, session binding), so inert
 * props would otherwise stick for the life of that binding. `onUnresolved` is
 * therefore asked to re-register the entry later, which re-runs inject against
 * a freshly resolved directory.
 */
export function buildEntryProps(
  directoryFor: (sessionId: string) => DirectoryLike,
  isAddressedSubagent: (sessionId: string) => boolean,
  sessionId: string,
  onUnresolved?: () => void,
): EntryProps {
  let directory: DirectoryLike;
  try {
    directory = directoryFor(sessionId);
  } catch {
    onUnresolved?.();
    return unavailableProps();
  }
  let available = true;
  try {
    available = !isAddressedSubagent(sessionId);
  } catch {
    available = false;
  }
  return {
    available,
    selectModel: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
    directoryStore: safeStore(directory.store),
    loadDirectory: () => {
      if (!available) return;
      try {
        directory.load().catch(() => {});
      } catch {
        /* a synchronous load failure must not crash the entry either */
      }
    },
  };
}
