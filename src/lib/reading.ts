/**
 * Pure reading logic: attachment validation, reading progress and automatic completion.
 * Reading data is kept per task id, separately from `Task`, so `todo.ts` stays unchanged.
 */

export type ReadingKind = "pdf" | "text";

export interface ReadingRecord {
  fileName: string;
  kind: ReadingKind;
  size: number;
  /** Furthest progress reached, 0–100. Never goes down. */
  percent: number;
  /** PDF only: furthest page reached (1-based). 0 when unknown or for text files. */
  furthestPage: number;
  /** PDF only: total number of pages. 0 when unknown or for text files. */
  totalPages: number;
  /** Total time the reader has been open for this file, in milliseconds. */
  openMs: number;
  /** True once the task was completed automatically, so it happens only once. */
  autoCompleted: boolean;
}

export type ReadingMap = Readonly<Record<string, ReadingRecord>>;

export type ReadingPosition =
  | { kind: "pdf"; page: number; totalPages: number }
  | { kind: "text"; scrollTop: number; scrollHeight: number; clientHeight: number };

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Minimum total time with the reader open before a reading counts as complete. */
export const MIN_READING_MS = 3_000;
/** Scroll percentage that counts as "reached the end" for text files. */
export const TEXT_END_PERCENT = 95;

export const ATTACHMENT_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

export const ERROR_UNSUPPORTED = "Formato não suportado. Escolha um arquivo PDF, TXT ou MD.";
export const ERROR_TOO_LARGE = "Arquivo muito grande. O limite é de 10 MB.";
export const ERROR_EMPTY = "Este arquivo está vazio.";

/** Detects the reader kind from the file name (preferred) or MIME type. */
export function attachmentKind(fileName: string, mimeType: string): ReadingKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (fileName.includes(".")) {
    if (ext === "pdf") return "pdf";
    if (ext === "txt" || ext === "md") return "text";
  }
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/plain" || mimeType === "text/markdown") return "text";
  return null;
}

export type AttachmentCheck = { ok: true; kind: ReadingKind } | { ok: false; error: string };

/** Validates a file before attaching it: PDF, TXT or MD, not empty, at most 10 MB. */
export function validateAttachment(file: {
  name: string;
  size: number;
  type: string;
}): AttachmentCheck {
  const kind = attachmentKind(file.name, file.type);
  if (!kind) return { ok: false, error: ERROR_UNSUPPORTED };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: ERROR_TOO_LARGE };
  if (file.size <= 0) return { ok: false, error: ERROR_EMPTY };
  return { ok: true, kind };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Progress (0–100) for a position: PDF page over total pages, or text scroll percentage. */
export function computeProgress(position: ReadingPosition): number {
  if (position.kind === "pdf") {
    if (position.totalPages <= 0) return 0;
    return clampPercent((position.page / position.totalPages) * 100);
  }
  const scrollable = position.scrollHeight - position.clientHeight;
  if (scrollable <= 1) return position.scrollHeight > 0 ? 100 : 0;
  return clampPercent((position.scrollTop / scrollable) * 100);
}

/** True when the end was reached: last PDF page, or text scrolled to at least 95%. */
export function hasReachedEnd(record: ReadingRecord): boolean {
  if (record.kind === "pdf")
    return record.totalPages > 0 && record.furthestPage >= record.totalPages;
  return record.percent >= TEXT_END_PERCENT;
}

/** Complete when the end was reached AND the reader was open at least 3 seconds in total. */
export function isReadingComplete(record: ReadingRecord): boolean {
  return hasReachedEnd(record) && record.openMs >= MIN_READING_MS;
}

/** The task should be completed automatically (once) when the reading is complete and the task is pending. */
export function shouldAutoComplete(record: ReadingRecord, taskDone: boolean): boolean {
  return !taskDone && !record.autoCompleted && isReadingComplete(record);
}

