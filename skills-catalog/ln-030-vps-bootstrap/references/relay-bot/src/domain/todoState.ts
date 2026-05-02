import { createHash } from "node:crypto";

export type TodoStatus = "pending" | "in_progress" | "completed" | (string & {});

export interface TodoStateRow {
  sessionId: string;
  taskId: string;
  status: TodoStatus;
  content: string;
  activeForm: string | null;
  updatedAt: number;
}

export interface TodoInput {
  content: string;
  status: string;
  activeForm: string | null;
}

export interface TodoTransition {
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  display: string;
  emoji: "🟡" | "✅";
}

export function taskIdFor(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("hex").slice(0, 16);
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/**
 * Pure diff: given the previous map of task_id → row and the new TodoWrite
 * payload, return transitions (in_progress / completed) and the new state
 * snapshot. No I/O.
 */
export function computeTodoTransitions(
  prev: Map<string, Pick<TodoStateRow, "status">>,
  todos: unknown[],
  todoTextMaxLen: number
): { transitions: TodoTransition[]; upserts: TodoStateRow[]; ts: number } {
  const ts = Math.floor(Date.now() / 1000);
  const transitions: TodoTransition[] = [];
  const upserts: TodoStateRow[] = [];
  for (const item of todos) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const content = ((obj.content as string | undefined) ?? "").trim();
    if (!content) continue;
    const status = (((obj.status as string | undefined) ?? "pending") || "pending")
      .trim()
      .toLowerCase();
    const activeForm = ((obj.activeForm as string | undefined) ?? "").trim();
    const tid = taskIdFor(content);
    const prevStatus = prev.get(tid)?.status ?? null;
    if (prevStatus === status) continue;
    let display = status === "in_progress" && activeForm.length > 0 ? activeForm : content;
    display = truncate(display, todoTextMaxLen);
    if (status === "in_progress") {
      transitions.push({
        taskId: tid,
        fromStatus: prevStatus,
        toStatus: status,
        display,
        emoji: "🟡",
      });
    } else if (status === "completed") {
      transitions.push({
        taskId: tid,
        fromStatus: prevStatus,
        toStatus: status,
        display,
        emoji: "✅",
      });
    }
    upserts.push({
      sessionId: "",
      taskId: tid,
      status,
      content,
      activeForm: activeForm.length > 0 ? activeForm : null,
      updatedAt: ts,
    });
  }
  return { transitions, upserts, ts };
}
