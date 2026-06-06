import { Download, CheckCircle2, Loader2, CloudOff, Trash2 } from 'lucide-react';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';

interface Props {
  moduleId: string;
  contentUrl: string;
  type: 'PDF' | 'VIDEO' | 'SCORM' | 'DOCUMENT';
  title: string;
  /** Compact mode — icon only, no text */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable download button that handles:
 * - Idle → shows download icon
 * - Downloading → shows progress ring/bar
 * - Downloaded → shows green checkmark with "remove" on hover
 * - Error → shows retry
 */
export function OfflineDownloadButton({ moduleId, contentUrl, type, title, compact, className = '' }: Props) {
  const { status, progress, isDownloaded, isDownloading, startDownload, remove } = useOfflineDownload(moduleId);

  if (!contentUrl) return null;

  const handleClick = () => {
    if (isDownloading) return; // debounce
    if (isDownloaded) {
      remove();
    } else {
      startDownload(contentUrl, type, title);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={isDownloading}
        title={isDownloaded ? 'Remove offline copy' : isDownloading ? `Downloading ${progress.percent}%` : 'Download for offline'}
        className={`relative size-9 rounded-full flex items-center justify-center transition-colors ${
          isDownloaded
            ? 'bg-[#EAF7EE] text-[#16A34A] hover:bg-[#fde8e8] hover:text-[#c0392b]'
            : isDownloading
            ? 'bg-[#E8F1F7] text-[#4493BF]'
            : 'border border-[#e9ebef] text-[#0d2543] hover:bg-[#0d2543]/[0.06]'
        } ${className}`}
      >
        {isDownloading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {progress.percent > 0 && (
              <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#4493BF] text-white px-1 rounded-full">
                {progress.percent}%
              </span>
            )}
          </>
        ) : isDownloaded ? (
          <>
            <CheckCircle2 className="size-4 group-hover:hidden" />
            <Trash2 className="size-4 hidden group-hover:block" />
          </>
        ) : (
          <Download className="size-4" />
        )}
      </button>
    );
  }

  // Full-width button
  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        isDownloaded
          ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#16A34A]/20 hover:bg-[#fde8e8] hover:text-[#c0392b] hover:border-[#c0392b]/20'
          : isDownloading
          ? 'bg-[#E8F1F7] text-[#4493BF] border border-[#4493BF]/20'
          : 'bg-white border border-[#0D2543]/10 text-[#0D2543] hover:bg-gray-50'
      } disabled:opacity-70 ${className}`}
    >
      {isDownloading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Downloading {progress.percent}%
        </>
      ) : isDownloaded ? (
        <>
          <CheckCircle2 className="size-4" />
          Downloaded
        </>
      ) : (
        <>
          <Download className="size-4" />
          Download Offline
        </>
      )}
    </button>
  );
}

/**
 * Compact badge showing offline status — used in lesson sidebars etc.
 */
export function OfflineBadge({ moduleId }: { moduleId: string }) {
  const { isDownloaded } = useOfflineDownload(moduleId);
  if (!isDownloaded) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-[#EAF7EE] text-[#16A34A] text-[10px] font-bold px-1.5 py-0.5 rounded-md">
      <CloudOff className="size-2.5" /> Offline
    </span>
  );
}
