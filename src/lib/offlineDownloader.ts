/**
 * Offline Downloader — handles downloading content for offline access.
 * 
 * Strategy by content type:
 * - PDF/single files (≤50MB): stored in IndexedDB via existing offlineVault
 * - Video (any size): stored in Cache API under its URL
 * - SCORM/PPT folders: manifest-based multi-file download into Cache API
 * 
 * Cache API is used for large/multi-file content because:
 * 1. Service Worker can intercept iframe requests and serve from cache
 * 2. No single-blob size limit per entry
 * 3. Each file is stored as a URL→Response pair (natural for HTTP content)
 */

import { get, set } from 'idb-keyval';
import { supabase } from './supabase';
import { saveToOfflineVault, addToOfflineVaultIndex } from './offlineVault';

const CACHE_NAME = 'r2-offline-content';
const DOWNLOAD_STATUS_PREFIX = 'dl_status_';

export type DownloadStatus = 'idle' | 'downloading' | 'downloaded' | 'error';

export interface DownloadProgress {
  status: DownloadStatus;
  percent: number;        // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  filesDownloaded?: number;
  totalFiles?: number;
  error?: string;
}

export interface DownloadRecord {
  moduleId: string;
  contentUrl: string;
  type: 'PDF' | 'VIDEO' | 'SCORM' | 'DOCUMENT';
  title: string;
  downloadedAt: number;
  sizeBytes: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Download content for offline access. Handles routing to the correct strategy.
 */
export async function downloadForOffline(
  moduleId: string,
  contentUrl: string,
  type: 'PDF' | 'VIDEO' | 'SCORM' | 'DOCUMENT',
  title: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const report = (p: Partial<DownloadProgress>) => {
    onProgress?.({ status: 'downloading', percent: 0, bytesDownloaded: 0, totalBytes: 0, ...p });
  };

  report({ status: 'downloading', percent: 0 });

  try {
    if (type === 'SCORM') {
      await downloadScormPackage(moduleId, contentUrl, report);
    } else if (type === 'VIDEO') {
      await downloadSingleFile(moduleId, contentUrl, 'VIDEO', report);
    } else {
      // PDF / DOCUMENT — use existing IndexedDB blob approach
      await downloadToIndexedDB(moduleId, contentUrl, type, title, report);
    }

    // Record completion
    const record: DownloadRecord = {
      moduleId,
      contentUrl,
      type,
      title,
      downloadedAt: Date.now(),
      sizeBytes: 0, // will be updated below
    };
    await set(`${DOWNLOAD_STATUS_PREFIX}${moduleId}`, record);
    report({ status: 'downloaded', percent: 100 });
  } catch (err: any) {
    report({ status: 'error', percent: 0, error: err.message });
    throw err;
  }
}

/**
 * Check if a module is downloaded for offline access.
 */
export async function getDownloadStatus(moduleId: string): Promise<DownloadStatus> {
  const record = await get<DownloadRecord>(`${DOWNLOAD_STATUS_PREFIX}${moduleId}`);
  return record ? 'downloaded' : 'idle';
}

/**
 * Get all downloaded modules.
 */
export async function getAllDownloads(): Promise<DownloadRecord[]> {
  const index = (await get<string[]>('offline_download_index')) || [];
  const records: DownloadRecord[] = [];
  for (const id of index) {
    const record = await get<DownloadRecord>(`${DOWNLOAD_STATUS_PREFIX}${id}`);
    if (record) records.push(record);
  }
  return records;
}

/**
 * Remove a download (clear cache entries + IndexedDB record).
 */
export async function removeDownload(moduleId: string): Promise<void> {
  const record = await get<DownloadRecord>(`${DOWNLOAD_STATUS_PREFIX}${moduleId}`);
  if (!record) return;

  if (record.type === 'SCORM' || record.type === 'VIDEO') {
    // Clear from Cache API
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const prefix = getContentPrefix(record.contentUrl);
    for (const req of keys) {
      if (req.url.includes(prefix) || req.url === record.contentUrl) {
        await cache.delete(req);
      }
    }
  }

  // Clear IndexedDB records
  await set(`${DOWNLOAD_STATUS_PREFIX}${moduleId}`, undefined);

  // Remove from index
  const index = (await get<string[]>('offline_download_index')) || [];
  await set('offline_download_index', index.filter(id => id !== moduleId));
}

/**
 * Get estimated storage usage and quota.
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentUsed: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, percentUsed: quota > 0 ? Math.round((usage / quota) * 100) : 0 };
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}

/**
 * Check if storage is running low (< 2GB remaining).
 * Returns false if the Storage API isn't available or returns unreliable data.
 */
export async function isStorageLow(): Promise<boolean> {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return false;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    // If quota is less than 10GB, the API is probably not reporting accurately
    if (quota < 10 * 1024 * 1024 * 1024) return false;
    const remaining = quota - usage;
    return remaining < 2 * 1024 * 1024 * 1024; // Less than 2GB
  } catch {
    return false;
  }
}

