import { Bot } from "grammy";

export type TelegramClient = Bot;

export interface TelegramClientDeps {
  token: string;
}

export function createTelegramClient(deps: TelegramClientDeps): TelegramClient {
  return new Bot(deps.token);
}
