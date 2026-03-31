/// <reference lib="webworker" />

// Precaching using workbox
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// 👇 injected by Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST);

import { CacheFirst } from 'workbox-strategies';

import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

//---------------------
// Leaflet tile caching
//---------------------

// Send the same message to all tabs
function broadcastMessage(message: any){
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage(message);
        });
    });
}

const retryQueue: Set<Request> = new Set();

async function handleRetryQueue(){
    // TODO - Make sure we don't execute multiple instances at the same time
    let counter = 0;
    if(retryQueue.size > 0){
        (async() => {
            const pinnedCache = await caches.open('tiles-offline');
            for (const request of retryQueue) {
                try {
                    const response = await fetch(request);
                    if (response) {
                        pinnedCache.put(request, response.clone());
                        retryQueue.delete(request);
                        counter++
                    }
                }catch(err){console.error(err);}
            }
        })()
        .then(() => {
            if(counter > 0){
                broadcastMessage({type: "RETRY_QUEUE_EMPTIED", counter: counter});
            }
        })
    }
}

registerRoute(
    ({ url }) => url.hostname.includes('tile'),
    async (options) => {
        const request = options.request;
        console.log("Fetching tile", request.url);

        try {
            // 1st level - general cache with size limit
            const tilesCache = await caches.open('tiles-cache');
            const cachedResponse = await tilesCache.match(request)
            if(cachedResponse) {
                console.log("Found in cache level 1")
                return cachedResponse
            }

            // 2nd level - offline cache for regions with poor coverage
            const offlineCache = await caches.open('tiles-offline');
            const offlineResponse = await offlineCache.match(request);
            if (offlineResponse){
                console.log("Found in cache level 2")
                return offlineResponse
            }

            console.log("Not found in 1st cache, trying network ")

            // Try network next
            const response = await fetch(request);
            if(response) {
                // store in "runtime" cache
                tilesCache.put(request, response.clone());
                // The call was successful -> we have a network connection -> try loading queued tiles (async)
                handleRetryQueue()
                console.log(`Found on network, checking ${retryQueue.size} offline tiles`);
                return response;
            }
            else return new Response("Tile not found (empty response)", {status: 404})
        } catch (err) {
            console.error(err);
            console.warn('Tile fetch failed, addind to retry list...', request.url);

            // Add to retry queue
            retryQueue.add(request);

            // fallback
            return new Response('Tile not available', {status: 503});
        }
    }
);

//---------------------
// APPLICATION ASSETS
// Cache first strategy
//---------------------

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

// Material design assets
// Bootstrap assets
/*
registerRoute(
    ({ url }):boolean  => {
        return (url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com') ||
                url.pathname.includes('bootstrap/dist'));
    },
    new CacheFirst({
        cacheName: 'assets-cache'
    })
);*/

registerRoute(
    ({ url }) => {
        const match =
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com');

        if (match) console.log('Matched asset:', url.href);

        return match;
    },
    new CacheFirst({ cacheName: 'assets-cache' })
);

// Geo Routing Data
registerRoute(
    ({ url }) => url.pathname.startsWith('/cyclorer2/data/'),
    new CacheFirst({
        cacheName: 'geodata-cache'
    })
);

// Register message listener for communication with App
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;
    console.log("message", event.data);
    switch (type) {
        case 'CACHE_STATS_REQUEST':
            const tilesCache: Cache = await self.caches.open("tiles-cache")
            const keys = await tilesCache.keys()
            event.source?.postMessage({
                type: 'CACHE_STATS',
                entriesCount: keys.length
            });
            break;

        case 'PIN_TILE':
            break;
    }
});

/* Send message to worker:
navigator.serviceWorker.controller?.postMessage({
  type: 'CLEAR_PINNED_CACHE'
});

Receiver:
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;
}

Reply:
self.addEventListener('message', (event) => {
  event.source?.postMessage({
    type: 'REPLY'
  });
});
 */

/* Send message to app:
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({
      type: 'CACHE_STATUS',
      pinnedCount: 123
    });
  });
});

Receive in app:
navigator.serviceWorker.addEventListener('message', (event) => {
  console.log('Message from SW:', event.data);
});
 */