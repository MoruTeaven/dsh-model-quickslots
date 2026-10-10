import { useState, useEffect, useCallback } from "react";
import type { Preset, CatalogSnapshot } from "./types";
import { genId } from "./storage";
import { CloseIcon, TrashIcon } from "./icons";

interface EditDialogProps {
  preset: Preset | null;
  snapshot: CatalogSnapshot;
  onSave: (preset: Preset) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EditDialog({ preset, snapshot, onSave, onDelete, onClose }: EditDialogProps) {
  const [label, setLabel] = useState(preset?.label ?? "");
  const [provider, setProvider] = useState(preset?.provider ?? "");
  const [model, setModel] = useState(preset?.model ?? "");
  const [effort, setEffort] = useState(preset?.reasoningEffort ?? "");

  const groups = snapshot.groups;
  const selectedGroup = groups.find(g => g.id === provider);
  const models = selectedGroup?.models ?? [];
  const selectedModel = models.find(m => m.id === model);
  const efforts = selectedModel?.reasoning?.efforts ?? [];

  const onProviderChange = useCallback((val: string) => {
    setProvider(val);
    setModel("");
    setEffort("");
  }, []);

  const onModelChange = useCallback((val: string) => {
    setModel(val);
    const m = models.find(mm => mm.id === val);
    setEffort(m?.reasoning?.defaultEffort ?? "");
  }, [models]);

  const handleSave = useCallback(() => {
    if (!provider || !model) return;
    onSave({
      id: preset?.id ?? genId(),
      // Empty label means "auto" — QuickSlots derives the display name
      // from the live catalog, so it stays correct if the model is renamed.
      label: label.trim(),
      provider,
      model,
      reasoningEffort: effort || undefined,
    });
  }, [preset, label, provider, model, effort, onSave]);

  // Escape to close, Ctrl/Cmd+Enter to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, handleSave]);

  const providerInCatalog = groups.some(g => g.id === provider);
  const modelInCatalog = models.some(m => m.id === model);
  const effortInList = efforts.some(e => e.id === effort);

  return (
    <div className="dsh-mqs-overlay" onClick={onClose}>
      <div className="dsh-mqs-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dsh-mqs-dialog__header">
          <span>{preset ? "编辑预设" : "添加预设"}</span>
          <button className="dsh-mqs-dialog__close" onClick={onClose} type="button" aria-label="关闭">
            <CloseIcon size={15} />
          </button>
        </div>
        <div className="dsh-mqs-dialog__body">
          <div className="dsh-mqs-field">
            <label className="dsh-mqs-field__label">备注</label>
            <input
              className="dsh-mqs-field__input"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={selectedModel ? selectedModel.name + "（默认）" : "自定义名称（可选）"}
              type="text"
              autoFocus
            />
          </div>

          <div className="dsh-mqs-field">
            <label className="dsh-mqs-field__label">提供方</label>
            <select
              className="dsh-mqs-field__select"
              value={provider}
              onChange={e => onProviderChange(e.target.value)}
            >
              <option value="">— 选择 —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              {!providerInCatalog && provider && (
                <option value={provider}>{provider}</option>
              )}
            </select>
            {groups.length === 0 && (
              <span className="dsh-mqs-field__hint">
                {snapshot.status === "loading" ? "正在加载模型目录…" : "模型目录为空"}
              </span>
            )}
          </div>

          <div className="dsh-mqs-field">
            <label className="dsh-mqs-field__label">模型</label>
            <select
              className="dsh-mqs-field__select"
              value={model}
              onChange={e => onModelChange(e.target.value)}
              disabled={models.length === 0 && !model}
            >
              <option value="">— 选择 —</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              {!modelInCatalog && model && (
                <option value={model}>{model}</option>
              )}
            </select>
          </div>

          {efforts.length > 0 && (
            <div className="dsh-mqs-field">
              <label className="dsh-mqs-field__label">思考强度</label>
              <select
                className="dsh-mqs-field__select"
                value={effort}
                onChange={e => setEffort(e.target.value)}
              >
                <option value="">默认</option>
                {efforts.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
                {!effortInList && effort && (
                  <option value={effort}>{effort}</option>
                )}
              </select>
            </div>
          )}
        </div>
        <div className="dsh-mqs-dialog__footer">
          {preset && (
            <button
              className="dsh-mqs-btn-action dsh-mqs-btn-action--danger"
              onClick={() => onDelete(preset.id)}
              type="button"
            >
              <TrashIcon size={13} />
            </button>
          )}
          <button className="dsh-mqs-btn-action" onClick={onClose} type="button">取消</button>
          <button
            className="dsh-mqs-btn-action dsh-mqs-btn-action--primary"
            onClick={handleSave}
            disabled={!provider || !model}
            type="button"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
