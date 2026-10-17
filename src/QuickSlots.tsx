import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import type { MouseEvent, DragEvent } from "react";
import type { Preset, ModelSelection, DirectoryStore, SelectionResult } from "./types";
import { loadPresets, savePresets, genId } from "./storage";
import { injectStyles } from "./styles";
import { PlusIcon } from "./icons";
import { EditDialog } from "./EditDialog";

injectStyles();

interface QuickSlotsProps {
  sessionId: string;
  available: boolean;
  selectModel: (selection: ModelSelection) => Promise<SelectionResult | undefined>;
  directoryStore: DirectoryStore;
  loadDirectory: () => void;
}

export function QuickSlots({ available, selectModel, directoryStore, loadDirectory }: QuickSlotsProps) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ preset: Preset | null } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const snapshot = useSyncExternalStore(directoryStore.subscribe, directoryStore.getSnapshot);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  // Button text. A custom label always wins; otherwise prefer the catalog's
  // display name for the model ("DeepSeek-V41-Flash") over the raw
  // "provider/model" pair, which is long and gets truncated in the row.
  const labelOf = useCallback((p: Preset) => {
    // Presets saved by earlier versions baked in "provider/model" as their
    // label. Treat that (and an empty label) as "no custom name" and derive a
    // short one, so long pairs never get truncated in the row.
    const isAuto = !p.label || p.label === p.provider + "/" + p.model;
    if (!isAuto) return p.label;
    for (const g of snapshot.groups ?? []) {
      if (g.id !== p.provider) continue;
      for (const m of g.models) {
        if (m.id === p.model) return m.name;
      }
    }
    return p.model.split("/").pop() || p.model;
  }, [snapshot.groups]);

  const isPresetActive = useCallback((p: Preset) => {
    const c = snapshot.current;
    if (!c) return false;
    return c.provider === p.provider
      && c.model === p.model
      && (c.reasoningEffort ?? undefined) === (p.reasoningEffort ?? undefined);
  }, [snapshot.current]);

  const handleClick = useCallback(async (p: Preset) => {
    if (!available) return;
    setPendingId(p.id);
    setFailedId(null);
    try {
      const result = await selectModel({
        provider: p.provider,
        model: p.model,
        reasoningEffort: p.reasoningEffort,
      });
      if (result && result.ok === false) setFailedId(p.id);
    } catch {
      setFailedId(p.id);
    } finally {
      setPendingId(null);
    }
  }, [selectModel, available]);

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

  const handleDragStart = useCallback((i: number) => setDragIndex(i), []);
  const handleDragOver = useCallback((e: DragEvent, i: number) => {
    e.preventDefault(); // allow drop
    setDragOverIndex(i);
  }, []);
  const handleDrop = useCallback((i: number) => {
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); return; }
    setPresets(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      savePresets(next);
      return next;
    });
    setDragIndex(null);
  }, [dragIndex]);
  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div className="dsh-mqs-row">
      {presets.map((p, i) => (
        <button
          key={p.id}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e: DragEvent) => handleDragOver(e, i)}
          onDrop={() => handleDrop(i)}
          onDragEnd={handleDragEnd}
          className={
            "dsh-mqs-btn"
            + (isPresetActive(p) ? " dsh-mqs-btn--active" : "")
            + (pendingId === p.id ? " dsh-mqs-btn--pending" : "")
            + (failedId === p.id ? " dsh-mqs-btn--failed" : "")
            + (dragIndex === i ? " dsh-mqs-btn--dragging" : "")
            + (dragOverIndex === i && dragIndex !== null && dragIndex !== i ? " dsh-mqs-btn--drag-over" : "")
          }
          onClick={() => handleClick(p)}
          onContextMenu={(e: MouseEvent) => handleContextMenu(e, p)}
          title={
            p.provider + "/" + p.model
            + (p.reasoningEffort ? " · " + p.reasoningEffort : "")
            + (failedId === p.id ? "（切换失败）" : "")
          }
          disabled={!available}
          type="button"
        >
          {labelOf(p)}
        </button>
      ))}
      <button
        className="dsh-mqs-btn dsh-mqs-btn--add"
        onClick={() => setEditing({ preset: null })}
        title={presets.length === 0 ? "添加模型预设" : "添加预设"}
        type="button"
      >
        <PlusIcon size={13} />
        {presets.length === 0 && <span className="dsh-mqs-btn__label">模型预设</span>}
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
