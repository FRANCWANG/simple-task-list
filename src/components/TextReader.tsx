import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ReadingPosition } from "@/lib/reading";

type Props = {
  blob: Blob;
  /** Scroll percentage to resume from. */
  startPercent: number;
  onPosition: (position: ReadingPosition) => void;
  onError: () => void;
};

/** Shows a TXT/MD file as plain scrollable text and reports the scroll position. */
export function TextReader({ blob, startPercent, onPosition, onError }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPosition, onError });
  callbacks.current = { onPosition, onError };
  const startRef = useRef(startPercent);

  useEffect(() => {
    let cancelled = false;
    blob.text().then(
      (text) => !cancelled && setContent(text),
      () => !cancelled && callbacks.current.onError(),
    );
    return () => {
      cancelled = true;
    };
  }, [blob]);

  function report() {
    const el = ref.current;
    if (!el) return;
    callbacks.current.onPosition({
      kind: "text",
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (content === null || !el) return;
    const start = startRef.current;
    if (start > 0 && start < 100)
      el.scrollTop = ((el.scrollHeight - el.clientHeight) * start) / 100;
    report();
  }, [content]);

  return (
    <div
      ref={ref}
      onScroll={report}
      tabIndex={0}
      aria-label="Conteúdo do arquivo"
      className="soft-focus min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8"
    >
      {content === null ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Abrindo o arquivo…</p>
      ) : (
        <div className="mx-auto max-w-[65ch] whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-foreground">
          {content}
        </div>
      )}
    </div>
  );
}
