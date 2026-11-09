import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, X } from "lucide-react";

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
  type TaskFilter,
} from "@/lib/todo";

const STORAGE_KEY = "hoje.tasks";

const FILTERS: { value: TaskFilter; label: string; empty: string }[] = [
  { value: "all", label: "Todas", empty: "Nada por aqui ainda. Adicione sua primeira tarefa acima." },
  { value: "pending", label: "Pendentes", empty: "Nenhuma tarefa pendente." },
  { value: "done", label: "Concluídas", empty: "Nenhuma tarefa concluída." },
];

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
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const pending = countPending(tasks);
  const completed = tasks.length - pending;
  const visible = filterTasks(tasks, filter);
  const emptyMessage = FILTERS.find((f) => f.value === filter)?.empty ?? "";

  useEffect(() => {
    try {
      setTasks(parseStoredTasks(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      // Storage unavailable (e.g. private mode): start with an empty list.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Ignore quota or availability errors.
    }
  }, [tasks, loaded]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setTasks((prev) => addTask(prev, draft, crypto.randomUUID()));
    setDraft("");
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditDraft(task.title);
  }

  function commitEdit() {
    if (editingId === null) return;
    const id = editingId;
    setTasks((prev) => editTask(prev, id, editDraft));
    setEditingId(null);
  }

  function handleEditKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commitEdit();
    if (event.key === "Escape") setEditingId(null);
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

        {tasks.length > 0 && (
          <div className="mb-2 flex items-center justify-between gap-3">
            <div role="group" aria-label="Filtrar tarefas" className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    filter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTasks((prev) => clearCompleted(prev))}
              disabled={completed === 0}
              className="text-sm text-muted-foreground transition hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
            >
              Limpar concluídas
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((task) => (
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
                {editingId === task.id ? (
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKey}
                    aria-label={`Editar "${task.title}"`}
                    className="min-w-0 flex-1 border-b border-primary bg-transparent text-foreground outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEditing(task)}
                    title="Clique duas vezes para editar"
                    className={`flex-1 cursor-text break-words transition ${
                      task.done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                )}
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
