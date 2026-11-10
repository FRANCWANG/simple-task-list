import { describe, expect, it } from "vitest";

import {
  addReadingTime,
  attachReading,
  attachmentKind,
  computeProgress,
  createReading,
  detachReading,
  ERROR_EMPTY,
  ERROR_TOO_LARGE,
  ERROR_UNSUPPORTED,
  hasReachedEnd,
  isReadingComplete,
  markAutoCompleted,
  MAX_ATTACHMENT_BYTES,
  parseStoredReadings,
  pruneReadings,
  readingLabel,
  recordProgress,
  shouldAutoComplete,
  validateAttachment,
  type ReadingMap,
  type ReadingRecord,
} from "./reading";

const pdf = (over: Partial<ReadingRecord> = {}): ReadingRecord => ({
  ...createReading("livro.pdf", "pdf", 1000),
  ...over,
});
const text = (over: Partial<ReadingRecord> = {}): ReadingRecord => ({
  ...createReading("notas.md", "text", 100),
  ...over,
});

describe("attachmentKind / validateAttachment", () => {
  it("detects PDF, TXT and MD by extension or MIME type", () => {
    expect(attachmentKind("Livro.PDF", "")).toBe("pdf");
    expect(attachmentKind("a.txt", "")).toBe("text");
    expect(attachmentKind("a.md", "")).toBe("text");
    expect(attachmentKind("arquivo", "application/pdf")).toBe("pdf");
    expect(attachmentKind("foto.png", "image/png")).toBeNull();
    expect(attachmentKind("doc.docx", "")).toBeNull();
  });

  it("accepts a supported file up to exactly 10 MB", () => {
    expect(
      validateAttachment({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES, type: "application/pdf" }),
    ).toEqual({ ok: true, kind: "pdf" });
  });

  it("rejects files larger than 10 MB with a pt-BR message", () => {
    expect(validateAttachment({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES + 1, type: "" })).toEqual(
      { ok: false, error: ERROR_TOO_LARGE },
    );
    expect(ERROR_TOO_LARGE).toContain("10 MB");
  });

  it("rejects unsupported formats and empty files", () => {
    expect(validateAttachment({ name: "foto.png", size: 10, type: "image/png" })).toEqual({
      ok: false,
      error: ERROR_UNSUPPORTED,
    });
    expect(validateAttachment({ name: "a.txt", size: 0, type: "text/plain" })).toEqual({
      ok: false,
      error: ERROR_EMPTY,
    });
  });
});

describe("computeProgress", () => {
  it("uses page over total pages for PDFs", () => {
    expect(computeProgress({ kind: "pdf", page: 2, totalPages: 5 })).toBe(40);
    expect(computeProgress({ kind: "pdf", page: 5, totalPages: 5 })).toBe(100);
    expect(computeProgress({ kind: "pdf", page: 1, totalPages: 0 })).toBe(0);
  });

  it("uses the scroll percentage for text", () => {
    expect(
      computeProgress({ kind: "text", scrollTop: 400, scrollHeight: 1500, clientHeight: 500 }),
    ).toBe(40);
    expect(
      computeProgress({ kind: "text", scrollTop: 1000, scrollHeight: 1500, clientHeight: 500 }),
    ).toBe(100);
  });

  it("treats text that fits on screen as fully read", () => {
    expect(
      computeProgress({ kind: "text", scrollTop: 0, scrollHeight: 300, clientHeight: 500 }),
    ).toBe(100);
  });
});

