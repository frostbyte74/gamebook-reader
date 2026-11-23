let database;

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('turning-pages', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('reader');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

export async function readSaved() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('reader', 'readonly');
    const request = transaction.objectStore('reader').get('current');
    const book = transaction.objectStore('reader').get('book');
    transaction.oncomplete = () => resolve(request.result ? { ...request.result, book: book.result } : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveBook(value, includeBook = true) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('reader', 'readwrite');
    const store = transaction.objectStore('reader');
    if (includeBook) store.put(value.book, 'book');
    store.put({ state: value.state, preferences: value.preferences }, 'current');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
