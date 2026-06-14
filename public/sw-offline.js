/**
 * SafetyCatch Offline Content Service Worker
 * 
 * CRITICAL CHANGE: This service worker NO LONGER auto-caches content on fetch.
 * Content is ONLY cached when explicitly downloaded via the OfflineDownloadButton.
 * 
 * This service worker is imported by the Workbox service worker via importScripts.
 * Workbox handles caching of app assets (JS, CSS). This handles R2 content only.
 * 
 * Three-mode handler:
 * 1. Navigation requests (HTML pages) → Let Workbox handle via precache
 * 2. /scorm-proxy/* requests → maps to R2 URLs in cache (same-origin serving for iframes)
 * 3. Direct R2 r2.dev/content/* requests → CacheFirst (but NO auto-caching on miss)
 */

console.log('[SW-OFFLINE] Script loaded and executing');

const CACHE_NAME = 'r2-offline-content';
const R2_BASE = 'https://pub-b98d83e63e884247aed6314345f7f167.r2.dev';

// Don't override Workbox's install/activate events
// Workbox will handle app shell caching

// Message event - handle skipWaiting from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW-OFFLINE] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

console.log('[SW-OFFLINE] Event listeners registered');

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ONLY handle R2 content - let Workbox handle EVERYTHING else by not calling event.respondWith()
  // This includes: navigation, HTML, JS, CSS, images, fonts, API calls, etc.
  
  // Mode 1: Same-origin proxy requests — /scorm-proxy/{moduleId}/{versionId}/{path}
  if (url.pathname.startsWith('/scorm-proxy/')) {
    console.log('[SW-OFFLINE] Handling /scorm-proxy/ request:', url.pathname);
    event.respondWith(handleProxyRequest(event.request, url));
    return;
  }

  // Mode 2: Direct R2 content requests — ONLY serve from cache if already downloaded
  // DO NOT automatically cache on fetch (prevents unwanted auto-downloads)
  if (event.request.url.includes('r2.dev/content/')) {
    console.log('[SW-OFFLINE] Handling r2.dev request:', url.pathname);
    event.respondWith(handleR2Request(event.request));
    return;
  }

  // IMPORTANT: Do not call event.respondWith() here!
  // Letting the event bubble to Workbox's fetch handler by returning early
});

async function handleProxyRequest(request, url) {
  // Convert /scorm-proxy/moduleId/versionId/path → R2 URL
  const proxyPath = url.pathname.replace('/scorm-proxy/', '');
  const r2Url = `${R2_BASE}/content/${proxyPath}`;

  const cache = await caches.open(CACHE_NAME);

  // Try to find the R2 URL in cache
  const cachedResponse = await cache.match(r2Url);

  if (cachedResponse) {
    // Handle Range requests for video playback
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      return handleRangeRequest(cachedResponse, rangeHeader);
    }
    // Clone and return with correct headers
    const headers = new Headers(cachedResponse.headers);
    headers.delete('Access-Control-Allow-Origin'); // Not needed for same-origin
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  // Not in cache — try fetching from R2 directly (online)
  try {
    const r2Response = await fetch(r2Url);
    // DO NOT auto-cache: only explicit downloads should cache
    // if (r2Response.ok) { cache.put(r2Url, clone); }
    return r2Response;
  } catch {
    return new Response('Content not available offline', { status: 503 });
  }
}

async function handleR2Request(request) {
  // Only cache GET requests
  if (request.method !== 'GET') {
    try { return await fetch(request); } catch { return new Response('', { status: 503 }); }
  }

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  // If in cache, serve from cache
  if (cached) return cached;

  // NOT in cache — fetch from network but DO NOT auto-cache
  // Content is only cached via explicit download action
  try {
    const response = await fetch(request);
    // DO NOT cache automatically: cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline — content not downloaded', { status: 503 });
  }
}

/**
 * Handle Range requests from video elements.
 * Serves a 206 Partial Content response from a cached full blob.
 */
async function handleRangeRequest(cachedResponse, rangeHeader) {
  const blob = await cachedResponse.blob();
  const totalSize = blob.size;

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': totalSize.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  const chunkSize = end - start + 1;
  const slicedBlob = blob.slice(start, end + 1);

  return new Response(slicedBlob, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/webm',
      'Content-Length': chunkSize.toString(),
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
    },
  });
}
