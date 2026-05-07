import type { Bot } from "grammy";
import type { Logger } from "../lib/logger.js";

const TYPING_REFRESH_MS = 4000;
const TYPING_MAX_DURATION_MS = 30 * 60_000;

interface TypingHandle {
  intervalId: NodeJS.Timeout;
  expiresAt: number;
  chatId: number;
}

export type TypingService = ReturnType<typeof createTypingService>;

export interface TypingDeps {
  bot: Bot;
  log: Logger;
}

export function createTypingService(deps: TypingDeps) {
  const handles = new Map<string, TypingHandle>();

  function send(chatId: number): void {
    deps.bot.api.sendChatAction(chatId, "typing").catch((error: unknown) => {
      deps.log.debug({ err: String(error), chatId }, "sendChatAction typing failed");
    });
  }

  function start(sessionId: string, chatId: number): void {
    const existing = handles.get(sessionId);
    if (existing) {
      existing.expiresAt = Date.now() + TYPING_MAX_DURATION_MS;
      if (existing.chatId === chatId) return;
      clearInterval(existing.intervalId);
    }
    send(chatId);
    const intervalId = setInterval(() => {
      const h = handles.get(sessionId);
      if (!h) return;
      if (Date.now() > h.expiresAt) {
        clearInterval(h.intervalId);
        handles.delete(sessionId);
        return;
      }
      send(h.chatId);
    }, TYPING_REFRESH_MS);
    if (typeof intervalId.unref === "function") intervalId.unref();
    handles.set(sessionId, {
      intervalId,
      expiresAt: Date.now() + TYPING_MAX_DURATION_MS,
      chatId,
    });
  }

  function stop(sessionId: string): void {
    const h = handles.get(sessionId);
    if (!h) return;
    clearInterval(h.intervalId);
    handles.delete(sessionId);
  }

  function stopAll(): void {
    for (const h of handles.values()) {
      clearInterval(h.intervalId);
    }
    handles.clear();
  }

  function activeCount(): number {
    return handles.size;
  }

  return { start, stop, stopAll, activeCount };
}
