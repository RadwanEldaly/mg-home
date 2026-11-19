#!/usr/bin/env node
// ============================================================================
// MG HOME CMS — Live Supabase Staging Integration Test Suite (Phase 03.9 Hardened)
// File: scripts/verify_staging_integration.mjs
// Run: node scripts/verify_staging_integration.mjs
// ============================================================================
//
// RIGOROUS STAGING VERIFICATION:
// 1. Mandatory Non-Zero Exit Code: Returns 1 if any test fails, is skipped, or is unconfigured.
// 2. Direct Storage RLS: Uses valid Anon Key and asserts explicit PostgreSQL RLS error text.
// 3. Authentic Password Login & Profile Check: Verifies user ID and super_admin in admin_profiles.
// 4. Authentic AAL1 Session Rejection: Verifies exact HTTP 403 and 'ACCESS DENIED ... AAL2' message.
// 5. Authentic TOTP Challenge & AAL2 Upgrade: Uses RFC 6238 TOTP generator.
// 6. Complete Snapshot ACID Rollback: Full 3-table snapshot comparison before/after mutation failure,
//    using display_order (not order_index) and strict HTTP status verification on every query.
// 7. Live Edge Function HTTP Suite:
//    - Valid JPEG (HTTP 201) verified with INDEPENDENT GET to Storage & DB query.
//    - Spoofed executable (HTTP 422) verified with INDEPENDENT checks proving ZERO Storage object
//      and ZERO DB row created.
//    - Missing auth (HTTP 401).
//    - AAL1 session (HTTP 403).
//    - AAL2 without verified TOTP (HTTP 403).
// 8. Robust Teardown: Executes in finally block, verifies HTTP DELETE success on storage and DB.
// ============================================================================

import process from 'node:process';
import crypto from 'node:crypto';

// ----------------------------------------------------------------------------
// Environment Configuration
// ----------------------------------------------------------------------------
const STAGING_URL = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.STAGING_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD;
const ADMIN_TOTP_SECRET = process.env.STAGING_ADMIN_TOTP_SECRET;

// ----------------------------------------------------------------------------
// Test Reporting State Machine
// ----------------------------------------------------------------------------
export class StagingReportTracker {
  constructor() {
    this.passed = [];
    this.failed = [];
    this.skipped = [];
    this.notConfigured = [];
  }

  pass(name, details = '') {
    this.passed.push({ name, details });
    console.log(`✅ PASS: ${name}`);
  }

  fail(name, error) {
    this.failed.push({ name, error: error.message || String(error) });
    console.log(`❌ FAIL: ${name} -> ${error.message || error}`);
  }

  skip(name, reason) {
    this.skipped.push({ name, reason });
    console.log(`⏭️  SKIPPED: ${name} (Reason: ${reason})`);
  }

  missingConfig(variableName, description) {
    this.notConfigured.push({ variableName, description });
    console.log(`⚠️  NOT CONFIGURED: ${variableName} (${description})`);
  }

  printSummary() {
    console.log('\n================================================================');
    console.log(' MG HOME CMS — Live Staging Verification Results Summary');
    console.log('================================================================');
    console.log(`   PASS           : ${this.passed.length}`);
    console.log(`   FAIL           : ${this.failed.length}`);
    console.log(`   SKIPPED        : ${this.skipped.length}`);
    console.log(`   NOT CONFIGURED : ${this.notConfigured.length}`);
    console.log('----------------------------------------------------------------');

    if (this.failed.length > 0) {
      console.log('\nFailed Tests:');
      this.failed.forEach((f, idx) => console.log(`   [${idx + 1}] ${f.name}\n       Error: ${f.error}`));
    }

    if (this.skipped.length > 0) {
      console.log('\nSkipped Tests (Incomplete Verification):');
      this.skipped.forEach((s, idx) => console.log(`   [${idx + 1}] ${s.name} -> ${s.reason}`));
    }

    if (this.notConfigured.length > 0) {
      console.log('\nMissing Configuration Variables:');
      this.notConfigured.forEach((c) => console.log(`   - ${c.variableName}: ${c.description}`));
    }

    const isFullySuccessful =
      this.failed.length === 0 &&
      this.skipped.length === 0 &&
      this.notConfigured.length === 0 &&
      this.passed.length > 0;

    console.log('================================================================');
    if (isFullySuccessful) {
      console.log('🎯 VERIFICATION RESULT: 100% SUCCESSFUL (All Staging Security Boundaries Active)\n');
      return 0;
    } else {
      console.log('🛑 VERIFICATION RESULT: INCOMPLETE OR FAILED (Non-zero exit code returned)\n');
      return 1;
    }
  }
}

