import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, FileText, Trash2, X } from "lucide-react";

import { PdfReader } from "@/components/PdfReader";
import { TextReader } from "@/components/TextReader";
import { loadAttachment } from "@/lib/attachment-store";
import { readingLabel, type ReadingPosition, type ReadingRecord } from "@/lib/reading";

type Props = {
  taskId: string | null;
  taskTitle: string;
  record: ReadingRecord | undefined;
  /** Show the "reading complete" message (the task was completed automatically). */
  completed: boolean;
  onClose: () => void;
  onPosition: (taskId: string, position: ReadingPosition) => void;
  onTime: (taskId: string, ms: number) => void;
  onRemoveAttachment: (taskId: string) => void;
};

const TICK_MS = 1000;

export function ReaderPanel({
  taskId,
  taskTitle,
  record,
  completed,
  onClose,
  onPosition,
  onTime,
  onRemoveAttachment,
}: Props) {
  const open = taskId !== null && record !== undefined;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeRef = useRef(onTime);
  timeRef.current = onTime;

  // Load the file from the browser storage when the reader opens.
  useEffect(() => {
    setBlob(null);
    setError(null);
    if (!taskId) return;
    let cancelled = false;
    loadAttachment(taskId).then(
      (file) => {
        if (cancelled) return;
        if (file) setBlob(file);
        else
          setError(
            "Não encontramos este arquivo neste navegador. Remova o anexo e anexe-o novamente.",
          );
      },
      () => !cancelled && setError("Não foi possível abrir este arquivo."),
    );
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Count the time the reader is open (and the page visible).
  useEffect(() => {
    if (!taskId) return;
    let last = performance.now();
    const flush = () => {
      const now = performance.now();
      if (document.visibilityState === "visible") timeRef.current(taskId, now - last);
      last = now;
    };
    const timer = window.setInterval(flush, TICK_MS);
    return () => {
      window.clearInterval(timer);
      flush();
    };
  }, [taskId]);

  const percent = record?.percent ?? 0;
  const handlePosition = (position: ReadingPosition) => taskId && onPosition(taskId, position);
  const handleError = () =>
    setError("Não foi possível abrir este arquivo. Ele pode estar corrompido.");

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-[2px] duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 top-6 z-50 flex flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-soft duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[88vh] sm:w-[min(48rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          {record && taskId && (
            <>
              <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                  <FileText className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-sm font-semibold text-foreground">
                    {record.fileName}
                  </Dialog.Title>
                  <Dialog.Description className="truncate text-xs text-muted-foreground">
                    {taskTitle}
                  </Dialog.Description>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(taskId)}
                  className="soft-focus flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span className="max-sm:sr-only">Remover anexo</span>
                </button>
                <Dialog.Close
                  aria-label="Fechar leitor"
                  className="soft-focus grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </Dialog.Close>
              </header>

              {error ? (
                <p className="flex-1 px-6 py-16 text-center text-sm text-muted-foreground">
                  {error}
                </p>
              ) : !blob ? (
                <p className="flex-1 py-16 text-center text-sm text-muted-foreground">
                  Abrindo o arquivo…
                </p>
              ) : record.kind === "pdf" ? (
                <PdfReader
                  blob={blob}
                  startPage={record.furthestPage}
                  onPosition={handlePosition}
                  onError={handleError}
                />
              ) : (
                <TextReader
                  blob={blob}
                  startPercent={record.percent}
                  onPosition={handlePosition}
                  onError={handleError}
                />
              )}

              <footer className="border-t border-border px-5 py-3">
                {completed ? (
                  <p
                    role="status"
                    className="fade-in flex items-center justify-center gap-2 text-sm text-primary"
                  >
                    <CheckCircle2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    Leitura concluída! Tarefa movida para Concluídas.
                  </p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div
                      role="progressbar"
                      aria-label="Progresso da leitura"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {readingLabel(percent)}
                    </span>
                  </div>
                )}
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
