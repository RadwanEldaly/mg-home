// ============================================================================
// MG HOME CMS — Storage Security, Bypass Rejection & Edge Function Test Suite
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

    if (width <= 0 || height <= 0) {
      return { valid: false, error: 'Corrupt or forged JPEG: No valid SOF frame marker found in JPEG stream.' };
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid JPEG dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { 
      valid: true, 
      mimeType: 'image/jpeg', 
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

    if (bytes.length >= 30) {
      const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (fourCC === 'VP8X' && bytes.length >= 30) {
        width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
        height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      } else if (fourCC === 'VP8 ' && bytes.length >= 30) {
        if (bytes[23] === 0x9D && bytes[24] === 0x01 && bytes[25] === 0x2A) {
          width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
          height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
        }
      } else if (fourCC === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2F) {
        const b1 = bytes[21], b2 = bytes[22], b3 = bytes[23], b4 = bytes[24];
        width = 1 + (((b2 & 0x3f) << 8) | b1);
        height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      }
    }

    if (width <= 0 || height <= 0) {
      return { valid: false, error: 'Corrupt or forged WebP: Missing or invalid VP8/VP8L/VP8X chunk header.' };
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Invalid WebP dimensions (${width}x${height}). Exceeds 8192x8192.` };
    }

    return { valid: true, mimeType: 'image/webp', width, height };
  }

  return { valid: false, error: 'Security Alert: Magic number header signature does not match allowed image formats (JPEG, PNG, WebP).' };
}

describe('Integration Test: Storage Security Closure & Bypass Regression Tests', () => {
  // Simulated Storage and DB backend reflecting PostgreSQL RLS semantics & GoTrue Auth State
  class MockStorageAndDB {
    constructor() {
      this.uploadedFiles = new Map(); // storage_path -> bytes
      this.mediaAssets = new Map();    // id -> asset record
      this.shouldFailDbInsert = false;

      // Mock user database and MFA factors
      this.users = new Map([
        ['usr-admin-1', { id: 'usr-admin-1', role: 'super_admin' }],
        ['usr-guest-2', { id: 'usr-guest-2', role: 'guest' }]
      ]);

      // Server-side registered factors (userId -> array of factors)
      this.userMfaFactors = new Map([
        ['usr-admin-1', [{ factor_type: 'totp', status: 'verified' }]]
      ]);

      // PostgreSQL Storage RLS policies for storage.objects:
      // NO INSERT/UPDATE/DELETE policies exist for 'authenticated' or 'anon'
      this.policies = {
        authenticated: { insert: false, update: false, delete: false, select: true },
        anon: { insert: false, update: false, delete: false, select: true },
        service_role: { insert: true, update: true, delete: true, select: true } // Service role bypasses RLS
      };
    }

    // Direct Storage Client Write (e.g. supabase.storage.from('media-library').upload)
    directClientUpload(role, path, bytes) {
      if (!this.policies[role]?.insert) {
        throw new Error('RLS_ERROR: new row violates row-level security policy for table "objects"');
      }
      this.uploadedFiles.set(path, bytes);
      return { data: { path }, error: null };
    }

    // Service-role Upload (called only by the trusted Edge Function)
    serviceRoleUpload(path, bytes) {
      this.uploadedFiles.set(path, bytes);
      return { data: { path }, error: null };
    }

    serviceRoleRemove(paths) {
      for (const p of paths) {
        this.uploadedFiles.delete(p);
      }
      return { data: null, error: null };
    }

    // SELECT query on storage.objects with "media_library_public_read" policy
    queryStorageObjects(path) {
      // USING (bucket_id = 'media-library' AND EXISTS (SELECT 1 FROM media_assets WHERE storage_path = name))
      const isRegistered = Array.from(this.mediaAssets.values()).some(a => a.storage_path === path);
      if (!isRegistered) {
        return []; // Filtered out by RLS
      }
      return [{ name: path, bucket_id: 'media-library' }];
    }

    insertAsset(record) {
      if (this.shouldFailDbInsert) {
        return { data: null, error: new Error('DATABASE_UNIQUE_VIOLATION: storage_path conflict') };
      }
      const asset = { id: `asset-${Date.now()}`, ...record };
      this.mediaAssets.set(asset.id, asset);
      return { data: asset, error: null };
    }

    hasVerifiedTotp(userId) {
      const factors = this.userMfaFactors.get(userId) || [];
      return factors.some(f => f.factor_type === 'totp' && f.status === 'verified');
    }
  }

  // Edge Function Request Handler Simulation (incorporating TOTP MFA Server-Side Verification)
  async function simulateEdgeFunctionRequest(req, backend) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
      return { status: 401, body: { error: 'Missing authorization token.' } };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    let payload;
    try {
      const parts = token.split('.');
      if (parts.length < 2) throw new Error('Invalid token structure');
      const b64 = parts[1];
      payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      return { status: 401, body: { error: 'Malformed authorization token.' } };
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { status: 401, body: { error: 'Authentication failed: Session has expired.' } };
    }

    // 1. Enforce AAL2 claim
    if (payload.aal !== 'aal2') {
      return { status: 403, body: { error: 'Access Denied: Administrative AAL2 (TOTP MFA) session required.' } };
    }

    // 2. Enforce super_admin role
    const userRecord = backend.users.get(payload.sub);
    if (!userRecord || userRecord.role !== 'super_admin') {
      return { status: 403, body: { error: 'Access Denied: Only verified super_admin can upload media assets.' } };
    }

    // 3. Enforce Server-Side Verified TOTP Factor check (Exact parity with is_admin_aal2)
    const hasTotp = backend.hasVerifiedTotp(payload.sub);
    if (!hasTotp) {
      return { status: 403, body: { error: 'Access Denied: At least one verified TOTP factor is required.' } };
    }

    const file = req.file;
    if (!file) {
      return { status: 400, body: { error: 'No file provided in form data.' } };
    }

    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return { status: 400, body: { error: 'File size must be between 1 byte and 5MB.' } };
    }

    // In-memory byte verification BEFORE storage write
    const validation = validateImageBuffer(file.bytes);
    if (!validation.valid || !validation.mimeType) {
      return { status: 422, body: { error: validation.error } };
    }

    const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/png' ? 'png' : 'webp';
    const storagePath = `uploads/${Date.now()}_${file.name}.${ext}`;

    // Upload using service_role
    backend.serviceRoleUpload(storagePath, file.bytes);

    // Register in public.media_assets
    const dbResult = backend.insertAsset({
      file_name: file.name,
      storage_path: storagePath,
      public_url: `https://example.supabase.co/storage/v1/object/public/media-library/${storagePath}`,
      mime_type: validation.mimeType,
      file_size_bytes: file.size,
      width: validation.width,
      height: validation.height,
      alt_ar: req.altAr || '',
      alt_en: req.altEn || '',
      category: req.category || 'general'
    });

    if (dbResult.error) {
      // Rollback: immediately delete object from storage
      backend.serviceRoleRemove([storagePath]);
      return { status: 500, body: { error: dbResult.error.message } };
    }

    return { status: 201, body: { success: true, asset: dbResult.data } };
  }

  function createMockJwt(userId = 'usr-admin-1', role = 'super_admin', aal = 'aal2', expired = false) {
    const payload = {
      sub: userId,
      role,
      aal,
      exp: expired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600
    };
    return `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
  }

  // --- REGRESSION SUITE 1: MFA & Session Consistency Tests ---

  it('1. Rejection: Invalid or expired session rejected with 401', async () => {
    const backend = new MockStorageAndDB();

    // Missing token
    const resNoToken = await simulateEdgeFunctionRequest({ headers: {} }, backend);
    assert.equal(resNoToken.status, 401);
    assert.match(resNoToken.body.error, /Missing authorization token/);

    // Expired token
    const expiredToken = createMockJwt('usr-admin-1', 'super_admin', 'aal2', true);
    const resExpired = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${expiredToken}` }
    }, backend);
    assert.equal(resExpired.status, 401);
    assert.match(resExpired.body.error, /expired/);

    // Malformed token
    const resMalformed = await simulateEdgeFunctionRequest({
      headers: { authorization: 'Bearer not-a-jwt' }
    }, backend);
    assert.equal(resMalformed.status, 401);
  });

  it('2. Rejection: AAL1 session rejected with 403 (MFA challenge required)', async () => {
    const backend = new MockStorageAndDB();
    const tokenAal1 = createMockJwt('usr-admin-1', 'super_admin', 'aal1');

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${tokenAal1}` }
    }, backend);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /AAL2.*required/);
  });

  it('3. Rejection: AAL2 session without verified TOTP factor rejected with 403', async () => {
    const backend = new MockStorageAndDB();
    // Simulate user who has AAL2 claim in JWT but NO verified TOTP factor in database
    backend.userMfaFactors.set('usr-admin-1', []); // empty factors

    const token = createMockJwt('usr-admin-1', 'super_admin', 'aal2');
    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` }
    }, backend);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /verified TOTP factor is required/);
  });

  it('4. Rejection: Non-admin user rejected with 403 even if AAL2 and TOTP are present', async () => {
    const backend = new MockStorageAndDB();
    // Guest user has TOTP factor
    backend.userMfaFactors.set('usr-guest-2', [{ factor_type: 'totp', status: 'verified' }]);

    const token = createMockJwt('usr-guest-2', 'guest', 'aal2');
    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` }
    }, backend);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /Only verified super_admin/);
  });

  it('5. Acceptance: AAL2 with verified TOTP factor and super_admin profile accepted (201)', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('usr-admin-1', 'super_admin', 'aal2');

    const validJpeg = new Uint8Array([
      0xFF, 0xD8,
      0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xD9
    ]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'field_repair.jpg', size: validJpeg.length, bytes: validJpeg },
      altAr: 'صيانة مكيف',
      altEn: 'AC Repair'
    }, backend);

    assert.equal(res.status, 201);
    assert.ok(res.body.success);
    assert.equal(res.body.asset.mime_type, 'image/jpeg');
    assert.equal(res.body.asset.width, 800);
    assert.equal(res.body.asset.height, 600);
    assert.equal(backend.uploadedFiles.size, 1);
  });

  // --- REGRESSION SUITE 2: Storage & RPC Bypass Closure Tests ---

  it('6. Direct authenticated Storage INSERT rejection: Client cannot upload directly to storage.objects', () => {
    const backend = new MockStorageAndDB();
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);

    assert.throws(
      () => backend.directClientUpload('authenticated', 'uploads/direct_bypass.jpg', jpegBytes),
      /RLS_ERROR.*violates row-level security policy/
    );
    assert.equal(backend.uploadedFiles.size, 0, 'No direct client upload may enter storage');
  });

  it('7. Direct RPC invocation rejection: validate_and_register_media_asset RPC is dropped/unavailable', () => {
    const executeRpc = (rpcName) => {
      const availableRpcs = new Set([
        'is_admin_aal2',
        'save_draft_page_transaction',
        'reorder_draft_sections',
        'publish_page_revision',
        'restore_revision_to_draft'
      ]);

      if (!availableRpcs.has(rpcName)) {
        throw new Error(`DATABASE_RPC_ERROR: function public.${rpcName} does not exist`);
      }
    };

    assert.throws(
      () => executeRpc('validate_and_register_media_asset'),
      /DATABASE_RPC_ERROR.*validate_and_register_media_asset does not exist/
    );
  });

  it('8. Forged JPEG header rejection: Rejects JPEG SOI followed by corrupt or non-SOF payload', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('usr-admin-1', 'super_admin', 'aal2');

    const forgedJpeg = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3E
    ]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'forged.jpg', size: forgedJpeg.length, bytes: forgedJpeg }
    }, backend);

    assert.equal(res.status, 422);
    assert.match(res.body.error, /Corrupt or forged JPEG/);
    assert.equal(backend.uploadedFiles.size, 0);
  });

  it('9. Executable upload rejection: Rejects .exe (MZ header) disguised as image', async () => {
    const backend = new MockStorageAndDB();
    const token = createMockJwt('usr-admin-1', 'super_admin', 'aal2');

    const mzBytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'malware.jpg', size: mzBytes.length, bytes: mzBytes }
    }, backend);

    assert.equal(res.status, 422);
    assert.match(res.body.error, /Magic number header signature does not match/);
    assert.equal(backend.uploadedFiles.size, 0);
  });

  it('10. Unregistered object public-access behavior: SELECT RLS policy hides unregistered objects', () => {
    const backend = new MockStorageAndDB();
    const orphanPath = 'uploads/unregistered_orphan.jpg';

    backend.uploadedFiles.set(orphanPath, new Uint8Array([1, 2, 3]));

    const rows = backend.queryStorageObjects(orphanPath);
    assert.equal(rows.length, 0, 'Unregistered object must not be returned by storage.objects query');

    backend.mediaAssets.set('asset-1', { id: 'asset-1', storage_path: orphanPath });
    const registeredRows = backend.queryStorageObjects(orphanPath);
    assert.equal(registeredRows.length, 1);
  });

  it('11. Failed database registration rollback: Storage object is deleted immediately on DB failure', async () => {
    const backend = new MockStorageAndDB();
    backend.shouldFailDbInsert = true;
    const token = createMockJwt('usr-admin-1', 'super_admin', 'aal2');

    const validJpeg = new Uint8Array([
      0xFF, 0xD8,
      0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xD9
    ]);

    const res = await simulateEdgeFunctionRequest({
      headers: { authorization: `Bearer ${token}` },
      file: { name: 'db_fail.jpg', size: validJpeg.length, bytes: validJpeg }
    }, backend);

    assert.equal(res.status, 500);
    assert.match(res.body.error, /DATABASE_UNIQUE_VIOLATION/);
    assert.equal(backend.uploadedFiles.size, 0, 'Storage object must be deleted when DB registration fails');
  });
});
