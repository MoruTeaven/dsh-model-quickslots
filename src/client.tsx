import { QuickSlots } from "./QuickSlots";
import { buildEntryProps } from "./session-props";

/**
 * Services this plugin waits for:
 * - sessions         → subagent-address probe (availability)
 * - slots            → conversation.input.dock registration
 * - modelDirectories → per-session model catalog + selection service
 */
const inject = ["sessions", "slots", "modelDirectories"];

/** The list slot this plugin contributes to. */
const SLOT_KEY = "conversation.input.dock";
/** This plugin's entry id inside that list slot. */
const ENTRY_ID = "model-quickslots";
/** Crash-loop guard: at most this many revives inside one stable window. */
const MAX_REVIVES_PER_WINDOW = 3;
/** Surviving this long without another crash restores the revive budget. */
const DEFAULT_STABLE_WINDOW_MS = 10_000;

/**
 * The stable-window length. Overridable only so tests can exercise the reset
 * without waiting ten seconds; absent in the browser, so the default stands.
 */
function stableWindowMs(): number {
  const override = (globalThis as any).__DSH_MQS_STABLE_WINDOW_MS__;
  return typeof override === "number" && override >= 0 ? override : DEFAULT_STABLE_WINDOW_MS;
}

function apply(ctx: any) {
  const sessions = ctx.sessions;
  const models = ctx.modelDirectories;

  const register = () =>
    ctx.slots.register(
      {
        name: SLOT_KEY,
        id: ENTRY_ID,
        order: 0,
        inject: (sessionId: string) =>
          buildEntryProps(
            (id) => models.directoryFor(id),
            (id) => sessions.subagentAddress(id) !== undefined,
            sessionId,
          ),
      },
      QuickSlots,
    );

  ctx.slots.inject(SLOT_KEY, () => {
    let dispose = register();
    let revives = 0;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;

    // A list-slot entry that crashes is retired for the whole page lifetime
    // (abdication has no recovery path), which is why the row used to stay gone
    // until the plugin was toggled off and on. Re-register a fresh entry so an
    // occasional crash heals itself.
    //
    // The budget is per stable window, not cumulative: a one-off fault (a cold
    // boot race, a plugin reload tearing scopes down) heals and then forgets,
    // while a genuine crash loop still stops after MAX_REVIVES_PER_WINDOW tries
    // instead of spinning forever.
    const armStableWindow = () => {
      if (stableTimer !== undefined) clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        stableTimer = undefined;
        revives = 0;
      }, stableWindowMs());
    };
    armStableWindow();

    const off =
      typeof ctx.slots.onEntryError === "function"
        ? ctx.slots.onEntryError((key: string, entry: any, _error: unknown, info: any) => {
            if (key !== SLOT_KEY || info?.abdicated !== true) return;
            if (entry?.options?.id !== ENTRY_ID || revives >= MAX_REVIVES_PER_WINDOW) return;
            revives += 1;
            if (stableTimer !== undefined) {
              clearTimeout(stableTimer);
              stableTimer = undefined;
            }
            const previous = dispose;
            // Defer out of the renderer's commit phase before mutating the slot.
            queueMicrotask(() => {
              try {
                previous();
              } catch {
                /* already disposed */
              }
              dispose = register();
              armStableWindow();
            });
          })
        : undefined;

    return () => {
      off?.();
      if (stableTimer !== undefined) clearTimeout(stableTimer);
      dispose();
    };
  });
}

export { apply, inject };
