// Service worker for our PWA

const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const APP_SHELL = 'app-shell-v1';

const PRECACHE = [
    `${BASE}/`,
    `${BASE}/index.html`,
    `${BASE}/manifest.webmanifest`,
    `${BASE}/icons/icon-128.png`
];

self.addEventListener('install', event => {
    event.waitUntil(
            caches.open(APP_SHELL)
            .then(cache => cache.addAll(PRECACHE))
            .then( () => console.log("SW: Precaching done."))
    );
});