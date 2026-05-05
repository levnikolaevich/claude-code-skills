export type AllowedUserStatus = "allowed" | "blocked" | "pending";

export interface AllowedUserRow {
  userId: number;
  username: string | null;
  status: AllowedUserStatus;
  addedBy: number | null;
  addedAt: number;
  pendingNotifiedAt: number | null;
  notes: string | null;
}

export const STATUS_EMOJI: Record<AllowedUserStatus, string> = {
  allowed: "✓",
  blocked: "⛔",
  pending: "⏳",
};
