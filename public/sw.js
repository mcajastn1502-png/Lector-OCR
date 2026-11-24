// Service worker: deja el motor OCR disponible sin conexión y acelera las cargas.
const OCR_CACHE = 'ocr-engine-v1'; // worker, núcleo WASM e idiomas (pesados, casi inmutables)
const APP_CACHE = 'app-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== OCR_CACHE && k !== APP_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Recursos del OCR: primero caché (solo se descargan una vez)
  if (url.pathname.includes('/tesseract/')) {
    event.respondWith(
      caches.open(OCR_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Resto de la app: red primero (siempre la versión nueva) y caché como respaldo sin conexión
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