// ─── Private: Download strategies ──────────────────────────────────────────

/**
 * Download a SCORM package (multi-file) into Cache API using manifest.
 * Manifest path includes versionId: content/{moduleId}/{versionId}/manifest.json
 * Clears any old cached version before downloading new one.
 * Falls back to fetching index.html and parsing for sub-resources if no manifest.
 */
async function downloadScormPackage(
  moduleId: string,
  contentUrl: string,
  report: (p: Partial<DownloadProgress>) => void
): Promise<void> {
  const baseUrl = contentUrl.replace(/\/index\.html$/, '');
  const manifestUrl = `${baseUrl}/manifest.json`;

  // Clear any previously cached version for this module before downloading new
  const cache = await caches.open(CACHE_NAME);
  const existingKeys = await cache.keys();
  const modulePrefix = getContentPrefix(contentUrl);
  for (const req of existingKeys) {
    if (req.url.includes(modulePrefix)) {
      await cache.delete(req);
    }
  }

  let files: string[];
  try {
    const manifestResp = await fetch(manifestUrl);
    if (!manifestResp.ok) {
      // No manifest — fetch index.html and parse for referenced resources
      files = await discoverScormFiles(contentUrl, baseUrl);
    } else {
      const manifest = await manifestResp.json();
      files = manifest.files || ['index.html'];
    }
  } catch {
    files = await discoverScormFiles(contentUrl, baseUrl);
  }

  const totalFiles = files.length;
  let filesDownloaded = 0;
  let totalBytes = 0;

  // Download files in batches of 5 for parallelism
  const BATCH_SIZE = 5;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (filePath) => {
        const fileUrl = filePath.startsWith('http') ? filePath : `${baseUrl}/${filePath}`;
        try {
          const response = await fetch(fileUrl);
          if (response.ok) {
            const clone = response.clone();
            const blob = await response.blob();
            totalBytes += blob.size;
            await cache.put(fileUrl, clone);
          }
        } catch (err) {
          console.warn(`Failed to cache ${filePath}:`, err);
        }
        filesDownloaded++;
        report({
          status: 'downloading',
          percent: Math.round((filesDownloaded / totalFiles) * 100),
          bytesDownloaded: totalBytes,
          totalBytes: 0,
          filesDownloaded,
          totalFiles,
        });
      })
    );
  }

  // Also ensure the contentUrl itself is cached
  try {
    const existing = await cache.match(contentUrl);
    if (!existing) {
      const indexResp = await fetch(contentUrl);
      if (indexResp.ok) await cache.put(contentUrl, indexResp);
    }
  } catch {}

  await addToDownloadIndex(moduleId);
}

/**
 * Discover SCORM files by fetching index.html and parsing resource references.
 * This is the fallback when no manifest.json exists.
 */
