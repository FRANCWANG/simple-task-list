import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, X } from "lucide-react";

import { addTask, countPending, pendingLabel, removeTask, toggleTask, type Task } from "@/lib/todo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Uma lista de tarefas simples" },
      {
        name: "description",
        content: "Uma lista de tarefas limpa e minimalista: adicione tarefas, marque como concluídas e veja o que falta.",
      },
      { property: "og:title", content: "Hoje — Uma lista de tarefas simples" },
      {
        property: "og:description",
        content: "Uma lista de tarefas limpa e minimalista: adicione tarefas, marque como concluídas e veja o que falta.",
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
          <h1 className="font-display text-6xl leading-none text-foreground">Hoje</h1>
          <p className="pb-1 text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-primary">{pending}</span> {pendingLabel(pending)}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="todo-input-shell mb-6">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Adicionar uma tarefa…"
            aria-label="Nova tarefa"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Adicionar tarefa"
            className="m-1.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </form>

        {tasks.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nada por aqui ainda. Adicione sua primeira tarefa acima.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="todo-row group flex items-center gap-3 py-3.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={`Marcar "${task.title}" como ${task.done ? "não concluída" : "concluída"}`}
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
                  aria-label={`Excluir "${task.title}"`}
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
