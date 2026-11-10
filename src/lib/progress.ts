/** pt-BR progress label: "1 de 3 concluídas", "0 de 1 concluída". */
export function completedLabel(done: number, total: number): string {
  return `${done} de ${total} ${total === 1 ? "concluída" : "concluídas"}`;
}

/** Whole-number percentage of completed tasks; 0 when there are no tasks. */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(done, total) / total) * 100);
}
