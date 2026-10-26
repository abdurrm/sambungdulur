/**
 * Local persistence in IndexedDB. The original site keeps guest trees in sessionStorage
 * (lost when the tab closes); here the working tree and its photos survive reloads and
 * browser restarts, and never leave the device.
 */
import type { TreeDoc } from '../model/types';

const DB_NAME = 'sambungdulur';
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function saveDoc(doc: TreeDoc): Promise<void> {
  await tx('kv', 'readwrite', (s) => s.put(doc, 'current'));
}

export async function loadDoc(): Promise<TreeDoc | undefined> {
  return tx<TreeDoc>('kv', 'readonly', (s) => s.get('current'));
}

export async function putMedia(id: string, blob: Blob): Promise<void> {
  await tx('media', 'readwrite', (s) => s.put(blob, id));
}

/** One durable transaction for a reviewed import and its private original source. */
export async function saveDocWithMedia(doc: TreeDoc, id: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['kv', 'media'], 'readwrite');
    transaction.objectStore('kv').put(doc, 'current');
    transaction.objectStore('media').put(blob, id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export async function getMedia(id: string): Promise<Blob | undefined> {
  return tx<Blob>('media', 'readonly', (s) => s.get(id));
}

export async function allMediaKeys(): Promise<string[]> {
  return ((await tx<IDBValidKey[]>('media', 'readonly', (s) => s.getAllKeys())) ?? []).map(String);
}

export async function clearMedia(): Promise<void> {
  await tx('media', 'readwrite', (s) => s.clear());
}

export async function deleteMedia(id: string): Promise<void> {
  await tx('media', 'readwrite', (s) => s.delete(id));
}
