// ============================================================================
// MG HOME CMS — Server-Side Edge Function: Image Signature & Decoding Validator
// File: supabase/functions/validate-image/index.ts (Deno / Supabase Edge Runtime)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ValidationResponse {
  valid: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Validates binary magic bytes and decodes image dimensions from headers.
 */
function validateImageBuffer(bytes: Uint8Array): ValidationResponse {
  if (bytes.length < 12) {
    return { valid: false, error: "File buffer too small to contain valid image headers." };
  }

  // 1. Check PNG Signature (89 50 4E 47 0D 0A 1A 0A)
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    // PNG IHDR chunk starts at byte 12. Width is at bytes 16-19, Height at bytes 20-23 (big endian)
    if (bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      return { valid: true, mimeType: "image/png", width, height };
    }
    return { valid: true, mimeType: "image/png" };
  }

  // 2. Check JPEG SOI Marker (FF D8 FF)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    // Parse SOF0 / SOF2 markers to extract true decoded width & height
    let offset = 2;
    let width = 0;
    let height = 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      // Baseline SOF0 (0xC0) or Progressive SOF2 (0xC2)
      if (marker === 0xC0 || marker === 0xC2) {
        height = view.getUint16(offset + 5, false);
        width = view.getUint16(offset + 7, false);
        break;
      }
      // Skip chunk length
      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }

    return { 
      valid: true, 
      mimeType: "image/jpeg", 
      width: width || undefined, 
      height: height || undefined 
    };
  }

  // 3. Check WebP Signature (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp" };
  }

  return { valid: false, error: "Security Alert: Magic number header signature does not match allowed image formats (JPEG, PNG, WebP)." };
}

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Content-Type must be multipart/form-data." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided in form data." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: `File size exceeds 5MB limit (${file.size} bytes).` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const result = validateImageBuffer(bytes);

    if (!result.valid) {
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      fileName: file.name,
      fileSize: file.size,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      message: "Image signature and binary decoding verified successfully."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
