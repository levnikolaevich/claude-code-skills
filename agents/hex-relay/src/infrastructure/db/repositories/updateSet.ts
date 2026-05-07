export function buildUpdateSet<T extends object>(
  fields: Partial<T>,
  fieldMap: Record<keyof T, string>
): { clause: string; values: unknown[] } | null {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return null;
  const clauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of entries) {
    const column = fieldMap[key as keyof T];
    if (!column) throw new Error(`unknown update field: ${key}`);
    clauses.push(`${column}=?`);
    values.push(value);
  }
  return { clause: clauses.join(", "), values };
}
