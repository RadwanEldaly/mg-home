// ============================================================================
// MG HOME CMS — Server-Side Edge Function: Trusted Media Upload & Validator
// File: supabase/functions/validate-image/index.ts (Deno / Supabase Edge Runtime)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.1";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

interface ValidationResponse {
  valid: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Validates binary magic bytes and decodes image dimensions from byte stream.
 */
export function validateImageBuffer(bytes: Uint8Array): ValidationResponse {
  if (bytes.length < 12) {
    return { valid: false, error: "File buffer too small to contain valid image headers." };
  }

  // 1. Check PNG Signature (89 50 4E 47 0D 0A 1A 0A)
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    let width = 0;
    let height = 0;
    if (bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      width = view.getUint32(16, false);
      height = view.getUint32(20, false);
    }
    if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid PNG dimensions (${width}x${height}). Allowed: 1x1 to 8192x8192.` };
    }
    return { valid: true, mimeType: "image/png", width, height };
  }

  // 2. Check JPEG SOI Marker (FF D8 FF)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
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
      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }

    if (width <= 0 || height <= 0) {
      return { valid: false, error: "Corrupt or forged JPEG: No valid SOF frame marker found in JPEG stream." };
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid JPEG dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { 
      valid: true, 
      mimeType: "image/jpeg", 
      width, 
      height 
    };
  }

  // 3. Check WebP Signature (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    let width = 0;
    let height = 0;

    // Parse for WebP chunks
    if (bytes.length >= 30) {
      const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (fourCC === "VP8X" && bytes.length >= 30) {
        // VP8X width: bytes 24-26 (24-bit little endian) + 1
        width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
        height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      } else if (fourCC === "VP8 " && bytes.length >= 30) {
        if (bytes[23] === 0x9D && bytes[24] === 0x01 && bytes[25] === 0x2A) {
          width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
          height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
        }
      } else if (fourCC === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2F) {
        const b1 = bytes[21], b2 = bytes[22], b3 = bytes[23], b4 = bytes[24];
        width = 1 + (((b2 & 0x3f) << 8) | b1);
        height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      }
    }

    if (width <= 0 || height <= 0) {
      return { valid: false, error: "Corrupt or forged WebP: Missing or invalid VP8/VP8L/VP8X chunk header." };
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid WebP dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { valid: true, mimeType: "image/webp", width, height };
  }

  return { valid: false, error: "Security Alert: Magic number header signature does not match allowed image formats (JPEG, PNG, WebP)." };
}

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Enforce Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: missing Supabase environment variables." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Verify authenticated user identity
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: `Authentication failed: ${userError?.message || "Invalid session."}` }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Inspect JWT claim for AAL2 (TOTP MFA)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let aalClaim: string | null = null;
    try {
      const payloadBase64 = token.split(".")[1];
      const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson);
      aalClaim = payload.aal;
    } catch {
      return new Response(JSON.stringify({ error: "Malformed authorization token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (aalClaim !== "aal2") {
      return new Response(JSON.stringify({ error: "Access Denied: Administrative AAL2 (TOTP MFA) session required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Verify super_admin role in admin_profiles table using service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profError } = await supabaseAdmin
      .from("admin_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profError || !profile || profile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Access Denied: Only verified super_admin can upload media assets." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Parse multipart form data
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Content-Type must be multipart/form-data." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const category = (formData.get("category") as string) || "general";
    const altAr = (formData.get("alt_ar") as string) || "";
    const altEn = (formData.get("alt_en") as string) || "";

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided in form data." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 6. Enforce file size limit
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: `File size must be between 1 byte and 5MB (got ${file.size} bytes).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 7. Validate binary magic numbers and decode dimensions directly on the server
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const validation = validateImageBuffer(bytes);

    if (!validation.valid || !validation.mimeType) {
      // Rejection happens BEFORE storage upload. No malicious payload touches storage!
      return new Response(JSON.stringify({ error: validation.error || "File signature validation failed." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 8. Generate safe storage path and upload via service role client
    const ext = validation.mimeType === "image/jpeg" ? "jpg" : validation.mimeType === "image/png" ? "png" : "webp";
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
    const storagePath = `uploads/${Date.now()}_${cleanBaseName}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("media-library")
      .upload(storagePath, bytes, {
        contentType: validation.mimeType,
        upsert: false
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 9. Retrieve verified public URL
    const { data: urlData } = supabaseAdmin.storage.from("media-library").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // 10. Register verified asset in public.media_assets table
    const { data: asset, error: dbError } = await supabaseAdmin
      .from("media_assets")
      .insert({
        file_name: file.name,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: validation.mimeType,
        file_size_bytes: file.size,
        width: validation.width || 1200,
        height: validation.height || 800,
        alt_ar: altAr,
        alt_en: altEn,
        category: category
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete uploaded object from storage so no unindexed files remain
      await supabaseAdmin.storage.from("media-library").remove([storagePath]);
      return new Response(JSON.stringify({ error: `Database registration failed: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      asset,
      message: "Media asset verified, uploaded, and registered successfully."
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
