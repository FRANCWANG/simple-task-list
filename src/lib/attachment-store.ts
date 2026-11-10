/**
 * Browser-only IndexedDB storage for task attachments (one file per task id).
 * All `indexedDB` access happens inside function bodies, so importing this module is SSR-safe.
 */

const DB_NAME = "hoje";
const STORE = "attachments";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function saveAttachment(taskId: string, file: Blob): Promise<void> {
  return run<void>("readwrite", (store) => store.put(file, taskId));
}

export async function loadAttachment(taskId: string): Promise<Blob | null> {
  const result = await run<unknown>("readonly", (store) => store.get(taskId));
  return result instanceof Blob ? result : null;
}

export function deleteAttachment(taskId: string): Promise<void> {
  return run<void>("readwrite", (store) => store.delete(taskId));
}
