const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TITLE_MAX = 500;
export const DESCRIPTION_MAX = 5000;

export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type TaskPatch = { title?: string; description?: string; date?: string; done?: boolean };

/** Validates the editable task fields. Returns an error message or the cleaned patch. */
export function parsePatch(body: unknown): { patch: TaskPatch } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const patch: TaskPatch = {};
  if ("title" in b) {
    if (typeof b.title !== "string") return { error: "Invalid title" };
    const title = b.title.trim();
    if (!title || title.length > TITLE_MAX) return { error: "Invalid title" };
    patch.title = title;
  }
  if ("description" in b) {
    if (typeof b.description !== "string") return { error: "Invalid description" };
    const description = b.description.trim();
    if (description.length > DESCRIPTION_MAX) return { error: "Description is too long" };
    patch.description = description;
  }
  if ("date" in b) {
    if (!isDate(b.date)) return { error: "Invalid date" };
    patch.date = b.date;
  }
  if ("done" in b) {
    if (typeof b.done !== "boolean") return { error: "Invalid done" };
    patch.done = b.done;
  }
  return { patch };
}
