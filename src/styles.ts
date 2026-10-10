/** Injected CSS — uses DSH theme CSS variables with sensible fallbacks. */
export const CSS = `
/* Align with the composer card: DSH's own dock entries (queue, todo) use the
   same width constraint, so the row's right edge lines up with the input box
   instead of the window edge. */
.dsh-mqs-row {
  box-sizing: border-box;
  width: calc(
    100%
    - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-side-clearance, 16px)
    - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px)
  );
  max-width: calc(var(--dsh-composer-card-max-width, 100%) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px));
  margin: 0 auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex: none;
  font-family: var(--dsw-font-family, inherit);
}

.dsh-mqs-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border-radius: var(--dsw-radius-sm, 7px);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8e8e8e);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  user-select: none;
  white-space: nowrap;
  max-width: 177px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsh-mqs-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  color: var(--dsw-alias-label-primary, #1a1a1a);
}

.dsh-mqs-btn--active {
  border-color: var(--dsw-alias-state-business-primary, #4f46e5);
  color: var(--dsw-alias-state-business-primary, #4f46e5);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4f46e5) 8%, transparent);
}

.dsh-mqs-btn--pending {
  opacity: 0.5;
  pointer-events: none;
}

.dsh-mqs-btn--add {
  padding: 3px 7px;
  color: var(--dsw-alias-label-tertiary, #8e8e8e);
  border-color: var(--dsw-alias-border-l, rgba(0, 0, 0, 0.12));
}

.dsh-mqs-btn__label {
  font-size: 12px;
}

.dsh-mqs-btn--failed {
  color: var(--dsw-alias-state-error-primary, #dc2626);
  border-color: var(--dsw-alias-state-error-primary, #dc2626);
}

.dsh-mqs-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Edit dialog ── */
.dsh-mqs-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.dsh-mqs-dialog {
  width: min(377px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: var(--dsw-shadow-lv, 0 8px 32px rgba(0, 0, 0, 0.18));
  border: 1px solid var(--dsw-alias-border-l, rgba(0, 0, 0, 0.08));
  font-family: var(--dsw-font-family, inherit);
}

.dsh-mqs-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l, rgba(0, 0, 0, 0.08));
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #1a1a1a);
}

.dsh-mqs-dialog__close {
  display: inline-flex;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-tertiary, #8e8e8e);
  padding: 2px;
  border-radius: var(--dsw-radius-xs, 4px);
}

.dsh-mqs-dialog__close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  color: var(--dsw-alias-label-primary, #1a1a1a);
}

.dsh-mqs-dialog__body {
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.dsh-mqs-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dsh-mqs-field__label {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #8e8e8e);
}

.dsh-mqs-field__input,
.dsh-mqs-field__select {
  padding: 5px 7px;
  border-radius: var(--dsw-radius-sm, 7px);
  border: 1px solid var(--dsw-alias-border-l, rgba(0, 0, 0, 0.12));
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1a1a1a);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

.dsh-mqs-field__input:focus,
.dsh-mqs-field__select:focus {
  border-color: var(--dsw-alias-state-business-primary, #4f46e5);
}

.dsh-mqs-field__hint {
  font-size: 10px;
  color: var(--dsw-alias-label-dimmed, #a0a0a0);
}

.dsh-mqs-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  padding: 11px 14px;
  border-top: 1px solid var(--dsw-alias-border-l, rgba(0, 0, 0, 0.08));
}

.dsh-mqs-btn-action {
  padding: 5px 11px;
  border-radius: var(--dsw-radius-sm, 7px);
  border: 1px solid var(--dsw-alias-border-l, rgba(0, 0, 0, 0.12));
  background: transparent;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.dsh-mqs-btn-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

.dsh-mqs-btn-action--primary {
  background: var(--dsw-alias-button-primary-fill, #4f46e5);
  border-color: transparent;
  color: var(--dsw-alias-label-primary-foreground, #fff);
}

.dsh-mqs-btn-action--primary:hover {
  background: var(--dsw-alias-button-primary-hover, #4338ca);
}

.dsh-mqs-btn-action--danger {
  color: var(--dsw-alias-state-error-primary, #dc2626);
  margin-right: auto;
}

.dsh-mqs-btn-action--danger:hover {
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 38, 38, 0.1));
}

.dsh-mqs-btn-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;

export function injectStyles(): void {
  const tagId = "@moruteaven/dsh-model-quickslots/style";
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`)) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@moruteaven/dsh-model-quickslots";
  tag.dataset.pluginCss = tagId;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
