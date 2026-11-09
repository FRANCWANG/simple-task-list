import { describe, expect, it } from "vitest";

import { addTask, countPending, pendingLabel, removeTask, toggleTask, type Task } from "./todo";

const sample: Task[] = [
  { id: "a", title: "Buy milk", done: false },
  { id: "b", title: "Call mom", done: true },
];

describe("addTask", () => {
  it("appends a new pending task with a trimmed title", () => {
    expect(addTask(sample, "  Walk dog  ", "c")).toEqual([
      ...sample,
      { id: "c", title: "Walk dog", done: false },
    ]);
  });

  it("ignores blank titles", () => {
    expect(addTask(sample, "   ", "c")).toEqual(sample);
  });

  it("does not mutate the original list", () => {
    addTask(sample, "Walk dog", "c");
    expect(sample).toHaveLength(2);
  });
});

describe("toggleTask", () => {
  it("flips only the matching task", () => {
    const result = toggleTask(sample, "a");
    expect(result.map((t) => t.done)).toEqual([true, true]);
    expect(toggleTask(result, "a").map((t) => t.done)).toEqual([false, true]);
    expect(sample.map((t) => t.done)).toEqual([false, true]);
  });
});

describe("removeTask", () => {
  it("removes only the matching task", () => {
    expect(removeTask(sample, "a")).toEqual([sample[1]]);
    expect(sample).toHaveLength(2);
  });
});

describe("countPending", () => {
  it("counts tasks that are not done", () => {
    expect(countPending(sample)).toBe(1);
    expect(countPending([])).toBe(0);
    expect(countPending(toggleTask(sample, "b"))).toBe(2);
  });
});

describe("pendingLabel", () => {
  it("uses singular for exactly one pending task", () => {
    expect(`1 ${pendingLabel(1)}`).toBe("1 tarefa pendente");
  });

  it("uses plural for zero or many pending tasks", () => {
    expect(`3 ${pendingLabel(3)}`).toBe("3 tarefas pendentes");
    expect(`0 ${pendingLabel(0)}`).toBe("0 tarefas pendentes");
  });
});
