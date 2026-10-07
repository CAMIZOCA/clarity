// v2: la v1 guardaba tambien respuestas de la API; cambiar el nombre las purga.
const CACHE_NAME = 'clarity-shell-v2';

// Datos y sesion: siempre de la red. Con "cache primero" cada pantalla mostraba
// la respuesta anterior (una consulta recien guardada se reabria con los valores
// viejos) y `/me` seguia devolviendo un usuario despues de cerrar sesion.
const NETWORK_ONLY_PREFIXES = ['/api/', '/sanctum/', '/storage/'];
const NETWORK_ONLY_PATHS = ['/me', '/login', '/logout'];

const isNetworkOnly = (pathname) =>
    NETWORK_ONLY_PATHS.includes(pathname) || NETWORK_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
const PRECACHE_URLS = [
    '/',
    '/login',
    '/manifest.webmanifest',
    '/pwa/apple-touch-icon.png',
    '/pwa/icon-192.png',
    '/pwa/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const preload = await event.preloadResponse;
                    if (preload) {
                        return preload;
                    }

                    const networkResponse = await fetch(request);
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                } catch {
                    const cache = await caches.open(CACHE_NAME);
                    const cachedPage = await cache.match(request);
                    if (cachedPage) {
                        return cachedPage;
                    }

                    const fallback = await cache.match('/login');
                    if (fallback) {
                        return fallback;
                    }

                    return new Response('Offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    });
                }
            })(),
        );

        return;
    }

    // Sin `respondWith` el navegador hace la peticion normal, sin cache.
    if (isNetworkOnly(url.pathname)) {
        return;
    }

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(request);

            const networkResponsePromise = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => null);

            if (cachedResponse) {
                event.waitUntil(networkResponsePromise);
                return cachedResponse;
            }

            const networkResponse = await networkResponsePromise;
            if (networkResponse) {
                return networkResponse;
            }

            return cachedResponse || Response.error();
        })(),
    );
});

self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { body: event.data?.text?.() ?? '' };
    }

    const title = payload.title || 'Clarity';
    const options = {
        body: payload.body || 'Tienes una actualizacion pendiente.',
        icon: '/pwa/icon-192.png',
        badge: '/pwa/icon-192.png',
        data: { url: payload.url || '/', tag: payload.tag || 'clarity-pwa' },
        tag: payload.tag || 'clarity-pwa',
        renotify: Boolean(payload.renotify),
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification?.data?.url || '/';

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            for (const client of allClients) {
                if ('focus' in client) {
                    if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname) {
                        await client.focus();
                        return;
                    }
                }
            }

            await self.clients.openWindow(targetUrl);
        })(),
    );
});
