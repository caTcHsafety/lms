import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { getStorageEstimate, isStorageLow } from '@/lib/offlineDownloader';

/**
 * Shows a persistent warning banner when device storage is running low.
 * Only shows once per session — dismissed state persists until page reload.
 */
export function StorageWarning() {
  const [show, setShow] = useState(false);
  const [remainingMB, setRemainingMB] = useState(0);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('storage_warning_dismissed') === '1');

  useEffect(() => {
    if (dismissed) return;
    async function check() {
      const low = await isStorageLow();
      if (low) {
        const { usage, quota } = await getStorageEstimate();
        setRemainingMB(Math.round((quota - usage) / (1024 * 1024)));
        setShow(true);
      }
    }
    check();
  }, [dismissed]);

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-amber-800">Storage running low</div>
          <div className="text-xs text-amber-600 mt-0.5">
            Only {remainingMB < 1024 ? `${remainingMB}MB` : `${(remainingMB / 1024).toFixed(1)}GB`} remaining. Large downloads may fail. Consider removing offline content you no longer need.
          </div>
        </div>
        <button
          onClick={() => { setDismissed(true); setShow(false); sessionStorage.setItem('storage_warning_dismissed', '1'); }}
          className="size-6 rounded-full flex items-center justify-center text-amber-600 hover:bg-amber-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
