export interface TgPrefixArgs {
  chatId: number;
  msgId: number;
  /** username or stringified user id; null/undefined renders prefix without `user=` */
  userToken?: string | null;
}

export function buildTgPrefix(args: TgPrefixArgs): string {
  const userPart = args.userToken ? ` user=${args.userToken}` : "";
  return `[tg id=${args.chatId}:${args.msgId}${userPart}]`;
}
