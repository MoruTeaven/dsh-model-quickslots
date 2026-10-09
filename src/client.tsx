import { QuickSlots } from "./QuickSlots";
import type { ModelSelection, DirectoryStore } from "./types";

/**
 * Services this plugin waits for:
 * - sessions     → session.selectModel RPC
 * - slots        → conversation.input.dock registration
 * - modelDirectories → per-session model catalog store
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
          return {
            selectModel: (selection: ModelSelection) =>
              sessions.selectModel({ sessionId, ...selection }),
            directoryStore: directory.store as DirectoryStore,
            loadDirectory: () => { directory.load().catch(() => {}); },
          };
        },
      },
      QuickSlots,
    ),
  );
}

export { apply, inject };
