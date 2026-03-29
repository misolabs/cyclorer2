/// <reference lib="webworker" />

// Precaching using workbox
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// 👇 injected by Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST);

import { CacheFirst } from 'workbox-strategies';

import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Leaflet tile caching
// TODO more complex strategy
registerRoute(
    ({ url }) =>
        url.hostname.includes('tile'),

    new StaleWhileRevalidate({
        cacheName: 'tiles-cache',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 300,        // 👈 critical
                maxAgeSeconds: 7 * 24 * 60 * 60 // 1 week
            })
        ]
    })
);

// Navigation handling
import { createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute } from 'workbox-routing';

const handler = createHandlerBoundToURL('/cyclorer2/index.html');

registerRoute(new NavigationRoute(handler));

// Vite assets
registerRoute(
    ({ url }) => url.pathname.startsWith('/cyclorer2/assets/'),
    new CacheFirst({
        cacheName: 'assets-cache'
    })
);

// Geo Routing Data
registerRoute(
    ({ url }) => url.pathname.startsWith('/cyclorer2/data/'),
    new CacheFirst({
        cacheName: 'geodata-cache'
    })
);