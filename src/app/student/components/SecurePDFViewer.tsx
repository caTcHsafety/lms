import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Maximize2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

// Set worker path - use local worker from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';

interface SecurePDFViewerProps {
  pdfUrl: string;
  lessonTitle: string;
  studentName?: string;
}

export function SecurePDFViewer({ pdfUrl, lessonTitle, studentName }: SecurePDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return;

    setLoading(true);
    setError(null);

    const loadPDF = async () => {
      try {
        console.log('Loading PDF from URL:', pdfUrl);
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
        });
        
        loadingTask.onProgress = (progress: any) => {
          console.log('PDF loading progress:', progress);
        };
        
        const pdfDoc = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdfDoc.numPages);
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        setError(`Failed to load PDF: ${err.message || 'Unknown error'}`);
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      if (pdf) {
        pdf.destroy();
      }
    };
  }, [pdfUrl]);

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Add watermark
        if (studentName) {
          context.save();
          context.globalAlpha = 0.1;
          context.font = '48px Arial';
          context.fillStyle = '#000000';
          context.textAlign = 'center';
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate(-45 * Math.PI / 180);
          context.fillText(`SAFETYCATCH LMS - ${studentName}`, 0, 0);
          context.restore();
        }

        // Get and render links
        const annotations = await page.getAnnotations();
        const linkAnnotations = annotations.filter((a: any) => a.subtype === 'Link' && a.url);
        
        // Clear previous link overlays
        const existingLinks = canvas.parentElement?.querySelectorAll('.pdf-link-overlay');
        existingLinks?.forEach(el => el.remove());

        // Create clickable overlays for links
        linkAnnotations.forEach((link: any) => {
          const rect = viewport.convertToViewportRectangle(link.rect);
          const [x1, y1, x2, y2] = rect;

          const linkOverlay = document.createElement('a');
          linkOverlay.href = link.url;
          linkOverlay.target = '_blank';
          linkOverlay.rel = 'noopener noreferrer';
          linkOverlay.className = 'pdf-link-overlay';
          linkOverlay.style.position = 'absolute';
          linkOverlay.style.left = `${Math.min(x1, x2)}px`;
          linkOverlay.style.top = `${Math.min(y1, y2)}px`;
          linkOverlay.style.width = `${Math.abs(x2 - x1)}px`;
          linkOverlay.style.height = `${Math.abs(y2 - y1)}px`;
          linkOverlay.style.cursor = 'pointer';
          linkOverlay.style.zIndex = '10';
          // Make link visible on hover
          linkOverlay.style.background = 'transparent';
          linkOverlay.onmouseenter = () => {
            linkOverlay.style.background = 'rgba(0, 123, 255, 0.1)';
          };
          linkOverlay.onmouseleave = () => {
            linkOverlay.style.background = 'transparent';
          };

          canvas.parentElement?.appendChild(linkOverlay);
        });
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, studentName]);

  // Prevent context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Prevent keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'c')) {
      e.preventDefault();
      return false;
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(console.error);
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.error);
      }
    }
  };

  // Zoom controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // Page navigation
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-gray-100 relative select-none secure-pdf-viewer"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <style>{`
        .secure-pdf-viewer canvas {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        
        .secure-pdf-viewer:fullscreen {
          background: #2b2b2b;
        }
        .secure-pdf-viewer:-webkit-full-screen {
          background: #2b2b2b;
        }
        .secure-pdf-viewer:-moz-full-screen {
          background: #2b2b2b;
        }
        
        .secure-pdf-viewer:fullscreen .pdf-canvas-container {
          height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .secure-pdf-viewer:-webkit-full-screen .pdf-canvas-container {
          height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .secure-pdf-viewer:-moz-full-screen .pdf-canvas-container {
          height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      {/* Canvas container */}
      <div className="h-[calc(100%-60px)] overflow-auto pdf-canvas-container">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="shadow-lg"
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 flex items-center justify-between px-4 z-10">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white text-sm px-3 min-w-[100px] text-center">
            Page {currentPage} / {numPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === numPages}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm px-3 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Toggle fullscreen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
