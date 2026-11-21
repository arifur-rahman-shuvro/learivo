import { reportError } from "./monitoring.ts";

/**
 * Runtime check of rows read from the database. TypeScript only trusts the type we wrote down;
 * this confirms the row really has the fields and kinds of value the code relies on, so a row
 * that is missing something (an edit made by hand in the dashboard, an old migration) stops
 * with a clear message instead of failing later inside a screen.
 *
 * Only the fields the app reads are checked, and a field the app tolerates as missing is marked
 * optional. The error names the table and field, never the value.
 */
export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "numeric" // a number, or a numeric string (the database returns numeric columns as strings)
  | readonly string[]; // one of these exact strings

/** Add "?" to a kind in the spec by wrapping it: `opt("string")` accepts null or missing. */
export interface Optional {
  optional: FieldKind;
}
export const opt = (kind: FieldKind): Optional => ({ optional: kind });

export type RowSpec = Record<string, FieldKind | Optional>;

export class UnexpectedDataError extends Error {
  constructor(
    readonly table: string,
    readonly field: string,
  ) {
    super("Your data came back in a shape this app does not understand. Reload and try again.");
    this.name = "UnexpectedDataError";
  }
}

function matches(value: unknown, kind: FieldKind): boolean {
  if (Array.isArray(kind)) return typeof value === "string" && kind.includes(value);
  switch (kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "numeric":
      return (
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
      );
    default:
      return false;
  }
}

/** Returns the row unchanged when it fits the spec; otherwise reports and throws. */
export function checkRow<T>(table: string, row: unknown, spec: RowSpec): T {
  if (typeof row !== "object" || row === null) {
    return fail(table, "(row)");
  }
  const r = row as Record<string, unknown>;
  for (const [field, kind] of Object.entries(spec)) {
    const v = r[field];
    if (typeof kind === "object" && !Array.isArray(kind) && "optional" in kind) {
      if (v !== null && v !== undefined && !matches(v, kind.optional)) return fail(table, field);
    } else if (!matches(v, kind as FieldKind)) {
      return fail(table, field);
    }
  }
  return row as T;
}

export function checkRows<T>(table: string, rows: unknown, spec: RowSpec): T[] {
  if (rows === null || rows === undefined) return [];
  if (!Array.isArray(rows)) return fail(table, "(list)");
  return rows.map((r) => checkRow<T>(table, r, spec));
}

function fail(table: string, field: string): never {
  const e = new UnexpectedDataError(table, field);
  // Names only: never the value, which could be the student's text.
  reportError(new Error(`Unexpected data from ${table}.${field}`));
  throw e;
}
