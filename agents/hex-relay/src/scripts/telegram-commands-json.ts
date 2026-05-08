import { telegramSetMyCommandsPayload } from "../domain/telegramCommands.js";

process.stdout.write(`${JSON.stringify(telegramSetMyCommandsPayload())}\n`);
