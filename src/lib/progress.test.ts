import { describe, expect, it } from "vitest";

import { completedLabel, progressPercent } from "./progress";

describe("completedLabel", () => {
  it("uses the plural when there are several tasks", () => {
    expect(completedLabel(1, 3)).toBe("1 de 3 concluídas");
  });

  it("uses the singular when there is exactly one task", () => {
    expect(completedLabel(0, 1)).toBe("0 de 1 concluída");
  });
});

describe("progressPercent", () => {
  it("rounds to a whole percentage", () => {
    expect(progressPercent(1, 3)).toBe(33);
  });

  it("is 0 when there are no tasks", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("is 100 when every task is done", () => {
    expect(progressPercent(4, 4)).toBe(100);
  });
});
