import { SupabaseClient } from "@supabase/supabase-js";

export const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_RETRIES = 3;

interface UploadProgressCallback {
  (progressPercent: number, bytesUploaded: number, totalBytes: number): void;
}

interface UploadConfig {
  file: File;
  moduleId: string;
  supabase: SupabaseClient;
  onProgress?: UploadProgressCallback;
  onAbort?: () => void;
}

export class MultipartUploader {
  private file: File;
  private moduleId: string;
  private supabase: SupabaseClient;
  private onProgress?: UploadProgressCallback;
  public onAbort?: () => void;
  private isAborted = false;
  
  private uploadId: string | null = null;
  private key: string | null = null;

  constructor(config: UploadConfig) {
    this.file = config.file;
    this.moduleId = config.moduleId;
    this.supabase = config.supabase;
    this.onProgress = config.onProgress;
    this.onAbort = config.onAbort;
  }

  public abort() {
    this.isAborted = true;
    if (this.onAbort) {
      this.onAbort();
    }
  }

  private async callEdgeFunction(action: string, payload: any = {}) {
    const { data, error } = await this.supabase.functions.invoke("r2-multipart", {
      body: { action, ...payload },
    });

    if (error) {
      throw new Error(`Edge Function Error (${action}): ${error.message}`);
    }
    
    if (data && data.error) {
      throw new Error(`Edge Function Data Error (${action}): ${data.error}`);
    }

    return data;
  }

  private async uploadPart(url: string, chunk: Blob, partNumber: number, attempt = 1): Promise<{ PartNumber: number; ETag: string }> {
    try {
      const response = await fetch(url, {
        method: "PUT",
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const etag = response.headers.get("ETag");
      if (!etag) {
        throw new Error(`No ETag returned for part ${partNumber}`);
      }

      return { PartNumber: partNumber, ETag: etag };
    } catch (error) {
      if (attempt < MAX_RETRIES && !this.isAborted) {
        console.warn(`Part ${partNumber} failed, retrying (${attempt}/${MAX_RETRIES})...`);
        return this.uploadPart(url, chunk, partNumber, attempt + 1);
      }
      throw error;
    }
  }

  public async upload(): Promise<string> {
    const totalBytes = this.file.size;
    const totalParts = Math.ceil(totalBytes / CHUNK_SIZE);
    const timestamp = Date.now();
    const sanitizedFilename = this.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const objectKey = `zips/${this.moduleId}/${timestamp}_${sanitizedFilename}`;

    try {
      // 1. START
      const startRes = await this.callEdgeFunction("START", { key: objectKey });
      this.uploadId = startRes.uploadId;
      this.key = startRes.key;

      if (this.isAborted) throw new Error("Upload aborted");

      // 2. SIGN_BATCH
      const signRes = await this.callEdgeFunction("SIGN_BATCH", {
        uploadId: this.uploadId,
        key: this.key,
        totalParts,
      });
      const urls: { partNumber: number; url: string }[] = signRes.urls;

      if (this.isAborted) throw new Error("Upload aborted");

      // 3. Upload chunks in parallel (pool of 3)
      const parts: { PartNumber: number; ETag: string }[] = [];
      let bytesUploaded = 0;
      
      const poolLimit = 3;
      let urlIndex = 0;

      const runWorker = async (): Promise<void> => {
        while (urlIndex < totalParts) {
          if (this.isAborted) throw new Error("Upload aborted");

          const currentIndex = urlIndex++;
          const partInfo = urls[currentIndex];
          const start = (partInfo.partNumber - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalBytes);
          const chunk = this.file.slice(start, end);

          const result = await this.uploadPart(partInfo.url, chunk, partInfo.partNumber);
          parts.push(result);

          bytesUploaded += chunk.size;
          if (this.onProgress) {
            const percent = Math.round((bytesUploaded / totalBytes) * 100);
            this.onProgress(percent, bytesUploaded, totalBytes);
          }
        }
      };

      const workers = [];
      for (let i = 0; i < poolLimit; i++) {
        workers.push(runWorker());
      }

      await Promise.all(workers);

      if (this.isAborted) throw new Error("Upload aborted");

      // 4. COMPLETE
      await this.callEdgeFunction("COMPLETE", {
        uploadId: this.uploadId,
        key: this.key,
        parts,
      });

      return this.key!;

    } catch (error) {
      // 5. ABORT on error (or explicit cancel)
      if (this.uploadId && this.key) {
        try {
          await this.callEdgeFunction("ABORT", { uploadId: this.uploadId, key: this.key });
          console.log("Upload aborted on S3 successfully.");
        } catch (abortError) {
          console.error("Failed to abort upload on S3:", abortError);
        }
      }
      throw error;
    }
  }
}
