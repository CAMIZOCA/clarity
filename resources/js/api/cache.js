const store = new Map();

export function cached(key, ttlMs, fetchFn) {
    const entry = store.get(key);
    if (entry && Date.now() < entry.expires) return Promise.resolve(entry.data);
    return fetchFn().then(data => {
        store.set(key, { data, expires: Date.now() + ttlMs });
        return data;
    });
}

export function invalidate(key) {
    store.delete(key);
}

export function invalidateAll() {
    store.clear();
}
