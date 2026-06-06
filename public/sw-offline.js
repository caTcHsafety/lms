/**
 * SafetyCatch Offline Content Service Worker
 * 
 * Two-mode handler:
 * 1. /scorm-proxy/* requests → maps to R2 URLs in cache (same-origin serving for iframes)
 * 2. Direct R2 r2.dev/content/* requests → CacheFirst (for online caching)
 * 
 * The proxy approach ensures the iframe + all sub-resources (including video)
 * are served from the same origin as the SW, so fetch interception works offline.
 */

const CACHE_NAME = 'r2-offline-content';
const R2_BASE = 'https://pub-b98d83e63e884247aed6314345f7f167.r2.dev';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Mode 1: Same-origin proxy requests — /scorm-proxy/{moduleId}/{versionId}/{path}
  if (url.pathname.startsWith('/scorm-proxy/')) {
    event.respondWith(handleProxyRequest(event.request, url));
    return;
  }

  // Mode 2: Direct R2 content requests — cache on fetch for future offline use
  if (event.request.url.includes('r2.dev/content/')) {
    event.respondWith(handleR2Request(event.request));
    return;
  }
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
    if (r2Response.ok) {
      // Cache it for future offline use
      const clone = r2Response.clone();
      cache.put(r2Url, clone);
    }
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
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
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
