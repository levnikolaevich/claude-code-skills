import { z } from "zod/v4";

export type GodCommandAction = "default" | "new" | "resume";

export const GodCommandSchema = z.object({
  command_id: z.string().min(1),
  ts: z.number().int(),
  action: z.enum(["default", "new", "resume"]),
  session_id: z.string().nullable().optional(),
  operator_chat_id: z.number().int().nullable().optional(),
});

export type GodCommand = z.infer<typeof GodCommandSchema>;
