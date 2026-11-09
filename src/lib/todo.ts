export interface Task {
  id: string;
  title: string;
  done: boolean;
}

/** Returns a new list with the task appended. Blank titles are ignored. */
export function addTask(tasks: readonly Task[], title: string, id: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return [...tasks];
  return [...tasks, { id, title: trimmed, done: false }];
}

/** Returns a new list with the matching task's `done` flag flipped. */
export function toggleTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

/** Returns a new list without the matching task. */
export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

/** Number of tasks not yet marked as done. */
export function countPending(tasks: readonly Task[]): number {
  return tasks.reduce((count, task) => (task.done ? count : count + 1), 0);
}

/** pt-BR label that follows the pending count: "1 tarefa pendente", "3 tarefas pendentes". */
export function pendingLabel(count: number): string {
  return count === 1 ? "tarefa pendente" : "tarefas pendentes";
}

export type TaskFilter = "all" | "pending" | "done";

/** Returns a new list with only the tasks that match the filter. */
export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  if (filter === "pending") return tasks.filter((task) => !task.done);
  if (filter === "done") return tasks.filter((task) => task.done);
  return [...tasks];
}

/** Returns a new list with the matching task renamed. Blank titles leave the task unchanged. */
export function editTask(tasks: readonly Task[], id: string, title: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return [...tasks];
  return tasks.map((task) => (task.id === id ? { ...task, title: trimmed } : task));
}

/** Returns a new list without the tasks marked as done. */
export function clearCompleted(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => !task.done);
}

/** Parses tasks saved as JSON. Invalid data yields an empty list; malformed entries are dropped. */
export function parseStoredTasks(raw: string | null): Task[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is Task =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.done === "boolean",
  ).map(({ id, title, done }) => ({ id, title, done }));
}
