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
