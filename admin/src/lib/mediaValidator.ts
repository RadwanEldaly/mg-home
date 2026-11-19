// ============================================================================
// MG HOME CMS — Trusted Media Validator & Security Sanitizer (v2.3.0)
// File: admin/src/lib/mediaValidator.ts
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';

export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: string;
  width?: number;
  height?: number;
  headerHex?: string;
  headerBytes?: Uint8Array;
}

/**
 * Validates binary magic signatures for image files.
 * Rejects MIME spoofing (e.g. executable/script files disguised as images).
 */
export async function inspectImageBuffer(file: File): Promise<MediaValidationResult> {
  if (!file) {
    return { isValid: false, error: 'No file provided.' };
  }

  // 1. File size check (1 byte to 5MB)
  if (file.size <= 0) {
    return { isValid: false, error: 'File is empty (0 bytes).' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { isValid: false, error: `File exceeds maximum allowed size of 5MB (${(file.size / (1024 * 1024)).toFixed(2)}MB).` };
  }

  // 2. Read first 32 bytes for magic number verification
  const headerSlice = file.slice(0, 32);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) {
    return { isValid: false, error: 'File header too short for binary signature verification.' };
  }

  // Helper: bytes to hex
  const hex = Array.from(bytes.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  let detectedMime: string | undefined;

  // JPEG SOI: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    detectedMime = 'image/jpeg';
  }
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  else if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    detectedMime = 'image/png';
  }
  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    detectedMime = 'image/webp';
  }

  if (!detectedMime) {
    return {
      isValid: false,
      error: `Security Alert: Invalid image magic signature (${hex}). File is not a valid JPEG, PNG, or WebP.`,
      headerHex: hex
    };
  }

  // Check declared MIME vs binary detected MIME
  if (file.type && file.type !== detectedMime && !(file.type === 'image/jpg' && detectedMime === 'image/jpeg')) {
    return {
      isValid: false,
      error: `Security Alert: Declared MIME type '${file.type}' does not match verified binary signature '${detectedMime}'.`,
      detectedMime,
      headerHex: hex
    };
  }

  // 3. Decode dimensions via Image element or ImageBitmap
  let width = 0;
  let height = 0;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          width = img.naturalWidth;
          height = img.naturalHeight;
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Corrupt image payload cannot be decoded.'));
        };
        img.src = url;
      });
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: `Image Decoding Failure: ${err.message || 'File cannot be rendered into bitmap.'}`,
      detectedMime
    };
  }

  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
    return {
      isValid: false,
      error: `Invalid dimensions (${width}x${height}). Dimensions must be between 1x1 and 8192x8192.`,
      detectedMime,
      width,
      height
    };
  }

  return {
    isValid: true,
    detectedMime,
    width,
    height,
    headerHex: hex,
    headerBytes: bytes.slice(0, 32)
  };
}

/**
 * Uploads media via the authenticated server-side Edge Function (validate-image).
 * Validates bytes in memory, verifies super_admin AAL2 session, uploads to storage,
 * and inserts into media_assets atomically.
 */
export async function uploadAndRegisterMedia(
  file: File,
  category: string = 'general',
  altAr: string = '',
  altEn: string = ''
): Promise<{ success: boolean; error?: string; asset?: any }> {
  // 1. Client pre-flight verification for immediate UX feedback
  const verification = await inspectImageBuffer(file);
  if (!verification.isValid || !verification.detectedMime) {
    return { success: false, error: verification.error };
  }

  // 2. Offline / local dev fallback when Supabase is not configured
  if (!isSupabaseConfigured || !supabase) {
    const localAsset = {
      id: `local-${Date.now()}`,
      file_name: file.name,
      storage_path: `uploads/local_${file.name}`,
      public_url: URL.createObjectURL(file),
      mime_type: verification.detectedMime,
      file_size_bytes: file.size,
      width: verification.width || 1200,
      height: verification.height || 800,
      alt_ar: altAr,
      alt_en: altEn,
      category
    };
    return { success: true, asset: localAsset };
  }

  // 3. Obtain active administrative session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.access_token) {
    return {
      success: false,
      error: 'Authentication required: You must be logged in with an AAL2 administrative session to upload media.'
    };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/validate-image`;

  // 4. Construct multipart payload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('alt_ar', altAr);
  formData.append('alt_en', altEn);

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `Server-side image verification failed with status ${response.status}.`
      };
    }

    return {
      success: true,
      asset: result.asset
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Upload failed: ${err.message || 'Unable to communicate with media validation service.'}`
    };
  }
}
