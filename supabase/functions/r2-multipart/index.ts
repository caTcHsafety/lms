import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucketName = Deno.env.get("R2_BUCKET_NAME");

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error("Missing R2 configuration environment variables");
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    switch (action) {
      case "START": {
        const { key } = payload;
        const command = new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: "application/zip",
        });
        const result = await s3Client.send(command);
        return new Response(JSON.stringify({ uploadId: result.UploadId, key }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "SIGN_BATCH": {
        const { uploadId, key, totalParts } = payload;
        const urls = [];
        for (let i = 1; i <= totalParts; i++) {
          const command = new UploadPartCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            PartNumber: i,
          });
          const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
          urls.push({ partNumber: i, url });
        }
        return new Response(JSON.stringify({ urls }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "COMPLETE": {
        const { uploadId, key, parts } = payload; // parts: [{ PartNumber, ETag }]
        // Sort parts to ensure S3 API accepts them
        parts.sort((a: any, b: any) => a.PartNumber - b.PartNumber);
        
        const command = new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        });
        const result = await s3Client.send(command);
        return new Response(JSON.stringify({ success: true, location: result.Location }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ABORT": {
        const { uploadId, key } = payload;
        const command = new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
        });
        await s3Client.send(command);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("Error in r2-multipart:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
