export interface TelegramCommandDefinition {
  command: string;
  telegramDescription: string;
  operatorDescription: string;
}

export const TELEGRAM_COMMANDS = {
  usage: {
    command: "usage",
    telegramDescription: "Show Claude/Codex usage limits",
    operatorDescription: "Show Claude and Codex usage limits and current runtime status.",
  },
  set_buddy: {
    command: "set_buddy",
    telegramDescription: "Switch default agent",
    operatorDescription: "Switch the default agent for future messages.",
  },
  new_session: {
    command: "new_session",
    telegramDescription: "Start a new Claude session",
    operatorDescription: "Start a fresh personal Claude god-session.",
  },
  sessions: {
    command: "sessions",
    telegramDescription: "Resume or delete Claude sessions",
    operatorDescription: "Resume or delete sessions owned by the current Telegram user.",
  },
  tasks: {
    command: "tasks",
    telegramDescription: "List open tasks",
    operatorDescription: "List open provider issues and send a selected task to the session.",
  },
  users: {
    command: "users",
    telegramDescription: "Manage bot access",
    operatorDescription: "Manage Telegram bot access for allowed and pending users.",
  },
} as const satisfies Record<string, TelegramCommandDefinition>;

export type TelegramCommandName = keyof typeof TELEGRAM_COMMANDS;

export const TELEGRAM_COMMAND_LIST = Object.values(TELEGRAM_COMMANDS);

export function telegramSetMyCommandsPayload(): {
  commands: { command: string; description: string }[];
} {
  return {
    commands: TELEGRAM_COMMAND_LIST.map(({ command, telegramDescription }) => ({
      command,
      description: telegramDescription,
    })),
  };
}
