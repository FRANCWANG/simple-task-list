import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleDashed,
  FileText,
  Leaf,
  Paperclip,
  Plus,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { ReaderPanel } from "@/components/ReaderPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { deleteAttachment, saveAttachment } from "@/lib/attachment-store";
import { completedLabel, progressPercent } from "@/lib/progress";
import {
  ATTACHMENT_ACCEPT,
  addReadingTime,
  attachReading,
  createReading,
  detachReading,
  markAutoCompleted,
  parseStoredReadings,
  pruneReadings,
  readingLabel,
  recordProgress,
  shouldAutoComplete,
  validateAttachment,
  type ReadingMap,
  type ReadingPosition,
} from "@/lib/reading";
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
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hoje.tasks";
const READING_KEY = "hoje.reading";
const NOTICE_MS = 4500;
const AUTO_DONE_MESSAGE = "Leitura concluída! Tarefa movida para Concluídas.";
/** Matches the .todo-row-leaving transition in styles.css. */
const EXIT_MS = 380;

type FilterOption = { value: TaskFilter; label: string; empty: string; icon: LucideIcon };

/** Non-empty tuple type, so FILTERS[0] is always defined as the fallback. */
const FILTERS: readonly [FilterOption, ...FilterOption[]] = [
  {
    value: "all",
    label: "Todas",
    empty: "Nada por aqui ainda. Adicione sua primeira tarefa acima.",
    icon: Leaf,
  },
  { value: "pending", label: "Pendentes", empty: "Nenhuma tarefa pendente.", icon: Sparkles },
  { value: "done", label: "Concluídas", empty: "Nenhuma tarefa concluída.", icon: CircleDashed },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Uma lista de tarefas simples" },
      {
        name: "description",
        content:
          "Uma lista de tarefas limpa e minimalista: adicione tarefas, marque como concluídas e veja o que falta.",
      },
      { property: "og:title", content: "Hoje — Uma lista de tarefas simples" },
      {
        property: "og:description",
        content:
          "Uma lista de tarefas limpa e minimalista: adicione tarefas, marque como concluídas e veja o que falta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Notice = { id: number; text: string; tone: "info" | "error" };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Index() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<number[]>([]);
  const [readings, setReadings] = useState<ReadingMap>({});
  const [readerId, setReaderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<string | null>(null);
  const readerTask = tasks.find((task) => task.id === readerId);

  const pending = countPending(tasks);
  const completed = tasks.length - pending;
  const percent = progressPercent(completed, tasks.length);
  const visible = filterTasks(tasks, filter);
  const activeFilter = FILTERS.find((f) => f.value === filter) ?? FILTERS[0];
  const EmptyIcon = activeFilter.icon;

  useEffect(() => {
    try {
      const storedTasks = parseStoredTasks(window.localStorage.getItem(STORAGE_KEY));
      setTasks(storedTasks);
      setReadings(
        pruneReadings(
          parseStoredReadings(window.localStorage.getItem(READING_KEY)),
          storedTasks.map((task) => task.id),
        ),
      );
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

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(READING_KEY, JSON.stringify(readings));
    } catch {
      // Ignore quota or availability errors.
    }
  }, [readings, loaded]);

  // Automatic completion: reading finished (end reached + 10 s open) on a pending task.
  useEffect(() => {
    if (!loaded) return;
    for (const task of tasks) {
      const record = readings[task.id];
      if (!record || !shouldAutoComplete(record, task.done)) continue;
      const id = task.id;
      setTasks((prev) => (prev.some((t) => t.id === id && !t.done) ? toggleTask(prev, id) : prev));
      setReadings((prev) => markAutoCompleted(prev, id));
      // With the reader open, the panel itself shows the message.
      if (readerId !== id) showNotice(AUTO_DONE_MESSAGE, "info");
    }
  }, [tasks, readings, loaded, readerId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach((t) => window.clearTimeout(t));
  }, []);

  /** Plays the exit animation on the given rows, then applies the removal. */
  function animateOut(ids: string[], commit: () => void) {
    if (ids.length === 0) return;
    setLeaving((prev) => new Set([...prev, ...ids]));
    const timer = window.setTimeout(
      () => {
        commit();
        setLeaving((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      },
      prefersReducedMotion() ? 0 : EXIT_MS,
    );
    timers.current.push(timer);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setTasks((prev) => addTask(prev, draft, crypto.randomUUID()));
    setDraft("");
  }

  function showNotice(text: string, tone: Notice["tone"]) {
    setNotice({ id: Date.now(), text, tone });
  }

  /** Forgets reading data and stored files for tasks that are being removed. */
  function dropAttachments(ids: string[]) {
    setReadings((prev) => ids.reduce((map, id) => detachReading(map, id), prev));
    ids.forEach((id) => void deleteAttachment(id).catch(() => undefined));
    if (readerId !== null && ids.includes(readerId)) setReaderId(null);
  }

  function handleRemove(id: string) {
    animateOut([id], () => {
      setTasks((prev) => removeTask(prev, id));
      dropAttachments([id]);
    });
  }

  function handleClearCompleted() {
    const doneIds = tasks.filter((task) => task.done).map((task) => task.id);
    animateOut(doneIds, () => {
      setTasks((prev) => clearCompleted(prev));
      dropAttachments(doneIds);
    });
  }

  function chooseFile(taskId: string) {
    attachTarget.current = taskId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const taskId = attachTarget.current;
    event.target.value = "";
    attachTarget.current = null;
    if (!file || !taskId) return;
    const check = validateAttachment(file);
    if (!check.ok) {
      showNotice(check.error, "error");
      return;
    }
    try {
      await saveAttachment(taskId, file);
    } catch {
      showNotice(
        "Não foi possível salvar o arquivo neste navegador. Tente um arquivo menor.",
        "error",
      );
      return;
    }
    setReadings((prev) =>
      attachReading(prev, taskId, createReading(file.name, check.kind, file.size)),
    );
  }

  function handleRemoveAttachment(taskId: string) {
    setReaderId(null);
    setReadings((prev) => detachReading(prev, taskId));
    void deleteAttachment(taskId).catch(() => undefined);
  }

  function handleReaderPosition(taskId: string, position: ReadingPosition) {
    setReadings((prev) => recordProgress(prev, taskId, position));
  }

  function handleReaderTime(taskId: string, ms: number) {
    setReadings((prev) => addReadingTime(prev, taskId, ms));
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
    <main className="min-h-screen px-5 pb-20 pt-12 sm:pt-24">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-6xl leading-none tracking-tight text-foreground sm:text-7xl">
              Hoje
            </h1>
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-primary">{pending}</span> {pendingLabel(pending)}
            </p>
          </div>
          <ThemeToggle />
        </header>

        {tasks.length > 0 && (
          <div className="fade-in mb-8 flex items-center gap-4">
            <div
              role="progressbar"
              aria-label="Progresso"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={completedLabel(completed, tasks.length)}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {completedLabel(completed, tasks.length)}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="todo-input-shell mb-5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Adicionar uma tarefa…"
            aria-label="Nova tarefa"
            className="min-w-0 flex-1 bg-transparent py-3.5 pl-6 pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground/80"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Adicionar tarefa"
            className="soft-focus m-1.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition duration-300 hover:scale-105 hover:opacity-90 active:scale-95 disabled:scale-100 disabled:opacity-30"
          >
            <Plus className="size-4" strokeWidth={2.25} />
          </button>
        </form>

        <section className="rounded-3xl border border-border bg-card p-2 shadow-soft sm:p-3">
          {tasks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 pt-1">
              <div
                role="group"
                aria-label="Filtrar tarefas"
                className="flex gap-1 rounded-full bg-muted p-1"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "soft-focus rounded-full px-3.5 py-1.5 text-sm transition-all duration-300",
                      filter === f.value
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleClearCompleted}
                disabled={completed === 0}
                className="soft-focus rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              >
                Limpar concluídas
              </button>
            </div>
          )}

          {visible.length === 0 ? (
            <div
              key={filter}
              className="fade-in flex flex-col items-center gap-4 px-6 py-14 text-center"
            >
              <div className="float-soft grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
                <EmptyIcon className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <p className="max-w-[17rem] text-sm leading-relaxed text-muted-foreground">
                {activeFilter.empty}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {visible.map((task) => (
                <li
                  key={task.id}
                  className={cn("todo-row", leaving.has(task.id) && "todo-row-leaving")}
                >
                  <div className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-muted/60">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={task.done}
                      aria-label={`Marcar "${task.title}" como ${task.done ? "não concluída" : "concluída"}`}
                      onClick={() => setTasks((prev) => toggleTask(prev, task.id))}
                      className={cn(
                        "soft-focus grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-300",
                        task.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/35 hover:border-primary hover:bg-accent",
                      )}
                    >
                      {task.done && <Check className="todo-check-icon size-3.5" strokeWidth={3} />}
                    </button>
                    {editingId === task.id ? (
                      <input
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKey}
                        aria-label={`Editar "${task.title}"`}
                        className="min-w-0 flex-1 rounded-lg bg-background px-2 py-0.5 text-foreground outline-none ring-4 ring-ring"
                      />
                    ) : (
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          onDoubleClick={() => startEditing(task)}
                          title="Clique duas vezes para editar"
                          className={cn(
                            "min-w-0 flex-1 cursor-text break-words transition-colors duration-500",
                            task.done ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          <span className="todo-title" data-done={task.done}>
                            {task.title}
                          </span>
                        </span>
                        {readings[task.id] && (
                          <button
                            type="button"
                            onClick={() => setReaderId(task.id)}
                            aria-label={`Abrir "${readings[task.id]?.fileName}" para leitura — ${readingLabel(readings[task.id]?.percent ?? 0)}`}
                            className="soft-focus fade-in mt-1 flex max-w-full items-center gap-1.5 self-start rounded-full bg-accent/70 px-2.5 py-0.5 text-xs text-accent-foreground transition-colors duration-300 hover:bg-accent"
                          >
                            <FileText
                              className="size-3.5 shrink-0"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span className="truncate">{readings[task.id]?.fileName}</span>
                            <span aria-hidden="true" className="opacity-50">
                              ·
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {readingLabel(readings[task.id]?.percent ?? 0)}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                    {!readings[task.id] && (
                      <button
                        type="button"
                        title="Anexar arquivo"
                        aria-label={`Anexar arquivo a "${task.title}"`}
                        onClick={() => chooseFile(task.id)}
                        className="soft-focus grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-40 transition-all duration-300 hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-80 max-sm:opacity-60"
                      >
                        <Paperclip className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Excluir "${task.title}"`}
                      onClick={() => handleRemove(task.id)}
                      className="soft-focus grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-all duration-300 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-60"
                    >
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <ReaderPanel
        taskId={readerTask ? readerTask.id : null}
        taskTitle={readerTask?.title ?? ""}
        record={readerTask ? readings[readerTask.id] : undefined}
        completed={Boolean(readerTask?.done && readings[readerTask.id]?.autoCompleted)}
        onClose={() => setReaderId(null)}
        onPosition={handleReaderPosition}
        onTime={handleReaderTime}
        onRemoveAttachment={handleRemoveAttachment}
      />

      {notice && (
        <div
          key={notice.id}
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "fade-in fixed inset-x-0 bottom-6 z-[60] mx-auto w-fit max-w-[calc(100vw-2.5rem)] rounded-full border px-5 py-2.5 text-center text-sm shadow-soft",
            notice.tone === "error"
              ? "border-destructive/30 bg-card text-destructive"
              : "border-border bg-card text-foreground",
          )}
        >
          {notice.text}
        </div>
      )}
    </main>
  );
}
