import { QuickSlots } from "./QuickSlots";
import type { ModelSelection, DirectoryStore } from "./types";

/**
 * Services this plugin waits for:
 * - sessions         → subagent-address probe (availability)
 * - slots            → conversation.input.dock registration
 * - modelDirectories → per-session model catalog + selection service
 */
const inject = ["sessions", "slots", "modelDirectories"];

function apply(ctx: any) {
  const sessions = ctx.sessions;
  const models = ctx.modelDirectories;

  ctx.slots.inject("conversation.input.dock", () =>
    ctx.slots.register(
      {
        name: "conversation.input.dock",
        id: "model-quickslots",
        order: 0,
        inject: (sessionId: string) => {
          const directory = models.directoryFor(sessionId);
          // Addressed subagent sessions have no Agent-bound model RPC.
          const available = sessions.subagentAddress(sessionId) === undefined;
          return {
            available,
            selectModel: (selection: ModelSelection) =>
              available ? directory.select(selection) : Promise.resolve(undefined),
            directoryStore: directory.store as DirectoryStore,
            loadDirectory: () => {
              if (available) directory.load().catch(() => {});
            },
          };
        },
      },
      QuickSlots,
    ),
  );
}

export { apply, inject };
