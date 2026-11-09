import { describe, expect, it } from "vitest";

import {
  addTask,
  clearCompleted,
  countPending,
  editTask,
  filterTasks,
  parseStoredTasks,
  pendingLabel,
  removeTask,
  toggleTask,
  type Task,
} from "./todo";

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

describe("filterTasks", () => {
  it("'all' returns every task", () => {
    expect(filterTasks(sample, "all")).toEqual(sample);
  });

  it("'pending' returns only tasks not done", () => {
    expect(filterTasks(sample, "pending")).toEqual([sample[0]]);
  });

  it("'done' returns only completed tasks", () => {
    expect(filterTasks(sample, "done")).toEqual([sample[1]]);
  });

  it("does not mutate the original list", () => {
    filterTasks(sample, "done");
    expect(sample).toHaveLength(2);
  });
});

describe("editTask", () => {
  it("renames only the matching task with a trimmed title", () => {
    expect(editTask(sample, "a", "  Buy bread ")).toEqual([
      { id: "a", title: "Buy bread", done: false },
      sample[1],
    ]);
    expect(sample[0]?.title).toBe("Buy milk");
  });

  it("keeps the original title when the new one is blank", () => {
    expect(editTask(sample, "a", "   ")).toEqual(sample);
  });
});

describe("clearCompleted", () => {
  it("removes every completed task and keeps pending ones", () => {
    const tasks: Task[] = [...sample, { id: "c", title: "Read", done: true }];
    expect(clearCompleted(tasks)).toEqual([sample[0]]);
    expect(tasks).toHaveLength(3);
  });
});

describe("parseStoredTasks", () => {
  it("restores tasks saved with JSON.stringify", () => {
    expect(parseStoredTasks(JSON.stringify(sample))).toEqual(sample);
  });

  it("returns an empty list for missing or invalid data", () => {
    expect(parseStoredTasks(null)).toEqual([]);
    expect(parseStoredTasks("not json")).toEqual([]);
    expect(parseStoredTasks('{"id":"a"}')).toEqual([]);
  });

  it("drops malformed entries", () => {
    const raw = JSON.stringify([sample[0], { id: "x", title: 1, done: false }, null]);
    expect(parseStoredTasks(raw)).toEqual([sample[0]]);
  });
});
