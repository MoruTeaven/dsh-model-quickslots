import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import type { MouseEvent } from "react";
import type { Preset, ModelSelection, DirectoryStore } from "./types";
import { loadPresets, savePresets, genId } from "./storage";
import { injectStyles } from "./styles";
import { PlusIcon } from "./icons";
import { EditDialog } from "./EditDialog";

injectStyles();

interface QuickSlotsProps {
  sessionId: string;
  selectModel: (selection: ModelSelection) => Promise<unknown>;
  directoryStore: DirectoryStore;
  loadDirectory: () => void;
}

export function QuickSlots({ selectModel, directoryStore, loadDirectory }: QuickSlotsProps) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ preset: Preset | null } | null>(null);

  const snapshot = useSyncExternalStore(directoryStore.subscribe, directoryStore.getSnapshot);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const isPresetActive = useCallback((p: Preset) => {
    const c = snapshot.current;
    if (!c) return false;
    return c.provider === p.provider
      && c.model === p.model
      && (c.reasoningEffort ?? undefined) === (p.reasoningEffort ?? undefined);
  }, [snapshot.current]);

  const handleClick = useCallback(async (p: Preset) => {
    setPendingId(p.id);
    try {
      await selectModel({ provider: p.provider, model: p.model, reasoningEffort: p.reasoningEffort });
    } catch {
      /* selectModel failures are surfaced by DSH itself */
    } finally {
      setPendingId(null);
    }
  }, [selectModel]);

  const handleContextMenu = useCallback((e: MouseEvent, p: Preset) => {
    e.preventDefault();
    setEditing({ preset: p });
  }, []);

  const handleSave = useCallback((preset: Preset) => {
    const withId = preset.id ? preset : { ...preset, id: genId() };
    setPresets(prev => {
      const idx = prev.findIndex(p => p.id === withId.id);
      const next = idx >= 0
        ? [...prev.slice(0, idx), withId, ...prev.slice(idx + 1)]
        : [...prev, withId];
      savePresets(next);
      return next;
    });
    setEditing(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      savePresets(next);
      return next;
    });
    setEditing(null);
  }, []);

  return (
    <div className="dsh-mqs-row">
      {presets.map(p => (
        <button
          key={p.id}
          className={
            "dsh-mqs-btn"
            + (isPresetActive(p) ? " dsh-mqs-btn--active" : "")
            + (pendingId === p.id ? " dsh-mqs-btn--pending" : "")
          }
          onClick={() => handleClick(p)}
          onContextMenu={(e: MouseEvent) => handleContextMenu(e, p)}
          title={p.provider + "/" + p.model + (p.reasoningEffort ? " · " + p.reasoningEffort : "")}
          type="button"
        >
          {p.label || (p.provider + "/" + p.model)}
        </button>
      ))}
      <button
        className="dsh-mqs-btn dsh-mqs-btn--add"
        onClick={() => setEditing({ preset: null })}
        title="添加预设"
        type="button"
      >
        <PlusIcon size={13} />
      </button>
      {editing && (
        <EditDialog
          preset={editing.preset}
          snapshot={snapshot}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