describe("recordProgress", () => {
  it("keeps the furthest PDF page reached", () => {
    let map: ReadingMap = { t: pdf() };
    map = recordProgress(map, "t", { kind: "pdf", page: 4, totalPages: 10 });
    map = recordProgress(map, "t", { kind: "pdf", page: 2, totalPages: 10 });
    expect(map["t"]).toMatchObject({ furthestPage: 4, totalPages: 10, percent: 40 });
  });

  it("keeps the highest text scroll percentage", () => {
    let map: ReadingMap = { t: text() };
    map = recordProgress(map, "t", {
      kind: "text",
      scrollTop: 600,
      scrollHeight: 1100,
      clientHeight: 100,
    });
    map = recordProgress(map, "t", {
      kind: "text",
      scrollTop: 0,
      scrollHeight: 1100,
      clientHeight: 100,
    });
    expect(map["t"]?.percent).toBe(60);
  });

  it("does not mutate the map and returns it unchanged for unknown tasks", () => {
    const map: ReadingMap = { t: pdf() };
    const next = recordProgress(map, "t", { kind: "pdf", page: 1, totalPages: 2 });
    expect(map["t"]?.furthestPage).toBe(0);
    expect(next).not.toBe(map);
    expect(recordProgress(map, "x", { kind: "pdf", page: 1, totalPages: 2 })).toBe(map);
  });
});

describe("isReadingComplete", () => {
  it("PDF: needs the last page AND at least 3 seconds open", () => {
    expect(
      isReadingComplete(pdf({ furthestPage: 10, totalPages: 10, percent: 100, openMs: 3_000 })),
    ).toBe(true);
    expect(
      isReadingComplete(pdf({ furthestPage: 10, totalPages: 10, percent: 100, openMs: 2_999 })),
    ).toBe(false);
    expect(
      isReadingComplete(pdf({ furthestPage: 29, totalPages: 30, percent: 97, openMs: 60_000 })),
    ).toBe(false);
  });

  it("text: needs at least 95% scrolled AND at least 3 seconds open", () => {
    expect(isReadingComplete(text({ percent: 95, openMs: 3_000 }))).toBe(true);
    expect(isReadingComplete(text({ percent: 94, openMs: 60_000 }))).toBe(false);
    expect(isReadingComplete(text({ percent: 100, openMs: 2_999 }))).toBe(false);
    expect(hasReachedEnd(text({ percent: 95 }))).toBe(true);
  });
});

describe("shouldAutoComplete", () => {
  const done = text({ percent: 100, openMs: 12_000 });
  it("completes a pending task once the reading is complete", () => {
    expect(shouldAutoComplete(done, false)).toBe(true);
  });
  it("does not act on tasks already done or already auto-completed (manual uncheck is respected)", () => {
    expect(shouldAutoComplete(done, true)).toBe(false);
    expect(shouldAutoComplete({ ...done, autoCompleted: true }, false)).toBe(false);
    expect(markAutoCompleted({ t: done }, "t")["t"]?.autoCompleted).toBe(true);
  });
});

describe("addReadingTime", () => {
  it("accumulates time across sessions and ignores invalid values", () => {
    let map: ReadingMap = { t: text() };
    map = addReadingTime(map, "t", 6_000);
    map = addReadingTime(map, "t", 4_000);
    map = addReadingTime(map, "t", -50);
    expect(map["t"]?.openMs).toBe(10_000);
  });
});

describe("readingLabel", () => {
  it("formats the pt-BR progress label", () => {
    expect(readingLabel(40)).toBe("Leitura: 40%");
    expect(readingLabel(0)).toBe("Leitura: 0%");
  });
});

describe("attach / detach / prune", () => {
  it("attaches, detaches and prunes records for deleted tasks", () => {
    const map = attachReading({}, "a", text());
    expect(Object.keys(attachReading(map, "b", pdf()))).toEqual(["a", "b"]);
    expect(detachReading(map, "a")).toEqual({});
    expect(map["a"]).toBeDefined();
    expect(Object.keys(pruneReadings({ a: text(), b: pdf() }, ["b"]))).toEqual(["b"]);
  });
});

describe("parseStoredReadings", () => {
  it("restores valid records and drops malformed ones", () => {
    const raw = JSON.stringify({ a: text({ percent: 40 }), b: { fileName: 1 } });
    expect(parseStoredReadings(raw)).toEqual({ a: text({ percent: 40 }) });
  });
  it("returns an empty map for missing or invalid data", () => {
    expect(parseStoredReadings(null)).toEqual({});
    expect(parseStoredReadings("{oops")).toEqual({});
    expect(parseStoredReadings("[]")).toEqual({});
  });
});
