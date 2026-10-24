// BitSync service worker: makes the app work offline after the first visit.
// Bump VERSION whenever any app file changes so phones pick up the update.
const VERSION = '1.3.0';
const APP_CACHE = 'bitsync-app-' + VERSION;
const CDN_CACHE = 'bitsync-cdn-v1';

const APP_FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'drills.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
  'sample/sample-pack.json',
];

const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
const KATEX_FONTS = [
  'AMS-Regular', 'Caligraphic-Bold', 'Caligraphic-Regular', 'Fraktur-Bold', 'Fraktur-Regular',
  'Main-Bold', 'Main-BoldItalic', 'Main-Italic', 'Main-Regular', 'Math-BoldItalic', 'Math-Italic',
  'SansSerif-Bold', 'SansSerif-Italic', 'SansSerif-Regular', 'Script-Regular',
  'Size1-Regular', 'Size2-Regular', 'Size3-Regular', 'Size4-Regular', 'Typewriter-Regular',
];
const CDN_FILES = [KATEX + 'katex.min.css', KATEX + 'katex.min.js', ...KATEX_FONTS.map((f) => `${KATEX}fonts/KaTeX_${f}.woff2`)];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await (await caches.open(APP_CACHE)).addAll(APP_FILES);
    // Math support is best-effort: a missing font must not block the install.
    const cdn = await caches.open(CDN_CACHE);
    await Promise.allSettled(CDN_FILES.map(async (url) => {
      if (await cdn.match(url)) return;
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) await cdn.put(url, res);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('bitsync-app-') && key !== APP_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(caches.match('index.html').then((hit) => hit || fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }

  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith((async () => {
      const cdn = await caches.open(CDN_CACHE);
      const hit = await cdn.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cdn.put(req, res.clone());
      return res;
    })());
  }
});
