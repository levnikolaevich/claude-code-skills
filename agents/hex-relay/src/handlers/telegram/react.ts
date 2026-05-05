import type { Bot } from "grammy";
import type { Logger } from "../../lib/logger.js";
import { REACTION_FALLBACK } from "../../config/paths.js";

export interface ReactDeps {
  bot: Bot;
  log: Logger;
  reactions: string[];
}

export const VOICE_TRANSCRIBING_REACTION = "✍";

export interface ReactInboundOptions {
  includeVoiceTranscribing?: boolean;
}

type TelegramReactionList = Parameters<Bot["api"]["setMessageReaction"]>[2];

async function setReactions(
  deps: ReactDeps,
  chatId: number,
  messageId: number,
  emojis: string[]
): Promise<void> {
  const reactions = emojis.map((emoji) => ({
    type: "emoji" as const,
    emoji,
  })) as TelegramReactionList;
  await deps.bot.api.setMessageReaction(chatId, messageId, reactions);
}

function primaryInboundReaction(reactions: string[]): string {
  return reactions.length > 0
    ? (reactions[Math.floor(Math.random() * reactions.length)] ?? "👀")
    : "👀";
}

export function createReactToInbound(deps: ReactDeps) {
  return async function reactToInbound(
    chatId: number,
    messageId: number,
    options: ReactInboundOptions = {}
  ): Promise<void> {
    const primary = primaryInboundReaction(deps.reactions);
    const candidates = options.includeVoiceTranscribing
      ? [[VOICE_TRANSCRIBING_REACTION, primary], [primary], [REACTION_FALLBACK]]
      : [[primary], [REACTION_FALLBACK]];
    for (const emojis of candidates) {
      try {
        await setReactions(deps, chatId, messageId, emojis);
        return;
      } catch (error) {
        deps.log.debug({ err: String(error), emojis }, "reaction failed");
      }
    }
    deps.log.warn({ chatId, messageId }, "could not set any reaction");
  };
}

export function createReactToVoiceTranscribing(deps: ReactDeps) {
  return async function reactToVoiceTranscribing(chatId: number, messageId: number): Promise<void> {
    for (const emoji of [VOICE_TRANSCRIBING_REACTION, REACTION_FALLBACK]) {
      try {
        await setReactions(deps, chatId, messageId, [emoji]);
        return;
      } catch (error) {
        deps.log.debug({ err: String(error), emoji }, "voice transcribing reaction failed");
      }
    }
    deps.log.warn({ chatId, messageId }, "could not set voice transcribing reaction");
  };
}
