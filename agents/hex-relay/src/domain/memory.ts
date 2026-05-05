export type MemoryCategory =
  | "operator_pref"
  | "project_fact"
  | "incident"
  | "decision"
  | "todo"
  | (string & {});

export interface MemoryRow {
  id: number;
  tsCreated: number;
  tsUsed: number | null;
  category: MemoryCategory;
  text: string;
  tags: string | null;
  source: string | null;
  expiresAt: number | null;
}
