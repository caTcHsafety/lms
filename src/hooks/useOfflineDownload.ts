import { useState, useEffect, useCallback } from 'react';
import {
  downloadForOffline,
  getDownloadStatus,
  removeDownload,
  isStorageLow,
  getStorageEstimate,
  type DownloadProgress,
  type DownloadStatus,
} from '@/lib/offlineDownloader';
import { toast } from 'sonner';

/**
 * Hook that manages offline download state for a single module.
 * Provides: status, progress, download/remove actions, and storage warnings.
 */
export function useOfflineDownload(moduleId: string) {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'idle',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
  });

  // Check initial status on mount
  useEffect(() => {
    if (!moduleId) return;
    getDownloadStatus(moduleId).then(setStatus);
  }, [moduleId]);

  const startDownload = useCallback(async (
    contentUrl: string,
    type: 'PDF' | 'VIDEO' | 'SCORM' | 'DOCUMENT',
    title: string
  ) => {
    if (!moduleId || !contentUrl) return;

    // Check storage before downloading
    const low = await isStorageLow();
    if (low) {
      const { usage, quota } = await getStorageEstimate();
      const remainingGB = ((quota - usage) / (1024 * 1024 * 1024)).toFixed(1);
      toast.warning(`Storage running low (${remainingGB}GB remaining). Download may fail.`, { duration: 5000 });
    }

    // For SCORM and large files, estimate size via HEAD request and confirm if > 200MB
    if (type === 'SCORM' || type === 'VIDEO') {
      try {
        const headResp = await fetch(contentUrl, { method: 'HEAD' });
        const contentLength = Number(headResp.headers.get('content-length')) || 0;
        if (contentLength > 200 * 1024 * 1024) {
          const sizeMB = Math.round(contentLength / (1024 * 1024));
          const confirmed = window.confirm(
            `This download is approximately ${sizeMB}MB. This will use significant device storage.\n\nProceed with download?`
          );
          if (!confirmed) return;
        }
      } catch {
        // HEAD failed (CORS etc) — proceed without size check
      }
    }

    setStatus('downloading');
    setProgress({ status: 'downloading', percent: 0, bytesDownloaded: 0, totalBytes: 0 });

    try {
      await downloadForOffline(moduleId, contentUrl, type, title, (p) => {
        setProgress(p);
        if (p.status === 'downloaded') setStatus('downloaded');
        if (p.status === 'error') setStatus('error');
      });
      setStatus('downloaded');
      toast.success(`"${title}" saved for offline access`);
    } catch (err: any) {
      setStatus('error');
      toast.error(`Download failed: ${err.message}`);
    }
  }, [moduleId]);

  const remove = useCallback(async () => {
    if (!moduleId) return;
    await removeDownload(moduleId);
    setStatus('idle');
    setProgress({ status: 'idle', percent: 0, bytesDownloaded: 0, totalBytes: 0 });
    toast.success('Offline content removed');
  }, [moduleId]);

  return {
    status,
    progress,
    isDownloaded: status === 'downloaded',
    isDownloading: status === 'downloading',
    startDownload,
    remove,
  };
}
