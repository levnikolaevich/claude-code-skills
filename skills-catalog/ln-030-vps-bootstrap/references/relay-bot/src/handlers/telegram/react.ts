import type { Bot } from "grammy";
import type { Logger } from "../../lib/logger.js";
import { REACTION_FALLBACK } from "../../config/paths.js";

export interface ReactDeps {
  bot: Bot;
  log: Logger;
  reactions: string[];
}

export function createReactToInbound(deps: ReactDeps) {
  return async function reactToInbound(chatId: number, messageId: number): Promise<void> {
    const primary =
      deps.reactions.length > 0
        ? (deps.reactions[Math.floor(Math.random() * deps.reactions.length)] ?? "👀")
        : "👀";
    for (const emoji of [primary, REACTION_FALLBACK]) {
      try {
        await deps.bot.api.setMessageReaction(chatId, messageId, [
          { type: "emoji", emoji: emoji as "👀" },
        ]);
        return;
      } catch (error) {
        deps.log.debug({ err: String(error), emoji }, "reaction failed");
      }
    }
    deps.log.warn({ chatId, messageId }, "could not set any reaction");
  };
}
