import { supabase } from "./supabase";

const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;

interface UploadProgressCallback {
  (filesUploaded: number, totalFiles: number, bytesUploaded: number, totalBytes: number): void;
}

interface ISpringUploaderConfig {
  files: FileList;
  moduleId: string;
  versionId: string;
  onProgress?: UploadProgressCallback;
}

interface ISpringUploaderResult {
  indexUrl: string;
}

export class ISpringUploader {
  private files: File[];
  private moduleId: string;
  private versionId: string;
  private onProgress?: UploadProgressCallback;
  
  private filesUploaded = 0;
  private bytesUploaded = 0;
  private totalFiles = 0;
  private totalBytes = 0;

  constructor(config: ISpringUploaderConfig) {
    this.files = Array.from(config.files);
    this.moduleId = config.moduleId;
    this.versionId = config.versionId;
    this.onProgress = config.onProgress;
    
    this.totalFiles = this.files.length;
    this.totalBytes = this.files.reduce((acc, f) => acc + f.size, 0);
  }

  private async getPresignedUrl(key: string, contentType: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("r2-presign", {
      body: { key, contentType },
    });

    if (error) throw new Error(`Edge function error: ${error.message}`);
    if (data?.error) throw new Error(`Presign error: ${data.error}`);
    if (!data?.presignedUrl) throw new Error("No presigned URL returned");

    return data.presignedUrl;
  }

  private async uploadFile(file: File, relativePath: string, attempt = 1): Promise<void> {
    const key = `content/${this.moduleId}/${this.versionId}/${relativePath}`;
    
    try {
      const presignedUrl = await this.getPresignedUrl(key, file.type || "application/octet-stream");

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      this.filesUploaded++;
      this.bytesUploaded += file.size;

      if (this.onProgress) {
        this.onProgress(this.filesUploaded, this.totalFiles, this.bytesUploaded, this.totalBytes);
      }
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Upload failed for ${relativePath}, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(res => setTimeout(res, 1000 * attempt));
        return this.uploadFile(file, relativePath, attempt + 1);
      }
      throw error;
    }
  }

  public async upload(): Promise<ISpringUploaderResult> {
    const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
    if (!r2PublicUrl) {
      throw new Error("VITE_R2_PUBLIC_URL is missing");
    }

    let indexHtmlFound = false;

    // Build upload queue
    const uploadTasks: (() => Promise<void>)[] = this.files.map(file => {
      // webkitRelativePath is "FolderName/path/to/file.ext"
      const pathParts = file.webkitRelativePath.split("/");
      // Strip the first segment (the root folder name)
      const relativePath = pathParts.slice(1).join("/");
      
      if (relativePath === "index.html") {
        indexHtmlFound = true;
        return async () => {
          let htmlContent = await file.text();

          // 1. Destroy the Promo Link HTML content directly
          htmlContent = htmlContent.replace(/<div id="promoLink">.*?<\/div>/gi, '<div id="promoLink" style="display:none!important;visibility:hidden!important;"></div>');

          // 2. The Injection Payload (CSS + JS Overrides)
          const injectionPayload = `
<style>
  /* Watermark Assassination */
  .promo-link, #promoLink, .free-logo, .trial_banner, .final-slide, .final-slide__link, [class*="trial"], [class*="free-logo"] {
      display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
  }
  /* Fullscreen fill for iSpring player container */
  .universal:-webkit-full-screen, .universal:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
      left: 0 !important;
      top: 0 !important;
  }
</style>

<script>
  // 1. MutationObserver for dynamically injected watermarks
  new MutationObserver(() => {
      document.querySelectorAll('.free-logo, .trial_banner, .final-slide, a[href*="ispring"]').forEach(el => {
          el.style.setProperty('display', 'none', 'important');
      });
  }).observe(document.body, { childList: true, subtree: true });

  // 2. Double-Click Fix (Capture Phase Focus)
  document.addEventListener('mousedown', function(e) {
      var btn = e.target.closest('[class*="next"], [aria-label*="Next"], [class*="prev"], [aria-label*="Prev"]');
      if (btn) btn.focus();
  }, true);

  // 3. Video Arrow Key Fix (Capture Phase Intercept)
  document.addEventListener('keydown', function(e) {
      var isRight = (e.key === 'ArrowRight' || e.keyCode === 39);
      var isLeft = (e.key === 'ArrowLeft' || e.keyCode === 37);
      var videoFocused = document.activeElement && (document.activeElement.tagName === 'VIDEO' || document.activeElement.tagName === 'IFRAME');
      if ((isRight || isLeft) && videoFocused) {
          e.preventDefault(); e.stopPropagation();
          var btnClass = isRight ? '[class*="next-button"]' : '[class*="prev-button"]';
          var btn = document.querySelector(btnClass);
          if (btn) btn.click();
      }
  }, true);

  // 4. Resize signal from parent (fullscreen enter/exit) — forces iSpring player to recalculate layout
  window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'RESIZE') {
          window.dispatchEvent(new Event('resize'));
      }
  });
</script>
`;
          htmlContent = htmlContent.replace('</body>', injectionPayload + '</body>');
          
          const modifiedFile = new File([htmlContent], file.name, { type: file.type || "text/html" });
          await this.uploadFile(modifiedFile, relativePath);
        };
      }

      return () => this.uploadFile(file, relativePath);
    });

    if (!indexHtmlFound) {
      throw new Error("Invalid iSpring package. No index.html found.");
    }

    // Run queue with max concurrency
    let currentIndex = 0;
    const runWorker = async (): Promise<void> => {
      while (currentIndex < uploadTasks.length) {
        const task = uploadTasks[currentIndex++];
        await task();
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENCY, uploadTasks.length); i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);

    // Generate and upload manifest.json listing all files for offline download
    const allRelativePaths = this.files.map(f => {
      const parts = f.webkitRelativePath.split("/");
      return parts.slice(1).join("/");
    }).filter(Boolean);

    const manifestContent = JSON.stringify({ files: allRelativePaths }, null, 2);
    const manifestFile = new File([manifestContent], "manifest.json", { type: "application/json" });
    await this.uploadFile(manifestFile, "manifest.json");

    const indexUrl = `${r2PublicUrl}/content/${this.moduleId}/${this.versionId}/index.html`;

    return { indexUrl };
  }
}
