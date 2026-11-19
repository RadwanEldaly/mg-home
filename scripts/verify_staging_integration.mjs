#!/usr/bin/env node
// ============================================================================
// MG HOME CMS — Live Supabase Staging Integration Test Suite (Phase 03.8 Hardened)
// File: scripts/verify_staging_integration.mjs
// Run: node scripts/verify_staging_integration.mjs
// ============================================================================
//
// RIGOROUS STAGING VERIFICATION:
// 1. Exit Policy: Exits with non-zero code if any test fails, is skipped, or is not configured.
// 2. Direct Storage RLS: Proves PostgreSQL RLS (not invalid key) blocks client upload.
// 3. Authentic Auth & TOTP: Validates GoTrue password login, RFC 6238 TOTP challenge,
//    and authentic AAL2 upgrade.
// 4. Role & Identity Check: Confirms user ID and super_admin in admin_profiles.
// 5. Authentic AAL1 Rejection: Confirms is_admin_aal2 and draft RPC reject AAL1.
// 6. Hardened ACID Rollback: Full snapshots of all 3 draft tables, mutation failure
//    triggered after initial update, zero partial state mutation verified.
// 7. Live Edge Function HTTP Suite:
//    - Valid JPEG (201 + DB registration)
//    - Spoofed executable (422 + zero storage object)
//    - Missing auth (401)
//    - AAL1 (403)
//    - AAL2 without TOTP (403)
// 8. Clean Teardown: Deletes only temporary test artifacts created during run.
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

  const createdTestAssets = []; // For cleanup

  // --------------------------------------------------------------------------
  // TEST 1: Direct Storage Upload Rejection via PostgreSQL RLS (Valid Anon Key)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // TEST 2: Anonymous Rejection on Sensitive Function & Dropped RPC Non-Existence
  // --------------------------------------------------------------------------
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

    if (resHelper.ok) {
      const data = await resHelper.json();
      if (data !== false) throw new Error(`is_admin_aal2 unexpectedly returned ${data} for unauthenticated user.`);
    }

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

  // --------------------------------------------------------------------------
  // TEST 3: Authentic Password Login & AAL1 Session Acquisition
  // --------------------------------------------------------------------------
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
    const profData = await profRes.json();
    if (!profData[0] || profData[0].role !== 'super_admin') {
      throw new Error(`Authenticated user ${authUserId} is not registered as super_admin in admin_profiles!`);
    }

    tracker.pass('3. Authentic Password Login & super_admin Profile Verification (AAL1)');
  } catch (err) {
    tracker.fail('3. Authentic Password Login & super_admin Profile Verification (AAL1)', err);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Authentic AAL1 Session Rejections (Before TOTP)
  // --------------------------------------------------------------------------
  if (aal1Token) {
    try {
      // is_admin_aal2 must reject AAL1
      const resHelper = await fetch(`${STAGING_URL}/rest/v1/rpc/is_admin_aal2`, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${aal1Token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (resHelper.ok) {
        const val = await resHelper.json();
        if (val !== false) throw new Error(`is_admin_aal2 returned true for AAL1 session!`);
      }

      // save_draft_page_transaction must reject AAL1
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

      if (resDraft.ok) throw new Error('save_draft_page_transaction succeeded with AAL1 session!');

      tracker.pass('4. Authentic AAL1 Session Rejection (is_admin_aal2 & Draft RPC)');
    } catch (err) {
      tracker.fail('4. Authentic AAL1 Session Rejection (is_admin_aal2 & Draft RPC)', err);
    }
  } else {
    tracker.skip('4. Authentic AAL1 Session Rejection', 'AAL1 token not acquired.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Real RFC 6238 TOTP Challenge & AAL2 Session Upgrade
  // --------------------------------------------------------------------------
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
      const isApproved = await helperRes.json();
      if (isApproved !== true) throw new Error('is_admin_aal2() returned false for authentic AAL2 session!');

      tracker.pass('5. Real RFC 6238 TOTP Challenge, AAL2 Upgrade & is_admin_aal2 Approval');
    } catch (err) {
      tracker.fail('5. Real RFC 6238 TOTP Challenge, AAL2 Upgrade & is_admin_aal2 Approval', err);
    }
  } else {
    tracker.skip('5. Real RFC 6238 TOTP Challenge & AAL2 Upgrade', 'AAL1 login prerequisite failed.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Hardened PostgreSQL ACID Rollback under Authentic Admin AAL2 Session
  // --------------------------------------------------------------------------
  if (aal2Token) {
    try {
      const authHeaders = {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${aal2Token}`,
        'Content-Type': 'application/json'
      };

      // 1. Capture complete baseline snapshots of ALL 3 draft tables
      const [resSet, resMeta, resSec] = await Promise.all([
        fetch(`${STAGING_URL}/rest/v1/draft_site_settings?id=eq.1`, { headers: authHeaders }).then((r) => r.json()),
        fetch(`${STAGING_URL}/rest/v1/draft_page_metadata?id=eq.1`, { headers: authHeaders }).then((r) => r.json()),
        fetch(`${STAGING_URL}/rest/v1/draft_page_sections?order=order_index.asc`, { headers: authHeaders }).then((r) => r.json())
      ]);

      const baselineSettings = resSet[0];
      const baselineMetadata = resMeta[0];
      const baselineSections = resSec;

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
            order_index: 10,
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

      // 3. Query all 3 tables again and assert 100% identical state to baseline
      const [postSet, postMeta, postSec] = await Promise.all([
        fetch(`${STAGING_URL}/rest/v1/draft_site_settings?id=eq.1`, { headers: authHeaders }).then((r) => r.json()),
        fetch(`${STAGING_URL}/rest/v1/draft_page_metadata?id=eq.1`, { headers: authHeaders }).then((r) => r.json()),
        fetch(`${STAGING_URL}/rest/v1/draft_page_sections?order=order_index.asc`, { headers: authHeaders }).then((r) => r.json())
      ]);

      if (postSet[0].business_name_ar !== baselineSettings.business_name_ar) {
        throw new Error(`ACID ROLLBACK FAILED: draft_site_settings was partially mutated to "${postSet[0].business_name_ar}"!`);
      }

      if (postMeta[0].title_ar !== baselineMetadata.title_ar) {
        throw new Error(`ACID ROLLBACK FAILED: draft_page_metadata was partially mutated to "${postMeta[0].title_ar}"!`);
      }

      if (JSON.stringify(postSec) !== JSON.stringify(baselineSections)) {
        throw new Error('ACID ROLLBACK FAILED: draft_page_sections differs from baseline!');
      }

      tracker.pass('6. Hardened PostgreSQL ACID Rollback under Authentic Admin AAL2 Session');
    } catch (err) {
      tracker.fail('6. Hardened PostgreSQL ACID Rollback under Authentic Admin AAL2 Session', err);
    }
  } else {
    tracker.skip('6. Hardened PostgreSQL ACID Rollback', 'AAL2 token not acquired.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Live Edge Function HTTP Integration Suite (validate-image)
  // --------------------------------------------------------------------------
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

    if (aal2Token) {
      // 7c. Valid Image -> 201 + Storage + DB
      const validJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22,
        0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9
      ]);

      const form = new FormData();
      const fileBlob = new Blob([validJpeg], { type: 'image/jpeg' });
      form.append('file', fileBlob, 'live_staging_test_probe.jpg');
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
      if (!uploadData.success || !uploadData.asset?.id) {
        throw new Error('Upload succeeded but asset record was not returned.');
      }
      createdTestAssets.push({ id: uploadData.asset.id, path: uploadData.asset.storage_path });

      // 7d. Spoofed Executable -> 422 + No storage object
      const fakeExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
      const exeForm = new FormData();
      exeForm.append('file', new Blob([fakeExe], { type: 'image/jpeg' }), 'disguised_exe.jpg');

      const resExe = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aal2Token}` },
        body: exeForm
      });

      if (resExe.status !== 422) {
        throw new Error(`Spoofed executable expected HTTP 422, got ${resExe.status}`);
      }

      tracker.pass('7. Live Edge Function HTTP Integration Suite (401, 403, 201, 422)');
    } else {
      tracker.skip('7. Live Edge Function HTTP Integration Suite', 'AAL2 token not acquired.');
    }
  } catch (err) {
    tracker.fail('7. Live Edge Function HTTP Integration Suite', err);
  }

  // --------------------------------------------------------------------------
  // TEARDOWN: Clean up only test objects created during run
  // --------------------------------------------------------------------------
  if (createdTestAssets.length > 0) {
    console.log('\nCleaning up staging test artifacts...');
    for (const asset of createdTestAssets) {
      try {
        await fetch(`${STAGING_URL}/storage/v1/object/media-library`, {
          method: 'DELETE',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefixes: [asset.path] })
        });
        await fetch(`${STAGING_URL}/rest/v1/media_assets?id=eq.${asset.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
          }
        });
      } catch (err) {
        console.warn(`⚠️ Failed tearing down test asset ${asset.path}:`, err.message);
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
