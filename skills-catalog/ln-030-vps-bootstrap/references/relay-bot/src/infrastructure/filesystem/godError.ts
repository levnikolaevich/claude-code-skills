import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { z } from "zod/v4";
import type { Logger } from "../../lib/logger.js";

export const GodErrorSchema = z
  .object({
    ts: z.number().optional(),
    source: z.string().optional(),
    exit_code: z.number().nullable().optional(),
    signal: z.string().nullable().optional(),
    reason: z.string().optional(),
    kind: z.string().optional(),
    details: z.string().optional(),
    project_name: z.string().optional(),
    service_prefix: z.string().optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
    session: z.string().optional(),
    session_id: z.string().optional(),
    runtime_seconds: z.number().optional(),
    requested_sid: z.string().optional(),
    failed_last_session_file: z.string().optional(),
  })
  .passthrough();

export type GodError = z.infer<typeof GodErrorSchema>;

export type GodErrorReader = ReturnType<typeof createGodErrorReader>;

export function createGodErrorReader(filePath: string, log: Logger) {
  return {
    consume(): GodError | null {
      if (!existsSync(filePath)) return null;
      try {
        const raw = readFileSync(filePath, "utf8");
        const parsed = GodErrorSchema.safeParse(JSON.parse(raw));
        try {
          unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        if (!parsed.success) {
          log.warn({ issues: parsed.error.issues }, "last-god-error.json invalid");
          return null;
        }
        return parsed.data;
      } catch (error) {
        log.warn({ err: String(error) }, "read last-god-error.json failed");
        return null;
      }
    },
  };
}