/** pt-BR progress label shown on the task, e.g. "Leitura: 40%". */
export function readingLabel(percent: number): string {
  return `Leitura: ${clampPercent(percent)}%`;
}

export function createReading(fileName: string, kind: ReadingKind, size: number): ReadingRecord {
  return {
    fileName,
    kind,
    size,
    percent: 0,
    furthestPage: 0,
    totalPages: 0,
    openMs: 0,
    autoCompleted: false,
  };
}

/** Returns a new map with the record attached to the task (replacing any previous one). */
export function attachReading(map: ReadingMap, taskId: string, record: ReadingRecord): ReadingMap {
  return { ...map, [taskId]: record };
}

/** Returns a new map without the task's record. */
export function detachReading(map: ReadingMap, taskId: string): ReadingMap {
  if (!(taskId in map)) return map;
  const next = { ...map };
  delete next[taskId];
  return next;
}

/** Keeps only the records whose task still exists. */
export function pruneReadings(map: ReadingMap, taskIds: readonly string[]): ReadingMap {
  const keep = new Set(taskIds);
  const ids = Object.keys(map);
  if (ids.every((id) => keep.has(id))) return map;
  return Object.fromEntries(Object.entries(map).filter(([id]) => keep.has(id)));
}

function update(
  map: ReadingMap,
  taskId: string,
  change: (r: ReadingRecord) => ReadingRecord,
): ReadingMap {
  const current = map[taskId];
  if (!current) return map;
  const next = change(current);
  const same = (Object.keys(next) as (keyof ReadingRecord)[]).every(
    (key) => next[key] === current[key],
  );
  return same ? map : { ...map, [taskId]: next };
}

/** Records a reader position, keeping the furthest progress reached. */
export function recordProgress(
  map: ReadingMap,
  taskId: string,
  position: ReadingPosition,
): ReadingMap {
  return update(map, taskId, (r) => {
    if (position.kind === "text")
      return { ...r, percent: Math.max(r.percent, computeProgress(position)) };
    const totalPages = Math.max(0, Math.floor(position.totalPages));
    const furthestPage = Math.min(totalPages, Math.max(r.furthestPage, Math.floor(position.page)));
    const percent = Math.max(
      r.percent,
      computeProgress({ kind: "pdf", page: furthestPage, totalPages }),
    );
    return { ...r, totalPages, furthestPage, percent };
  });
}

/** Adds time spent with the reader open. Negative or invalid values are ignored. */
export function addReadingTime(map: ReadingMap, taskId: string, ms: number): ReadingMap {
  if (!Number.isFinite(ms) || ms <= 0) return map;
  return update(map, taskId, (r) => ({ ...r, openMs: r.openMs + ms }));
}

export function markAutoCompleted(map: ReadingMap, taskId: string): ReadingMap {
  return update(map, taskId, (r) => ({ ...r, autoCompleted: true }));
}

function isRecord(value: unknown): value is ReadingRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r["fileName"] === "string" &&
    (r["kind"] === "pdf" || r["kind"] === "text") &&
    typeof r["size"] === "number" &&
    typeof r["percent"] === "number" &&
    typeof r["furthestPage"] === "number" &&
    typeof r["totalPages"] === "number" &&
    typeof r["openMs"] === "number" &&
    typeof r["autoCompleted"] === "boolean"
  );
}

/** Parses reading data saved as JSON. Invalid data yields an empty map; malformed entries are dropped. */
export function parseStoredReadings(raw: string | null): ReadingMap {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
  const result: Record<string, ReadingRecord> = {};
  for (const [id, value] of Object.entries(data)) {
    if (!isRecord(value)) continue;
    const { fileName, kind, size, percent, furthestPage, totalPages, openMs, autoCompleted } =
      value;
    result[id] = {
      fileName,
      kind,
      size,
      percent: clampPercent(percent),
      furthestPage,
      totalPages,
      openMs,
      autoCompleted,
    };
  }
  return result;
}
