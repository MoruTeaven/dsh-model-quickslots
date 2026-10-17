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
/** Re-registration guard: at most this many revives inside one stable window. */
const MAX_REVIVES_PER_WINDOW = 7;
/** Surviving this long without another revive restores the revive budget. */
const DEFAULT_STABLE_WINDOW_MS = 10_000;
/** A crashed entry is replaced promptly; a failed directory lookup gets a beat. */
const CRASH_REVIVE_DELAY_MS = 0;
const UNRESOLVED_REVIVE_DELAY_MS = 1_000;

/**
 * Timing overrides. Present only so tests can exercise the paths without
 * waiting real seconds; absent in the browser, so the defaults stand.
 */
function timing() {
  const overrides = (globalThis as any).__DSH_MQS_TIMING__ ?? {};
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && value >= 0 ? value : fallback;
  return {
    stableWindowMs: num(overrides.stableWindowMs, DEFAULT_STABLE_WINDOW_MS),
    crashDelayMs: num(overrides.crashDelayMs, CRASH_REVIVE_DELAY_MS),
    unresolvedDelayMs: num(overrides.unresolvedDelayMs, UNRESOLVED_REVIVE_DELAY_MS),
  };
}

/** Result of a register attempt: the disposer, or null when it threw. */
type RegisterResult = (() => void) | null;

function apply(ctx: any) {
  const sessions = ctx.sessions;
  const models = ctx.modelDirectories;

  const register = (onUnresolved: () => void): RegisterResult => {
    try {
      return ctx.slots.register(
        {
          name: SLOT_KEY,
          id: ENTRY_ID,
          order: 0,
          inject: (sessionId: string) =>
            buildEntryProps(
              (id) => models.directoryFor(id),
              (id) => sessions.subagentAddress(id) !== undefined,
              sessionId,
              onUnresolved,
            ),
        },
        QuickSlots,
      );
    } catch {
      // SlotCore.register throws when a same-id entry still occupies the cell
      // (cold-boot race: the previous declaration's dispose hasn't settled when
      // the new declaration epoch fires reconcile). Without this catch the throw
      // bubbles into SlotRegistry.inject's error handler, which calls stop() —
      // permanently killing the injection for the page lifetime.
      return null;
    }
  };

  ctx.slots.inject(SLOT_KEY, () => {
    let dispose: RegisterResult = null;
    let revives = 0;
    let pending = false;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;
    let reviveTimer: ReturnType<typeof setTimeout> | undefined;

    // Three failure modes lead here, all previously requiring toggling the
    // plugin off and on:
    //
    //  1. The entry crashed while rendering. The renderer retires ("abdicates")
    //     a crashed list-slot entry with no recovery path, so the row vanished
    //     for the rest of the page.
    //  2. Resolving the session's model directory failed, so the entry fell back
    //     to inert props — and inject results are cached per session binding, so
    //     it never got another chance.
    //  3. register() itself threw because the slot's declaration epoch advanced
    //     (another plugin loading) before the previous entry's dispose settled.
    //     Without catching this, SlotRegistry.inject's error handler calls
    //     stop() — permanently killing the injection for the page lifetime.
    //
    // Re-registering the entry fixes all three: a fresh entry re-runs inject
    // against a freshly resolved directory. The budget is per stable window,
    // not cumulative, so a one-off fault heals and then forgets while a genuine
    // loop still stops after MAX_REVIVES_PER_WINDOW tries.
    const armStableWindow = () => {
      if (stableTimer !== undefined) clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        stableTimer = undefined;
        revives = 0;
      }, timing().stableWindowMs);
    };

    const revive = (delayMs: number) => {
      if (pending || revives >= MAX_REVIVES_PER_WINDOW) return;
      pending = true;
      revives += 1;
      if (stableTimer !== undefined) {
        clearTimeout(stableTimer);
        stableTimer = undefined;
      }
      // Never mutate the slot during the renderer's commit phase.
      if (reviveTimer !== undefined) clearTimeout(reviveTimer);
      reviveTimer = setTimeout(() => {
        reviveTimer = undefined;
        pending = false;
        // Dispose the previous entry (if any) before re-registering.
        if (dispose) {
          try { dispose(); } catch { /* already disposed */ }
        }
        dispose = register(() => revive(timing().unresolvedDelayMs));
        // If register returned null (threw internally), schedule another revive
        // to retry. Otherwise, the entry is live — arm the stable window.
        if (dispose === null && revives < MAX_REVIVES_PER_WINDOW) {
          revive(timing().unresolvedDelayMs);
        } else {
          armStableWindow();
        }
      }, delayMs);
    };

    dispose = register(() => revive(timing().unresolvedDelayMs));
    // If the initial register threw, kick off a revive immediately instead of
    // waiting for an onEntryError or onUnresolved callback that may never fire.
    if (dispose === null) {
      revive(timing().unresolvedDelayMs);
    } else {
      armStableWindow();
    }

    const off =
      typeof ctx.slots.onEntryError === "function"
        ? ctx.slots.onEntryError((key: string, entry: any, _error: unknown, info: any) => {
            if (key !== SLOT_KEY || info?.abdicated !== true) return;
            if (entry?.options?.id !== ENTRY_ID) return;
            revive(timing().crashDelayMs);
          })
        : undefined;

    return () => {
      off?.();
      if (stableTimer !== undefined) clearTimeout(stableTimer);
      if (reviveTimer !== undefined) clearTimeout(reviveTimer);
      dispose?.();
    };
  });
}

export { apply, inject };
