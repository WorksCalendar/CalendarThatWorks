/**
 * idbQueueStore — lightweight IndexedDB persistence for SyncQueue operations.
 *
 * Persists pending/error operations across page reloads so the queue survives
 * browser refreshes and tab restores. Synced operations are pruned
 * automatically. Only serialisable fields are stored (no class instances).
 *
 * Usage:
 *   const store = openIdbQueueStore('my-calendar-id');
 *   await store.hydrate(queue);      // restore on mount
 *   queue.enqueue(...)               // normal usage
 *   await store.persist(queue.all);  // call after mutations
 */

import type { QueuedOperation } from './SyncQueue';

const DB_NAME_PREFIX = 'wc-sync-queue-';
const STORE_NAME     = 'operations';
const DB_VERSION     = 1;

type PersistedOp = Omit<QueuedOperation, 'enqueuedAt'> & { enqueuedAt: string };

function dbName(calendarId: string): string {
  return `${DB_NAME_PREFIX}${calendarId}`;
}

function openDb(calendarId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(calendarId), DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): { store: IDBObjectStore; done: Promise<void> } {
  const transaction = db.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);
  const done  = new Promise<void>((res, rej) => {
    transaction.oncomplete = () => res();
    transaction.onerror    = () => rej(transaction.error);
    transaction.onabort    = () => rej(new Error('IDB transaction aborted'));
  });
  return { store, done };
}

export interface IdbQueueStore {
  /** Restore persisted ops into the queue on mount. */
  hydrate: (queue: { enqueue: (type: QueuedOperation['type'], eventId: string, payload: QueuedOperation['payload'], rollbackEvent: QueuedOperation['rollbackEvent']) => string }) => Promise<void>;
  /** Write the current op list to IndexedDB (call after every mutation). */
  persist: (ops: readonly QueuedOperation[]) => Promise<void>;
  /** Wipe the store (useful after a full server reload). */
  clear: () => Promise<void>;
}

export async function openIdbQueueStore(calendarId: string): Promise<IdbQueueStore | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb(calendarId);

    return {
      async hydrate(queue) {
        const { store, done } = tx(db, 'readonly');
        const req: IDBRequest<PersistedOp[]> = store.getAll();
        await done;
        const ops = (req.result ?? []).filter(
          op => op.status === 'pending' || op.status === 'error',
        );
        for (const op of ops) {
          queue.enqueue(op.type, op.eventId, op.payload, op.rollbackEvent);
        }
      },

      async persist(ops) {
        const { store, done } = tx(db, 'readwrite');
        store.clear();
        for (const op of ops) {
          if (op.status === 'synced') continue; // don't persist completed ops
          const record: PersistedOp = { ...op, enqueuedAt: op.enqueuedAt.toISOString() };
          store.put(record);
        }
        await done;
      },

      async clear() {
        const { store, done } = tx(db, 'readwrite');
        store.clear();
        await done;
      },
    };
  } catch {
    return null; // IDB unavailable (private browsing, etc.) — degrade silently
  }
}