async function discoverScormFiles(indexUrl: string, baseUrl: string): Promise<string[]> {
  const files = new Set<string>(['index.html']);
  
  try {
    const resp = await fetch(indexUrl);
    if (!resp.ok) return Array.from(files);
    const html = await resp.text();

    // Parse src, href, and url() references
    const patterns = [
      /src=["']([^"']+)["']/gi,
      /href=["']([^"']+)["']/gi,
      /url\(["']?([^"')]+)["']?\)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const ref = match[1];
        // Skip external URLs, data URIs, anchors
        if (ref.startsWith('http') || ref.startsWith('data:') || ref.startsWith('#') || ref.startsWith('//')) continue;
        // Clean up relative paths
        const cleaned = ref.split('?')[0].split('#')[0];
        if (cleaned && !cleaned.startsWith('javascript:')) {
          files.add(cleaned);
        }
      }
    }

    // Also look for common iSpring resource patterns
    const commonPaths = ['data/', 'ispring_res/', 'res/', 'resources/'];
    // Try fetching known iSpring structure files
    for (const prefix of commonPaths) {
      const testUrl = `${baseUrl}/${prefix}`;
      // We can't list directories — but the parsed references should cover most files
    }
  } catch (err) {
    console.warn('Failed to parse SCORM index.html for resources:', err);
  }

  return Array.from(files);
}

/**
 * Download a single large file (video) into Cache API with byte-level progress.
 */
async function downloadSingleFile(
  moduleId: string,
  url: string,
  type: 'VIDEO' | 'PDF',
  report: (p: Partial<DownloadProgress>) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const contentLength = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const chunks: Uint8Array[] = [];
  let bytesDownloaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytesDownloaded += value.length;
    report({
      status: 'downloading',
      percent: contentLength > 0 ? Math.round((bytesDownloaded / contentLength) * 100) : 0,
      bytesDownloaded,
      totalBytes: contentLength,
    });
  }

  // Reassemble into a Response and store in Cache API
  const blob = new Blob(chunks);
  const cachedResponse = new Response(blob, {
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' },
  });

  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, cachedResponse);
  await addToDownloadIndex(moduleId);
}

/**
 * Download a small file (PDF/document) into IndexedDB (existing approach).
 */
async function downloadToIndexedDB(
  moduleId: string,
  url: string,
  type: string,
  title: string,
  report: (p: Partial<DownloadProgress>) => void
): Promise<void> {
  // Determine if it's a Supabase storage URL or external
  let blob: Blob;

  if (url.includes('supabase.co/storage') || url.includes('module_content')) {
    let cleanPath = url;
    if (cleanPath.includes('module_content/')) {
      cleanPath = cleanPath.split('module_content/')[1];
    }
    cleanPath = decodeURIComponent(cleanPath.split('?')[0]).replace(/^\/+/, '').replace(/\/+$/, '');

    report({ status: 'downloading', percent: 30 });
    const { data, error } = await supabase.storage.from('module_content').download(cleanPath);
    if (error || !data) throw new Error(error?.message || 'Failed to download from storage');
    blob = data;
  } else {
    // External URL (R2 etc) — fetch directly
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    blob = await response.blob();
  }

  report({ status: 'downloading', percent: 80 });

  await saveToOfflineVault(moduleId, blob, { title, type });
  await addToOfflineVaultIndex(moduleId);
  await addToDownloadIndex(moduleId);

  report({ status: 'downloaded', percent: 100 });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getContentPrefix(url: string): string {
  // Extract the base path up to the version folder
  // e.g. https://pub-xxx.r2.dev/content/moduleId/versionId/ → content/moduleId/
  const match = url.match(/content\/([^/]+)\//);
  return match ? `content/${match[1]}/` : url;
}

async function addToDownloadIndex(moduleId: string): Promise<void> {
  const index = (await get<string[]>('offline_download_index')) || [];
  if (!index.includes(moduleId)) {
    index.push(moduleId);
    await set('offline_download_index', index);
  }
}
