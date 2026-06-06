import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Maximize2,
  X,
} from "lucide-react";

interface Props {
  url: string;
  deckCode: string;
  version: string;
  totalSlides: number;
  onExit: () => void;
}

export function ISpringViewer({ url, deckCode, version, totalSlides, onExit }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsManualTrigger, setNeedsManualTrigger] = useState(false);

  // Convert R2 URL to same-origin proxy URL
  const proxyUrl = useMemo(() => {
    if (!url) return url;
    const match = url.match(/r2\.dev\/content\/(.+)$/);
    if (match) return `/scorm-proxy/${match[1]}`;
    return url;
  }, [url]);

  const doFullscreen = useCallback(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return false;

    const player = iframeDoc.querySelector('.universal.universal_webkit')
                 || iframeDoc.querySelector('.universal')
                 || iframeDoc.querySelector('#content > div');

    if (!player) return false;

    // Clean up any previous injection
    iframeDoc.getElementById('trainer-toolbar-portal')?.remove();
    iframeDoc.getElementById('trainer-ink-canvas')?.remove();
    iframeDoc.getElementById('trainer-interaction-overlay')?.remove();
    iframeDoc.getElementById('trainer-laser-dot')?.remove();

    // Ink canvas — inside player
    const inkCanvas = iframeDoc.createElement('canvas');
    inkCanvas.id = 'trainer-ink-canvas';
    inkCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483645;';
    player.appendChild(inkCanvas);

    // Laser dot — inside player
    const laserDot = iframeDoc.createElement('div');
    laserDot.id = 'trainer-laser-dot';
    laserDot.style.cssText = 'position:fixed;width:24px;height:24px;border-radius:50%;pointer-events:none;background:#ff3366;box-shadow:0 0 24px 8px rgba(255,51,102,0.55);z-index:2147483647;display:none;';
    const laserInner = iframeDoc.createElement('div');
    laserInner.style.cssText = 'position:absolute;inset:4px;border-radius:50%;background:white;opacity:0.9;';
    laserDot.appendChild(laserInner);
    player.appendChild(laserDot);

    // Interaction overlay — inside player
    const overlay = iframeDoc.createElement('div');
    overlay.id = 'trainer-interaction-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483644;pointer-events:none;';
    player.appendChild(overlay);

    // Toolbar — inside player
    const toolbar = iframeDoc.createElement('div');
    toolbar.id = 'trainer-toolbar-portal';
    toolbar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:all;display:flex;align-items:center;gap:6px;height:56px;padding:0 8px;border-radius:9999px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(16px);box-shadow:0 12px 40px rgba(0,0,0,0.5);';

    const btnBase = 'width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;transition:background 0.15s;color:white;';

    toolbar.innerHTML = `
      <button id="tool-laser" style="${btnBase}background:rgba(255,255,255,0.1);" title="Laser (L)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
      </button>
      <button id="tool-ink" style="${btnBase}background:rgba(255,255,255,0.1);" title="Ink (I)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
      </button>
      <button id="tool-eraser" style="${btnBase}background:rgba(255,255,255,0.1);" title="Clear Ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.6-.6-.6-1.4 0-2l10-10c.6-.6 1.4-.6 2 0l7 7c.6.6.6 1.4 0 2l-6 6"/><path d="M6 11l4 4"/></svg>
      </button>
      <button id="tool-exit-fs" style="${btnBase}background:rgba(255,255,255,0.1);margin-left:4px;" title="Exit (Esc)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    player.appendChild(toolbar);

    // --- Wire up interactions ---
    let activeTool: 'navigate' | 'laser' | 'ink' = 'navigate';
    let isDrawing = false;
    let inkCtx: CanvasRenderingContext2D | null = null;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = iframeDoc.documentElement.clientWidth;
      const h = iframeDoc.documentElement.clientHeight;
      inkCanvas.width = w * dpr;
      inkCanvas.height = h * dpr;
      inkCanvas.style.width = w + 'px';
      inkCanvas.style.height = h + 'px';
      inkCtx = inkCanvas.getContext('2d');
      if (inkCtx) inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    const updateBtns = () => {
      const lb = iframeDoc.getElementById('tool-laser') as HTMLElement | null;
      const ib = iframeDoc.getElementById('tool-ink') as HTMLElement | null;
      if (lb) lb.style.background = activeTool === 'laser' ? '#ff3366' : 'rgba(255,255,255,0.1)';
      if (ib) ib.style.background = activeTool === 'ink' ? '#ffd86b' : 'rgba(255,255,255,0.1)';
    };

    const setOverlay = (active: boolean, cur: string) => {
      overlay.style.pointerEvents = active ? 'auto' : 'none';
      overlay.style.cursor = cur;
    };

    iframeDoc.getElementById('tool-laser')?.addEventListener('click', () => {
      activeTool = activeTool === 'laser' ? 'navigate' : 'laser';
      setOverlay(activeTool !== 'navigate', activeTool === 'laser' ? 'none' : 'crosshair');
      laserDot.style.display = 'none';
      updateBtns();
    });

    iframeDoc.getElementById('tool-ink')?.addEventListener('click', () => {
      activeTool = activeTool === 'ink' ? 'navigate' : 'ink';
      setOverlay(activeTool !== 'navigate', activeTool === 'ink' ? 'crosshair' : 'none');
      laserDot.style.display = 'none';
      updateBtns();
    });

    iframeDoc.getElementById('tool-eraser')?.addEventListener('click', () => {
      if (inkCtx) inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    });

    iframeDoc.getElementById('tool-exit-fs')?.addEventListener('click', () => {
      if (iframeDoc.fullscreenElement) iframeDoc.exitFullscreen().catch(console.error);
    });

    overlay.addEventListener('pointermove', (e: any) => {
      if (activeTool === 'laser') {
        laserDot.style.display = 'block';
        laserDot.style.left = (e.clientX - 12) + 'px';
        laserDot.style.top = (e.clientY - 12) + 'px';
      }
      if (activeTool === 'ink' && isDrawing && inkCtx) {
        inkCtx.lineTo(e.clientX, e.clientY);
        inkCtx.stroke();
      }
    });

    overlay.addEventListener('pointerdown', (e: any) => {
      if (activeTool === 'ink' && inkCtx) {
        isDrawing = true;
        inkCtx.strokeStyle = '#ffd86b';
        inkCtx.lineWidth = 4;
        inkCtx.lineCap = 'round';
        inkCtx.lineJoin = 'round';
        inkCtx.beginPath();
        inkCtx.moveTo(e.clientX, e.clientY);
      }
    });

    overlay.addEventListener('pointerup', () => { isDrawing = false; });
    overlay.addEventListener('pointerleave', () => {
      isDrawing = false;
      if (activeTool === 'laser') laserDot.style.display = 'none';
    });

    iframeDoc.addEventListener('keydown', (e: any) => {
      if (e.key === 'Escape') {
        if (iframeDoc.fullscreenElement) iframeDoc.exitFullscreen().catch(console.error);
      } else if (e.key.toLowerCase() === 'l' && e.target.tagName !== 'INPUT') {
        activeTool = activeTool === 'laser' ? 'navigate' : 'laser';
        setOverlay(activeTool !== 'navigate', activeTool === 'laser' ? 'none' : 'crosshair');
        laserDot.style.display = 'none';
        updateBtns();
      } else if (e.key.toLowerCase() === 'i' && e.target.tagName !== 'INPUT') {
        activeTool = activeTool === 'ink' ? 'navigate' : 'ink';
        setOverlay(activeTool !== 'navigate', activeTool === 'ink' ? 'crosshair' : 'none');
        laserDot.style.display = 'none';
        updateBtns();
      }
    });

    // Clean up on fullscreen exit
    const fsCleanup = () => {
      if (!iframeDoc.fullscreenElement) {
        iframeDoc.getElementById('trainer-toolbar-portal')?.remove();
        iframeDoc.getElementById('trainer-ink-canvas')?.remove();
        iframeDoc.getElementById('trainer-interaction-overlay')?.remove();
        iframeDoc.getElementById('trainer-laser-dot')?.remove();
        iframeDoc.removeEventListener('fullscreenchange', fsCleanup);
        setIsFullscreen(false);
        onExit();
      }
    };
    iframeDoc.addEventListener('fullscreenchange', fsCleanup);

    // Fullscreen the player
    (player as HTMLElement).requestFullscreen().then(() => {
      setIsFullscreen(true);
      setNeedsManualTrigger(false);
      resizeCanvas();
    }).catch((err) => {
      console.error('Fullscreen failed:', err);
      // Browser blocked it — show manual trigger
      setNeedsManualTrigger(true);
      // Clean up injected elements since we didn't go fullscreen
      iframeDoc.getElementById('trainer-toolbar-portal')?.remove();
      iframeDoc.getElementById('trainer-ink-canvas')?.remove();
      iframeDoc.getElementById('trainer-interaction-overlay')?.remove();
      iframeDoc.getElementById('trainer-laser-dot')?.remove();
    });

    return true;
  }, [onExit]);

  // Auto-trigger fullscreen when iframe loads (within user gesture window)
  const handleIframeLoad = useCallback(() => {
    // Poll for the player element (iSpring takes a moment to init)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const success = doFullscreen();
      if (success || attempts > 20) {
        clearInterval(interval);
        if (!success && attempts > 20) {
          setNeedsManualTrigger(true);
        }
      }
    }, 150);
  }, [doFullscreen]);

  // Handle Escape key in parent context
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        onExit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit]);

  // If fullscreen was never entered (blocked), show overlay with manual button
  if (needsManualTrigger) {
    return (
      <div className="fixed inset-0 z-[2147483647] bg-black flex flex-col items-center justify-center">
        <iframe
          ref={iframeRef}
          src={proxyUrl}
          className="absolute inset-0 w-full h-full border-0 opacity-0 pointer-events-none"
          allowFullScreen
          allow="fullscreen; autoplay"
        />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <button
            onClick={() => doFullscreen()}
            className="px-6 py-3 rounded-full bg-white text-[#0d2543] text-sm font-semibold flex items-center gap-2 hover:bg-gray-100 shadow-xl"
          >
            <Maximize2 size={16} /> Enter Fullscreen Presentation
          </button>
          <button
            onClick={onExit}
            className="text-white/60 text-xs hover:text-white/90 flex items-center gap-1"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  // Normal flow: hidden iframe that auto-fullscreens
  return (
    <div className="fixed inset-0 z-[2147483647] bg-black">
      <iframe
        ref={iframeRef}
        src={proxyUrl}
        className="w-full h-full border-0"
        allowFullScreen
        allow="fullscreen; autoplay"
        style={{ display: 'block' }}
        onLoad={handleIframeLoad}
      />
      {!isFullscreen && !needsManualTrigger && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            <p className="text-sm text-white/70">Entering presentation...</p>
          </div>
        </div>
      )}
    </div>
  );
}
