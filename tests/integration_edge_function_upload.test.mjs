// ============================================================================
// MG HOME CMS — Server-Side Edge Function Upload Integration Simulation Suite
// File: tests/integration_edge_function_upload.test.mjs
// Run: node --test tests/integration_edge_function_upload.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirror of Edge Function validateImageBuffer (Deno implementation) for Node test environment
function validateImageBuffer(bytes) {
  if (bytes.length < 12) {
    return { valid: false, error: 'File buffer too small to contain valid image headers.' };
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
    return { valid: true, mimeType: 'image/png', width, height };
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
      if (marker === 0xC0 || marker === 0xC2) {
        height = view.getUint16(offset + 5, false);
        width = view.getUint16(offset + 7, false);
        break;
      }
      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid JPEG dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { 
      valid: true, 
      mimeType: 'image/jpeg', 
      width: width || 1200, 
      height: height || 800 
    };
  }

  // 3. Check WebP Signature (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    let width = 1200;
    let height = 800;

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid WebP dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { valid: true, mimeType: 'image/webp', width, height };
  }

  return { valid: false, error: 'Security Alert: Magic number header signature does not match allowed image formats (JPEG, PNG, WebP).' };
}

describe('Integration Test: Server-Side Edge Function Media Validation & Storage Flow', () => {
  // Simulated Storage and DB backend
  class MockStorageAndDB {
    constructor() {
      this.uploadedFiles = new Map(); // storage_path -> bytes
      this.mediaAssets = new Map();    // id -> asset record
      this.shouldFailDbInsert = false;
    }

    upload(path, bytes) {
      this.uploadedFiles.set(path, bytes);
      return { data: { path }, error: null };
    }

    remove(paths) {
      for (const p of paths) {
        this.uploadedFiles.delete(p);
      }
      return { data: null, error: null };
    }

    insertAsset(record) {
      if (this.shouldFailDbInsert) {
        return { data: null, error: new Error('DATABASE_UNIQUE_VIOLATION: storage_path conflict') };
      }
      const asset = { id: `asset-${Date.now()}`, ...record };
      this.mediaAssets.set(asset.id, asset);
      return { data: asset, error: null };
    }
  }

  // Edge Function Simulation
  async function simulateEdgeFunctionRequest(req, backend) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { status: 401, body: { error: 'Missing authorization token.' } };
    }

    // Decode token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let payload;
    try {
      const b64 = token.split('.')[1];
      payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      return { status: 401, body: { error: 'Malformed authorization token.' } };
    }

    // Check AAL2
    if (payload.aal !== 'aal2') {
      return { status: 403, body: { error: 'Access Denied: Administrative AAL2 (TOTP MFA) session required.' } };
    }

    // Check super_admin role
    if (payload.role !== 'super_admin') {
      return { status: 403, body: { error: 'Access Denied: Only verified super_admin can upload media assets.' } };
    }

    // Check file
    const file = req.file;
    if (!file) {
      return { status: 400, body: { error: 'No file provided in form data.' } };
    }

    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return { status: 400, body: { error: `File size must be between 1 byte and 5MB.` } };
    }

    // Validate bytes in memory BEFORE touching storage
    const validation = validateImageBuffer(file.bytes);
    if (!validation.valid || !validation.mimeType) {
      return { status: 422, body: { error: validation.error } };
    }

    // Upload to storage
    const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/png' ? 'png' : 'webp';
    const storagePath = `uploads/${Date.now()}_${file.name}.${ext}`;

    backend.upload(storagePath, file.bytes);

    // Register in database
    const dbResult = backend.insertAsset({
      file_name: file.name,
      storage_path: storagePath,
      public_url: `https://example.supabase.co/storage/v1/object/public/media-library/${storagePath}`,
      mime_type: validation.mimeType,
      file_size_bytes: file.size,
      width: validation.width || 1200,
      height: validation.height || 800,
      alt_ar: req.altAr || '',
      alt_en: req.altEn || '',
      category: req.category || 'general'
    });

    if (dbResult.error) {
      // Rollback: delete storage object
      backend.remove([storagePath]);
      return { status: 500, body: { error: dbResult.error.message } };
    }

    return { status: 201, body: { success: true, asset: dbResult.data } };
  }

  function createMockJwt(role = 'super_admin', aal = 'aal2') {
    const payload = { sub: 'usr-admin-1', role, aal };
    return `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
  }

  it('1. Rejects request without Authorization header with 401', async () => {
    const backend = new MockStorageAndDB();
    const res = await simulateEdgeFunctionRequest({ headers: {} }, backend);
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Missing authorization token/);
  });

  it('2. Rejects AAL1 session with 403 (MFA required)', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('super_admin', 'aal1');
    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` }
    }, backend);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /AAL2/);
  });

  it('3. Rejects non-admin user with 403 even if AAL2 is present', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('regular_user', 'aal2');
    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` }
    }, backend);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Only verified super_admin/);
  });

  it('4. Rejects spoofed executable disguised as image (.exe -> .jpg) with 422 BEFORE storage write', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('super_admin', 'aal2');

    // Executable DOS/MZ header: 4D 5A
    const mzBytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'malware.jpg', size: mzBytes.length, bytes: mzBytes }
    }, backend);

    assert.equal(res.status, 422);
    assert.match(res.body.error, /Magic number header signature does not match/);
    assert.equal(backend.uploadedFiles.size, 0, 'No file must be written to storage when verification fails');
  });

  it('5. Successfully uploads and registers valid JPEG image with 201', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('super_admin', 'aal2');

    // Valid JPEG with APP0 and SOF0 marker: height = 600 (0x0258), width = 800 (0x0320)
    const jpegBytes = new Uint8Array([
      0xFF, 0xD8, // SOI
      0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, // SOF0
      0xFF, 0xD9  // EOI
    ]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'field-ac.jpg', size: jpegBytes.length, bytes: jpegBytes },
      altAr: 'صيانة تكييف',
      altEn: 'AC Repair'
    }, backend);

    assert.equal(res.status, 201);
    assert.ok(res.body.success);
    assert.equal(res.body.asset.mime_type, 'image/jpeg');
    assert.equal(res.body.asset.width, 800);
    assert.equal(res.body.asset.height, 600);
    assert.equal(backend.uploadedFiles.size, 1);
    assert.equal(backend.mediaAssets.size, 1);
  });

  it('6. Rolls back and deletes uploaded storage object if database registration fails', async () => {
    const backend = new MockStorageAndDB();
    backend.shouldFailDbInsert = true; // Force database failure
    const token = createMockJwt('super_admin', 'aal2');

    const jpegBytes = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20
    ]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'failing-db.jpg', size: jpegBytes.length, bytes: jpegBytes }
    }, backend);

    assert.equal(res.status, 500);
    assert.match(res.body.error, /DATABASE_UNIQUE_VIOLATION/);
    assert.equal(backend.uploadedFiles.size, 0, 'Storage object must be deleted when DB registration fails');
  });
});
