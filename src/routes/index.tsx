import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, X } from "lucide-react";

import { addTask, countPending, removeTask, toggleTask, type Task } from "@/lib/todo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — A simple to-do list" },
      {
        name: "description",
        content: "A clean, minimal to-do list: add tasks, check them off, and see what's left.",
      },
      { property: "og:title", content: "Today — A simple to-do list" },
      {
        property: "og:description",
        content: "A clean, minimal to-do list: add tasks, check them off, and see what's left.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const pending = countPending(tasks);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setTasks((prev) => addTask(prev, draft, crypto.randomUUID()));
    setDraft("");
  }

  return (
    <main className="min-h-screen bg-background px-5 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-10 flex items-end justify-between gap-4">
          <h1 className="font-display text-6xl leading-none text-foreground">Today</h1>
          <p className="pb-1 text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-primary">{pending}</span>{" "}
            {pending === 1 ? "task" : "tasks"} pending
          </p>
        </header>

        <form onSubmit={handleSubmit} className="todo-input-shell mb-6">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task…"
            aria-label="New task"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Add task"
            className="m-1.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </form>

        {tasks.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing here yet. Add your first task above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="todo-row group flex items-center gap-3 py-3.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={`Mark "${task.title}" as ${task.done ? "not done" : "done"}`}
                  onClick={() => setTasks((prev) => toggleTask(prev, task.id))}
                  className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${
                    task.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-primary"
                  }`}
                >
                  {task.done && <Check className="size-3" strokeWidth={3} />}
                </button>
                <span
                  className={`flex-1 break-words transition ${
                    task.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {task.title}
                </span>
                <button
                  type="button"
                  aria-label={`Delete "${task.title}"`}
                  onClick={() => setTasks((prev) => removeTask(prev, task.id))}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