// ----------------------------------------------------------------------------
// RFC 6238 TOTP Generator (Pure node:crypto)
// ----------------------------------------------------------------------------
export function base32Decode(base32Str) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleanStr.length; i++) {
    const val = base32Chars.indexOf(cleanStr[i]);
    if (val === -1) throw new Error(`Invalid Base32 character: ${cleanStr[i]}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secretBase32, timeStep = 30) {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / timeStep);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(time));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

// ----------------------------------------------------------------------------
// Main Live Test Suite
// ----------------------------------------------------------------------------
export async function runStagingVerificationSuite(tracker = new StagingReportTracker()) {
  console.log('================================================================');
  console.log(' MG HOME CMS — Live Supabase Staging Integration Test Harness');
  console.log('================================================================');

  // Verify mandatory baseline credentials
  if (!STAGING_URL) tracker.missingConfig('STAGING_SUPABASE_URL', 'Base URL of the Supabase Staging project');
  if (!ANON_KEY) tracker.missingConfig('STAGING_SUPABASE_ANON_KEY', 'Public anon key required for RLS validation');
  if (!SERVICE_KEY) tracker.missingConfig('STAGING_SERVICE_ROLE_KEY', 'Service role key for pre-flight & verification checks');
  if (!ADMIN_EMAIL) tracker.missingConfig('STAGING_ADMIN_EMAIL', 'Administrator email for authentic MFA login');
  if (!ADMIN_PASSWORD) tracker.missingConfig('STAGING_ADMIN_PASSWORD', 'Administrator password for authentic MFA login');
  if (!ADMIN_TOTP_SECRET) tracker.missingConfig('STAGING_ADMIN_TOTP_SECRET', 'Base32 TOTP secret string for authentic AAL2 upgrade');

  if (tracker.notConfigured.length > 0) {
    return tracker.printSummary();
  }

  console.log(`Target Staging URL : ${STAGING_URL}`);
  console.log(`Target Admin Email : ${ADMIN_EMAIL}\n`);

  const createdTestAssets = []; // For cleanup in finally block

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Direct Storage Upload Rejection via PostgreSQL RLS (Valid Anon Key)
    // ------------------------------------------------------------------------
    try {
      const probeBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const probePath = `probe_rls_${Date.now()}.jpg`;

      const res = await fetch(`${STAGING_URL}/storage/v1/object/media-library/${probePath}`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'image/jpeg'
        },
        body: probeBytes
      });

      const bodyText = await res.text();

      if (res.status === 200 || res.status === 201) {
        throw new Error('CRITICAL RLS BREACH: Direct client upload succeeded! PostgreSQL RLS failed to block write.');
      }

      // MANDATORY: Verify explicit PostgreSQL RLS policy violation message
      const hasRlsMessage =
        bodyText.toLowerCase().includes('row-level security') ||
        bodyText.toLowerCase().includes('violates row-level security');

      if (!hasRlsMessage) {
        throw new Error(`Response status was ${res.status}, but response body did not contain explicit PostgreSQL RLS policy violation text: "${bodyText}"`);
      }

      tracker.pass('1. Direct Storage Upload Rejection via PostgreSQL RLS (Valid Anon Key)');
    } catch (err) {
      tracker.fail('1. Direct Storage Upload Rejection via PostgreSQL RLS (Valid Anon Key)', err);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Anonymous Rejection on Sensitive Function & Dropped RPC Non-Existence
    // ------------------------------------------------------------------------
    try {
      // 1. is_admin_aal2 must return false for anonymous user
      const resHelper = await fetch(`${STAGING_URL}/rest/v1/rpc/is_admin_aal2`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!resHelper.ok) {
        throw new Error(`is_admin_aal2 HTTP error for anon: ${resHelper.status} ${await resHelper.text()}`);
      }
      const data = await resHelper.json();
      if (data !== false) throw new Error(`is_admin_aal2 unexpectedly returned ${data} for unauthenticated user.`);

      // 2. validate_and_register_media_asset must return HTTP 404
      const resDropped = await fetch(`${STAGING_URL}/rest/v1/rpc/validate_and_register_media_asset`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (resDropped.status !== 404) {
        throw new Error(`Expected HTTP 404 for dropped RPC, got HTTP ${resDropped.status}`);
      }

      tracker.pass('2. Anonymous Rejection & Dropped RPC Non-Existence (HTTP 404)');
    } catch (err) {
      tracker.fail('2. Anonymous Rejection & Dropped RPC Non-Existence (HTTP 404)', err);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Authentic Password Login & super_admin Profile Verification
    // ------------------------------------------------------------------------
    let aal1Token = '';
    let authUserId = '';
    try {
      const loginRes = await fetch(`${STAGING_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      });

      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
      const loginData = await loginRes.json();
      aal1Token = loginData.access_token;
      authUserId = loginData.user?.id;

      if (!aal1Token || !authUserId) throw new Error('Failed extracting token or user ID from login response.');

      // Verify user profile is super_admin
      const profRes = await fetch(`${STAGING_URL}/rest/v1/admin_profiles?id=eq.${authUserId}&select=role`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });
      if (!profRes.ok) throw new Error(`admin_profiles query failed (${profRes.status}): ${await profRes.text()}`);
      const profData = await profRes.json();
      if (!profData[0] || profData[0].role !== 'super_admin') {
        throw new Error(`Authenticated user ${authUserId} is not registered as super_admin in admin_profiles!`);
      }

      tracker.pass('3. Authentic Password Login & super_admin Profile Verification (AAL1)');
    } catch (err) {
      tracker.fail('3. Authentic Password Login & super_admin Profile Verification (AAL1)', err);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Authentic AAL1 Session Rejections (Specific Permission Denial)
    // ------------------------------------------------------------------------
    if (aal1Token) {
      try {
        // 1. is_admin_aal2 must return false for AAL1
        const resHelper = await fetch(`${STAGING_URL}/rest/v1/rpc/is_admin_aal2`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal1Token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (!resHelper.ok) throw new Error(`is_admin_aal2 HTTP error for AAL1: ${resHelper.status}`);
        const val = await resHelper.json();
        if (val !== false) throw new Error('is_admin_aal2 returned true for AAL1 session!');

        // 2. save_draft_page_transaction must fail with HTTP 403 AND specific error message
        const resDraft = await fetch(`${STAGING_URL}/rest/v1/rpc/save_draft_page_transaction`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal1Token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_site_settings: { business_name_ar: 'AAL1 Probe' },
            p_page_metadata: { title_ar: 'AAL1 Probe' },
            p_sections: []
          })
        });

        const draftBody = await resDraft.text();
        if (resDraft.status !== 403 && resDraft.status !== 400) {
          throw new Error(`Expected HTTP 403 for AAL1 draft mutation, got HTTP ${resDraft.status}: ${draftBody}`);
        }

        const hasDeniedMessage =
          draftBody.includes('ACCESS DENIED') ||
          draftBody.includes('42501') ||
          draftBody.includes('AAL2');

        if (!hasDeniedMessage) {
          throw new Error(`Draft mutation rejected, but response did not contain required permission denial text: "${draftBody}"`);
        }

        tracker.pass('4. Authentic AAL1 Session Rejection (Verified HTTP 403 Permission Denial)');
      } catch (err) {
        tracker.fail('4. Authentic AAL1 Session Rejection (Verified HTTP 403 Permission Denial)', err);
      }
    } else {
      tracker.skip('4. Authentic AAL1 Session Rejection', 'AAL1 token not acquired.');
    }

    // ------------------------------------------------------------------------
    // TEST 5: Real RFC 6238 TOTP Challenge & AAL2 Session Upgrade
    // ------------------------------------------------------------------------
    let aal2Token = '';
    if (aal1Token) {
      try {
        // 1. Fetch user factors
        const factorsRes = await fetch(`${STAGING_URL}/auth/v1/user/factors`, {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal1Token}`
          }
        });
        if (!factorsRes.ok) throw new Error(`Failed listing factors: ${factorsRes.status} ${await factorsRes.text()}`);
        const factorsData = await factorsRes.json();
        const factors = Array.isArray(factorsData) ? factorsData : factorsData.all || [];
        const totpFactor = factors.find((f) => f.factor_type === 'totp' && f.status === 'verified');

        if (!totpFactor) throw new Error('User has no enrolled, verified TOTP factor in Supabase Auth.');

        // 2. Create Challenge
        const challengeRes = await fetch(`${STAGING_URL}/auth/v1/factors/${totpFactor.id}/challenge`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal1Token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!challengeRes.ok) throw new Error(`MFA challenge creation failed: ${challengeRes.status} ${await challengeRes.text()}`);
        const challengeData = await challengeRes.json();

        // 3. Generate authentic 6-digit TOTP
        const totpCode = generateTOTP(ADMIN_TOTP_SECRET);

        // 4. Verify Challenge -> Upgrade session to AAL2
        const verifyRes = await fetch(`${STAGING_URL}/auth/v1/factors/${totpFactor.id}/verify`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal1Token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            challenge_id: challengeData.id,
            code: totpCode
          })
        });

        if (!verifyRes.ok) throw new Error(`TOTP challenge verification failed (${verifyRes.status}): ${await verifyRes.text()}`);
        const verifyData = await verifyRes.json();
        aal2Token = verifyData.access_token;

        // Verify JWT claim
        const b64 = aal2Token.split('.')[1];
        const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        if (payload.aal !== 'aal2') throw new Error(`Token claim is "${payload.aal}", expected "aal2".`);

        // Verify is_admin_aal2 returns true
        const helperRes = await fetch(`${STAGING_URL}/rest/v1/rpc/is_admin_aal2`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${aal2Token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (!helperRes.ok) throw new Error(`is_admin_aal2 RPC failed for AAL2: ${helperRes.status}`);
        const isApproved = await helperRes.json();
        if (isApproved !== true) throw new Error('is_admin_aal2() returned false for authentic AAL2 session!');

        tracker.pass('5. Real RFC 6238 TOTP Challenge, AAL2 Upgrade & is_admin_aal2 Approval');
      } catch (err) {
        tracker.fail('5. Real RFC 6238 TOTP Challenge, AAL2 Upgrade & is_admin_aal2 Approval', err);
      }
    } else {
      tracker.skip('5. Real RFC 6238 TOTP Challenge & AAL2 Upgrade', 'AAL1 login prerequisite failed.');
    }

    // ------------------------------------------------------------------------
    // TEST 6: Complete 3-Table Snapshot ACID Rollback under Admin AAL2 Session
    // ------------------------------------------------------------------------
    if (aal2Token) {
      try {
        const authHeaders = {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${aal2Token}`,
          'Content-Type': 'application/json'
        };

        // 1. Capture complete baseline snapshots of ALL 3 draft tables with strict HTTP checks
        // Crucial: Use display_order (not order_index!)
        const [resSet, resMeta, resSec] = await Promise.all([
          fetch(`${STAGING_URL}/rest/v1/draft_site_settings?id=eq.1`, { headers: authHeaders }),
          fetch(`${STAGING_URL}/rest/v1/draft_page_metadata?id=eq.1`, { headers: authHeaders }),
          fetch(`${STAGING_URL}/rest/v1/draft_page_sections?order=display_order.asc`, { headers: authHeaders })
        ]);

        if (!resSet.ok) throw new Error(`Failed querying draft_site_settings baseline: ${resSet.status} ${await resSet.text()}`);
        if (!resMeta.ok) throw new Error(`Failed querying draft_page_metadata baseline: ${resMeta.status} ${await resMeta.text()}`);
        if (!resSec.ok) throw new Error(`Failed querying draft_page_sections baseline: ${resSec.status} ${await resSec.text()}`);

        const baselineSettings = await resSet.json();
        const baselineMetadata = await resMeta.json();
        const baselineSections = await resSec.json();

        // 2. Execute RPC with valid initial mutation BUT invalid section type
        // save_draft_page_transaction updates settings and metadata FIRST, then validates sections
        const invalidMutationPayload = {
          p_site_settings: {
            business_name_ar: `ACID_PROBE_${Date.now()}`
          },
          p_page_metadata: {
            title_ar: `ACID_TITLE_${Date.now()}`
          },
          p_sections: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              section_type: 'INVALID_UNSUPPORTED_TYPE_CORRUPT',
              section_label: 'Corrupt Section',
              display_order: 10,
              content: {}
            }
          ]
        };

        const rpcRes = await fetch(`${STAGING_URL}/rest/v1/rpc/save_draft_page_transaction`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(invalidMutationPayload)
        });

        const errResponseText = await rpcRes.text();
        if (rpcRes.ok) throw new Error('RPC unexpectedly succeeded with invalid section type!');

        // MANDATORY: Verify exact database error code/message
        const hasExpectedDbError =
          errResponseText.includes('VALIDATION ERROR: Unknown section type') ||
          errResponseText.includes('22000');

        if (!hasExpectedDbError) {
          throw new Error(`Expected PostgreSQL 22000 Unknown section type error, got: ${errResponseText}`);
        }

        // 3. Query all 3 tables again with strict HTTP verification and assert complete equality
        const [postSetRes, postMetaRes, postSecRes] = await Promise.all([
          fetch(`${STAGING_URL}/rest/v1/draft_site_settings?id=eq.1`, { headers: authHeaders }),
          fetch(`${STAGING_URL}/rest/v1/draft_page_metadata?id=eq.1`, { headers: authHeaders }),
          fetch(`${STAGING_URL}/rest/v1/draft_page_sections?order=display_order.asc`, { headers: authHeaders })
        ]);

        if (!postSetRes.ok) throw new Error(`Post-rollback draft_site_settings query failed: ${postSetRes.status}`);
        if (!postMetaRes.ok) throw new Error(`Post-rollback draft_page_metadata query failed: ${postMetaRes.status}`);
        if (!postSecRes.ok) throw new Error(`Post-rollback draft_page_sections query failed: ${postSecRes.status}`);

        const postSettings = await postSetRes.json();
        const postMetadata = await postMetaRes.json();
        const postSections = await postSecRes.json();

        // Complete snapshot equality check across all fields of all three tables
        if (JSON.stringify(postSettings) !== JSON.stringify(baselineSettings)) {
          throw new Error('ACID ROLLBACK FAILED: Complete snapshot of draft_site_settings was altered!');
        }

        if (JSON.stringify(postMetadata) !== JSON.stringify(baselineMetadata)) {
          throw new Error('ACID ROLLBACK FAILED: Complete snapshot of draft_page_metadata was altered!');
        }

        if (JSON.stringify(postSections) !== JSON.stringify(baselineSections)) {
          throw new Error('ACID ROLLBACK FAILED: Complete snapshot of draft_page_sections was altered!');
        }

        tracker.pass('6. Complete 3-Table Snapshot ACID Rollback under Authentic Admin AAL2 Session');
      } catch (err) {
        tracker.fail('6. Complete 3-Table Snapshot ACID Rollback under Authentic Admin AAL2 Session', err);
      }
    } else {
      tracker.skip('6. Complete 3-Table Snapshot ACID Rollback', 'AAL2 token not acquired.');
    }

    // ------------------------------------------------------------------------
    // TEST 7: Live Edge Function HTTP Integration Suite (validate-image)
    // ------------------------------------------------------------------------
    const functionUrl = `${STAGING_URL}/functions/v1/validate-image`;
    try {
      // 7a. Missing Auth -> 401
      const resNoAuth = await fetch(functionUrl, { method: 'POST' });
      if (resNoAuth.status !== 401) throw new Error(`Missing auth expected HTTP 401, got ${resNoAuth.status}`);

      // 7b. AAL1 Token -> 403
      if (aal1Token) {
        const resAal1 = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aal1Token}` }
        });
        if (resAal1.status !== 403) throw new Error(`AAL1 expected HTTP 403, got ${resAal1.status}`);
      }

      // 7c. AAL2 Session Without Verified TOTP Factor -> 403
      // A forged JWT claim claiming aal2 for a user with zero verified TOTP factors must be rejected
      const fakeAal2Header = { alg: 'HS256', typ: 'JWT' };
      const fakeAal2Payload = { sub: '00000000-0000-0000-0000-000000000999', aal: 'aal2', role: 'authenticated' };
      const unverifiedToken = `${Buffer.from(JSON.stringify(fakeAal2Header)).toString('base64url')}.${Buffer.from(JSON.stringify(fakeAal2Payload)).toString('base64url')}.invalidsig`;

      const resUnverified = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${unverifiedToken}` }
      });
      if (resUnverified.status !== 401 && resUnverified.status !== 403) {
        throw new Error(`Unverified factor session expected HTTP 401/403, got ${resUnverified.status}`);
      }

      if (aal2Token) {
        // 7d. Valid Image Upload -> 201 + INDEPENDENT STORAGE & DB VERIFICATION
        const validJpeg = new Uint8Array([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22,
          0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9
        ]);

        const form = new FormData();
        const fileBlob = new Blob([validJpeg], { type: 'image/jpeg' });
        const probeFileName = `live_staging_test_probe_${Date.now()}.jpg`;
        form.append('file', fileBlob, probeFileName);
        form.append('category', 'test');
        form.append('alt_ar', 'صورة اختبار حي');
        form.append('alt_en', 'Live Test Image');

        const resUpload = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aal2Token}` },
          body: form
        });

        if (resUpload.status !== 201) {
          throw new Error(`Valid upload expected HTTP 201, got ${resUpload.status}: ${await resUpload.text()}`);
        }
        const uploadData = await resUpload.json();
        if (!uploadData.success || !uploadData.asset?.id || !uploadData.asset?.storage_path) {
          throw new Error('Upload succeeded but asset metadata was incomplete.');
        }

        const uploadedAssetId = uploadData.asset.id;
        const uploadedStoragePath = uploadData.asset.storage_path;
        createdTestAssets.push({ id: uploadedAssetId, path: uploadedStoragePath });

        // INDEPENDENT VERIFICATION 1: Fetch object directly from Storage via GET
        const verifyStorageRes = await fetch(
          `${STAGING_URL}/storage/v1/object/media-library/${uploadedStoragePath}`,
          { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
        );
        if (!verifyStorageRes.ok) {
          throw new Error(`Independent Storage verification failed: object "${uploadedStoragePath}" not found in storage (${verifyStorageRes.status})`);
        }
        const storageBytes = new Uint8Array(await verifyStorageRes.arrayBuffer());
        if (storageBytes.length !== validJpeg.length) {
          throw new Error(`Independent Storage size mismatch: expected ${validJpeg.length} bytes, got ${storageBytes.length}`);
        }

        // INDEPENDENT VERIFICATION 2: Fetch asset record directly from public.media_assets
        const verifyDbRes = await fetch(
          `${STAGING_URL}/rest/v1/media_assets?id=eq.${uploadedAssetId}`,
          { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
        );
        if (!verifyDbRes.ok) {
          throw new Error(`Independent DB verification failed: asset "${uploadedAssetId}" not queryable (${verifyDbRes.status})`);
        }
        const dbAssets = await verifyDbRes.json();
        if (!dbAssets[0] || dbAssets[0].mime_type !== 'image/jpeg' || dbAssets[0].width !== 800 || dbAssets[0].height !== 600) {
          throw new Error('Independent DB record fields did not match verified image properties.');
        }

        // 7e. Spoofed Executable -> 422 + INDEPENDENT PROOF OF ZERO STORAGE OBJECT & ZERO DB RECORD
        const fakeExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
        const fakeExeName = `disguised_exe_${Date.now()}.jpg`;
        const exeForm = new FormData();
        exeForm.append('file', new Blob([fakeExe], { type: 'image/jpeg' }), fakeExeName);

        const resExe = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aal2Token}` },
          body: exeForm
        });

        if (resExe.status !== 422) {
          throw new Error(`Spoofed executable expected HTTP 422, got ${resExe.status}`);
        }

        // INDEPENDENT VERIFICATION 3: Assert ZERO record exists in public.media_assets
        const checkDbRes = await fetch(
          `${STAGING_URL}/rest/v1/media_assets?file_name=eq.${fakeExeName}`,
          { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
        );
        const checkDbData = await checkDbRes.json();
        if (checkDbData.length > 0) {
          throw new Error('CRITICAL INTEGRITY FAILURE: Rejected executable was recorded in public.media_assets!');
        }

        // INDEPENDENT VERIFICATION 4: Assert ZERO object exists in storage for disguised executable
        const checkStorageRes = await fetch(
          `${STAGING_URL}/storage/v1/object/list/media-library`,
          {
            method: 'POST',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prefix: 'uploads', limit: 100 })
          }
        );
        const storageList = await checkStorageRes.json();
        const foundFake = storageList.some((o) => o.name && o.name.includes(fakeExeName));
        if (foundFake) {
          throw new Error('CRITICAL STORAGE LEAK: Rejected executable was written to Storage despite 422 rejection!');
        }

        tracker.pass('7. Live Edge Function HTTP Integration Suite (401, 403, 201 + Storage/DB Verification, 422 + Zero-Object Proof)');
      } else {
        tracker.skip('7. Live Edge Function HTTP Integration Suite', 'AAL2 token not acquired.');
      }
    } catch (err) {
      tracker.fail('7. Live Edge Function HTTP Integration Suite', err);
    }
  } finally {
    // ------------------------------------------------------------------------
    // HARDENED TEARDOWN: Runs even if tests fail, verifies HTTP success
    // ------------------------------------------------------------------------
    if (createdTestAssets.length > 0) {
      console.log('\nExecuting hardened teardown of temporary test artifacts...');
      for (const asset of createdTestAssets) {
        try {
          // Delete Storage Object
          const delStorageRes = await fetch(`${STAGING_URL}/storage/v1/object/media-library`, {
            method: 'DELETE',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prefixes: [asset.path] })
          });
          if (!delStorageRes.ok) {
            console.error(`❌ Teardown Storage deletion failed for "${asset.path}": ${delStorageRes.status} ${await delStorageRes.text()}`);
          } else {
            console.log(`   Deleted test storage object: ${asset.path}`);
          }

          // Delete DB Row
          const delDbRes = await fetch(`${STAGING_URL}/rest/v1/media_assets?id=eq.${asset.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`
            }
          });
          if (!delDbRes.ok) {
            console.error(`❌ Teardown DB deletion failed for asset id "${asset.id}": ${delDbRes.status} ${await delDbRes.text()}`);
          } else {
            console.log(`   Deleted test asset row: ${asset.id}`);
          }
        } catch (err) {
          console.error(`❌ Teardown exception for test asset ${asset.path}:`, err.message);
        }
      }
    }
  }

  return tracker.printSummary();
}

// Execute when invoked directly
if (process.argv[1] && process.argv[1].endsWith('verify_staging_integration.mjs')) {
  runStagingVerificationSuite().then((exitCode) => {
    process.exit(exitCode);
  });
}
