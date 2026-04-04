// Not gibberish! - Needed by TS
/// <reference lib="webworker" />

// Precaching using workbox
import { precacheAndRoute } from 'workbox-precaching';
import { CacheFirst } from 'workbox-strategies';
import { registerRoute } from 'workbox-routing';

// Working context
declare const self: ServiceWorkerGlobalScope;

// 👇 injected by Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST);

//----------------
// Data Structures
//----------------

// TODO Cache names const
// TODO Limit offline retry fetches
// TODO Message types
// TODO Remove console.log
// TODO Button for clearing caches
// TODO Refactor SW Messaging Helper from app.ts

// Statistics on cache usage
export interface TileCacheStats{
    type: string,
    tilesCache: number,
    offlineCache: number,
    tilesCacheHits: number,
    offlineCacheHits: number,
}

//-------------
// Installation
//-------------

self.addEventListener('install', (event) => {
    self.caches.delete("geodata-cache")
})

//---------------------
// Leaflet tile caching
//---------------------

const retryQueue: Set<Request> = new Set();
var retryRunning = false
var tileCacheHits: number = 0
var offlineCacheHits: number = 0

// Send the same message to all tabs
function broadcastMessage(message: any){
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage(message);
        });
    });
}

async function handleRetryQueue(){
    let counter = 0;
    if(retryQueue.size > 0 && !retryRunning){
        retryRunning = true;
        (async() => {
            const offlineCache = await caches.open('tiles-offline');
            for (const request of retryQueue) {
                try {
                    const response = await fetch(request);
                    if (response) {
                        offlineCache.put(request, response.clone());
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
            retryRunning = false
        })
    }
}

function clearTilesCache(){
    self.caches.delete("tiles-cache")
    self.caches.delete("tiles-offline")
}

async function calculateCacheStats(): Promise<TileCacheStats>{
    const tilesCache: Cache = await self.caches.open("tiles-cache")
    const offlineCache: Cache = await self.caches.open("tiles-offline")

    const tilesKeys = await tilesCache.keys()
    const offlineKeys = await offlineCache.keys()

    return {
        type: 'CACHE_STATS',
        tilesCache: tilesKeys.length,
        offlineCache: offlineKeys.length,
        tilesCacheHits: tileCacheHits,
        offlineCacheHits: offlineCacheHits,
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
                tileCacheHits++
                console.log("Found in cache level 1")
                return cachedResponse
            }

            // 2nd level - offline cache for regions with poor coverage
            const offlineCache = await caches.open('tiles-offline');
            const offlineResponse = await offlineCache.match(request);
            if (offlineResponse){
                offlineCacheHits++
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

/* We have integrated google fonts directly
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
*/

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
            const stats = await calculateCacheStats()
            event.source?.postMessage(stats)
            break;

        case 'CACHE_CLEAR_TILES_REQUEST':
            clearTilesCache()
            break;
    }
});

// FOR REFERENCE
//--------------

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