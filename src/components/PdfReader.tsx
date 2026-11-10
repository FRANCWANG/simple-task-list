import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ReadingPosition } from "@/lib/reading";

type Props = {
  blob: Blob;
  /** Page to open on (e.g. the furthest page reached so far). */
  startPage: number;
  onPosition: (position: ReadingPosition) => void;
  onError: () => void;
};

/** Shows a PDF one page at a time. pdfjs is loaded lazily in the browser only. */
export function PdfReader({ blob, startPage, onPosition, onError }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onPosition, onError });
  callbacks.current = { onPosition, onError };
  const startRef = useRef(startPage);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (cancelled) return;
      loadingTask = pdfjs.getDocument({ data });
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setPage(Math.min(loaded.numPages, Math.max(1, startRef.current)));
      setDoc(loaded);
    })().catch(() => {
      if (!cancelled) callbacks.current.onError();
    });
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [blob]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || width <= 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    (async () => {
      const pdfPage = await doc.getPage(page);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = pdfPage.render({
        canvas,
        viewport,
        ...(dpr !== 1 ? { transform: [dpr, 0, 0, dpr, 0, 0] } : {}),
      });
      await task.promise;
      if (cancelled) return;
      setRendering(false);
      callbacks.current.onPosition({ kind: "pdf", page, totalPages: doc.numPages });
    })().catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException"))
        return;
      callbacks.current.onError();
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width]);

  const total = doc?.numPages ?? 0;
  const go = (delta: number) => setPage((p) => Math.min(total, Math.max(1, p + delta)));

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div ref={wrapRef} className="mx-auto w-full max-w-2xl">
          <canvas
            ref={canvasRef}
            aria-label={total ? `Página ${page} de ${total}` : "Carregando PDF"}
            className="block rounded-xl bg-card shadow-soft transition-opacity duration-500"
            style={{ opacity: rendering ? 0.35 : 1 }}
          />
          {!doc && (
            <p className="py-16 text-center text-sm text-muted-foreground">Abrindo o PDF…</p>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="soft-focus grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            className="min-w-[8rem] text-center text-sm tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            Página {page} de {total}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page >= total}
            aria-label="Próxima página"
            className="soft-focus grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
