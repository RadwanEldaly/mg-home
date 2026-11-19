// ============================================================================
// MG HOME CMS — Staging Safety Guards & Harness Unit Test Suite (Phase 03.10)
// File: tests/staging_safety_and_harness.test.mjs
// Run: node --test tests/staging_safety_and_harness.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

import {
  validateStagingTarget,
  scanCodebaseProtectedAssets,
  validateCleanupReport,
  compareReportAgainstLive,
  REQUIRED_ROOT_FILES,
  REQUIRED_ROOT_DIRS,
  REQUIRED_ASSET_DIRS
} from '../scripts/cleanup_orphaned_media.mjs';

import {
  StagingReportTracker,
  base32Decode,
  generateTOTP
} from '../scripts/verify_staging_integration.mjs';

describe('10. Staging Safety Guards & Test Harness Unit Tests', () => {
  // --------------------------------------------------------------------------
  // Group 1: Staging Allowlist & Anti-Production Safety Guards (Mandatory Allowlist)
  // --------------------------------------------------------------------------
  it('validateStagingTarget must reject Production project references unconditionally', () => {
    const resProd1 = validateStagingTarget('mg-home-production', ['mg-home-production']);
    assert.equal(resProd1.valid, false);
    assert.match(resProd1.error, /CRITICAL SAFETY VIOLATION.*Production/);

    const resProd2 = validateStagingTarget('mg-prod-db', ['mg-prod-db']);
    assert.equal(resProd2.valid, false);
    assert.match(resProd2.error, /Production/);
  });

  it('validateStagingTarget must fail closed if STAGING_PROJECT_ALLOWLIST is not provided', () => {
    const resNoList = validateStagingTarget('mg-home-staging', null);
    assert.equal(resNoList.valid, false);
    assert.match(resNoList.error, /STAGING_PROJECT_ALLOWLIST is mandatory/);

    const resEmptyList = validateStagingTarget('mg-home-staging', []);
    assert.equal(resEmptyList.valid, false);
    assert.match(resEmptyList.error, /STAGING_PROJECT_ALLOWLIST is mandatory/);
  });

  it('validateStagingTarget must enforce strict explicit allowlist membership', () => {
    const allowlist = ['mghome-staging-eu', 'mghome-staging-us'];

    // Unauthorized project
    const resForbidden = validateStagingTarget('mghome-staging-asia', allowlist);
    assert.equal(resForbidden.valid, false);
    assert.match(resForbidden.error, /not in the authorized STAGING_PROJECT_ALLOWLIST/);

    // Authorized project
    const resAuthorized = validateStagingTarget('mghome-staging-eu', allowlist);
    assert.equal(resAuthorized.valid, true);
  });

  // --------------------------------------------------------------------------
  // Group 2: Codebase Static Asset Scanner & Root Validation (Fail-Closed)
  // --------------------------------------------------------------------------
  it('scanCodebaseProtectedAssets must fail closed if repository root is empty', () => {
    const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-test-empty-'));
    try {
      assert.throws(
        () => scanCodebaseProtectedAssets(emptyTempDir),
        /FAIL-CLOSED: Cannot verify repository root/
      );
    } finally {
      fs.rmSync(emptyTempDir, { recursive: true, force: true });
    }
  });

  it('scanCodebaseProtectedAssets must fail closed when any required root file or directory is missing', () => {
    function createMockRepo(excludeItem) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-mock-repo-'));
      if (excludeItem !== 'index.html') fs.writeFileSync(path.join(tmp, 'index.html'), '<html></html>', 'utf8');
      if (excludeItem !== 'package.json') fs.writeFileSync(path.join(tmp, 'package.json'), '{}', 'utf8');
      if (excludeItem !== 'supabase') fs.mkdirSync(path.join(tmp, 'supabase'));
      if (excludeItem !== 'js') fs.mkdirSync(path.join(tmp, 'js'));
      if (excludeItem !== 'css') fs.mkdirSync(path.join(tmp, 'css'));
      for (const ad of REQUIRED_ASSET_DIRS) {
        if (excludeItem !== ad) fs.mkdirSync(path.join(tmp, ad));
      }
      return tmp;
    }

    // 1. Missing package.json
    const tmpNoPkg = createMockRepo('package.json');
    try {
      assert.throws(
        () => scanCodebaseProtectedAssets(tmpNoPkg),
        /Missing required root file: "package\.json"/
      );
    } finally {
      fs.rmSync(tmpNoPkg, { recursive: true, force: true });
    }

    // 2. Missing supabase/ directory
    const tmpNoSupabase = createMockRepo('supabase');
    try {
      assert.throws(
        () => scanCodebaseProtectedAssets(tmpNoSupabase),
        /Missing required root directory: "supabase"/
      );
    } finally {
      fs.rmSync(tmpNoSupabase, { recursive: true, force: true });
    }

    // 3. Missing js/ directory
    const tmpNoJs = createMockRepo('js');
    try {
      assert.throws(
        () => scanCodebaseProtectedAssets(tmpNoJs),
        /Missing required root directory: "js"/
      );
    } finally {
      fs.rmSync(tmpNoJs, { recursive: true, force: true });
    }

    // 4. Missing required asset directory (e.g. Logo)
    const tmpNoLogo = createMockRepo('Logo');
    try {
      assert.throws(
        () => scanCodebaseProtectedAssets(tmpNoLogo),
        /Missing required asset directory: "Logo"/
      );
    } finally {
      fs.rmSync(tmpNoLogo, { recursive: true, force: true });
    }
  });

  it('scanCodebaseProtectedAssets must recursively scan index.html, js, css, Img, Logo, assets and protect paths', () => {
    const { protectedPaths, protectedBasenames } = scanCodebaseProtectedAssets(process.cwd());

    assert.ok(protectedPaths.size > 0, 'Must detect protected paths');
    assert.ok(protectedBasenames.size > 0, 'Must detect protected basenames');

    // Verify known static website images are protected
    assert.ok(
      protectedBasenames.has('mg-home-logo.jpeg') || protectedPaths.has('assets/logo/mg-home-logo.jpeg'),
      'Must protect mg-home-logo.jpeg'
    );

    // Verify images inside asset/Img subdirectories are protected
    const hasAnyImageProtected = Array.from(protectedBasenames).some((b) =>
      b.endsWith('.jpeg') || b.endsWith('.png') || b.endsWith('.webp')
    );
    assert.ok(hasAnyImageProtected, 'Must protect image assets recursively');
  });

  // --------------------------------------------------------------------------
  // Group 3: Strict Cleanup Report Validation (validateCleanupReport)
  // --------------------------------------------------------------------------
  it('validateCleanupReport must enforce complete schema and reject malformed reports', () => {
    const validReport = {
      schema_version: '3.10',
      project_ref: 'mg-staging-test',
      target_url: 'https://mg-staging-test.supabase.co',
      generated_at: new Date().toISOString(),
      total_objects: 2,
      kept_count: 0,
      candidate_count: 2,
      orphaned_candidates: [
        { path: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg', created_at: new Date().toISOString() },
        { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png', created_at: new Date().toISOString() }
      ]
    };

    const ctx = { projectRef: 'mg-staging-test', targetUrl: 'https://mg-staging-test.supabase.co', expectedSchemaVersion: '3.10' };

    // Valid report passes
    assert.equal(validateCleanupReport(validReport, ctx).valid, true);

    // 1. Incompatible schema version
    const invalidSchema = { ...validReport, schema_version: '2.0' };
    const resSchema = validateCleanupReport(invalidSchema, ctx);
    assert.equal(resSchema.valid, false);
    assert.match(resSchema.error, /incompatible/);

    // 2. Mismatched project_ref
    const wrongRef = { ...validReport, project_ref: 'other-project' };
    const resRef = validateCleanupReport(wrongRef, ctx);
    assert.equal(resRef.valid, false);
    assert.match(resRef.error, /does not match target project/);

    // 3. Mismatched target_url
    const wrongUrl = { ...validReport, target_url: 'https://evil.supabase.co' };
    const resUrl = validateCleanupReport(wrongUrl, ctx);
    assert.equal(resUrl.valid, false);
    assert.match(resUrl.error, /does not match target URL/);

    // 4. Non-array orphaned_candidates
    const nonArrayCandidates = { ...validReport, orphaned_candidates: 'not-an-array' };
    const resNonArray = validateCleanupReport(nonArrayCandidates, ctx);
    assert.equal(resNonArray.valid, false);
    assert.match(resNonArray.error, /orphaned_candidates must be an array/);

    // 5. Duplicate candidate paths
    const duplicatePathReport = {
      ...validReport,
      candidate_count: 2,
      orphaned_candidates: [
        { path: 'uploads/dup.jpg', size_bytes: 100, mimetype: 'image/jpeg', created_at: new Date().toISOString() },
        { path: 'uploads/dup.jpg', size_bytes: 100, mimetype: 'image/jpeg', created_at: new Date().toISOString() }
      ]
    };
    const resDup = validateCleanupReport(duplicatePathReport, ctx);
    assert.equal(resDup.valid, false);
    assert.match(resDup.error, /Duplicate candidate path detected/);

    // 6. Invalid size_bytes (zero or negative)
    const invalidSizeReport = {
      ...validReport,
      candidate_count: 1,
      orphaned_candidates: [
        { path: 'uploads/zero.jpg', size_bytes: 0, mimetype: 'image/jpeg', created_at: new Date().toISOString() }
      ]
    };
    const resSize = validateCleanupReport(invalidSizeReport, { ...ctx, candidateCount: 1 });
    assert.equal(resSize.valid, false);
    assert.match(resSize.error, /invalid size_bytes/);

    // 7. Missing or unknown mimetype
    const missingMimeReport = {
      ...validReport,
      candidate_count: 1,
      orphaned_candidates: [
        { path: 'uploads/nomime.jpg', size_bytes: 500, mimetype: 'unknown', created_at: new Date().toISOString() }
      ]
    };
    const resMime = validateCleanupReport(missingMimeReport, ctx);
    assert.equal(resMime.valid, false);
    assert.match(resMime.error, /missing or invalid mimetype/);
  });

  // --------------------------------------------------------------------------
  // Group 4: Candidate Set Comparison with Live Storage (compareReportAgainstLive)
  // --------------------------------------------------------------------------
  it('compareReportAgainstLive must enforce exact match of count, paths, sizes, and MIME types', () => {
    const approvedCandidates = [
      { path: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' },
      { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];

    // 1. Identical candidate set
    const identicalLive = [
      { name: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' },
      { name: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    assert.equal(compareReportAgainstLive(approvedCandidates, identicalLive).valid, true);

    // 2. Count mismatch
    const countMismatchLive = [
      { name: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' }
    ];
    const resCount = compareReportAgainstLive(approvedCandidates, countMismatchLive);
    assert.equal(resCount.valid, false);
    assert.match(resCount.error, /Candidate count changed/);

    // 3. Modified size
    const tamperedSizeLive = [
      { name: 'uploads/orphan1.jpg', size_bytes: 9999, mimetype: 'image/jpeg' },
      { name: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    const resSize = compareReportAgainstLive(approvedCandidates, tamperedSizeLive);
    assert.equal(resSize.valid, false);
    assert.match(resSize.error, /size changed/);

    // 4. Modified MIME type
    const tamperedMimeLive = [
      { name: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'application/octet-stream' },
      { name: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    const resMime = compareReportAgainstLive(approvedCandidates, tamperedMimeLive);
    assert.equal(resMime.valid, false);
    assert.match(resMime.error, /mimetype changed/);

    // 5. Unknown orphan in live storage
    const newOrphanLive = [
      { name: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' },
      { name: 'uploads/unexpected.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    const resNew = compareReportAgainstLive(approvedCandidates, newOrphanLive);
    assert.equal(resNew.valid, false);
    assert.match(resNew.error, /not present in approved report/);
  });

  // --------------------------------------------------------------------------
  // Group 5: Staging Report Tracker, Teardown Integrity & Exit Codes
  // --------------------------------------------------------------------------
  it('StagingReportTracker must return non-zero exit code when configurations are missing', () => {
    const tracker = new StagingReportTracker();
    tracker.missingConfig('STAGING_SUPABASE_URL', 'URL missing');
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 1, 'Must return 1 on missing configuration');
  });

  it('StagingReportTracker must return non-zero exit code when any test is skipped', () => {
    const tracker = new StagingReportTracker();
    tracker.pass('Test 1 Passed');
    tracker.skip('Test 2 Skipped', 'Missing TOTP secret');
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 1, 'Must return 1 when tests are skipped');
  });

  it('StagingReportTracker must return non-zero exit code when any test fails', () => {
    const tracker = new StagingReportTracker();
    tracker.pass('Test 1 Passed');
    tracker.fail('Test 2 Failed', new Error('RLS assertion failed'));
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 1, 'Must return 1 when any test fails');
  });

  it('StagingReportTracker must return non-zero exit code when teardown / cleanup fails', () => {
    const tracker = new StagingReportTracker();
    tracker.pass('Test 1 Passed');
    tracker.pass('Test 2 Passed');
    // Simulate teardown failure (e.g. Storage delete failed or object still exists)
    tracker.cleanupFailure('uploads/test_artifact.jpg', new Error('Storage DELETE returned HTTP 500'));
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 1, 'Must return 1 when teardown fails');
    assert.equal(tracker.cleanupFailures.length, 1);
  });

  it('StagingReportTracker must return 0 only when all tests pass with zero skips, zero config errors, and zero teardown failures', () => {
    const tracker = new StagingReportTracker();
    tracker.pass('Test 1 Passed');
    tracker.pass('Test 2 Passed');
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 0, 'Must return 0 on 100% pass rate with clean teardown');
  });

  // --------------------------------------------------------------------------
  // Group 6: RFC 6238 TOTP Generator Unit Tests
  // --------------------------------------------------------------------------
  it('base32Decode must decode standard RFC Base32 strings and reject invalid input', () => {
    // RFC 4648 test vector: 'MZXW6YTBOI======' -> 'foobar'
    const decoded = base32Decode('MZXW6YTBOI======');
    assert.equal(decoded.toString('utf8'), 'foobar');

    assert.throws(
      () => base32Decode('INVALID_CHARS_1890!'),
      /Invalid Base32 character/
    );
  });

  it('generateTOTP must produce valid 6-digit numeric codes', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = generateTOTP(secret);

    assert.match(code, /^\d{6}$/, 'TOTP code must be exactly 6 digits');
    assert.equal(code.length, 6);

    // Consistency check within the same interval
    const codeAgain = generateTOTP(secret);
    assert.equal(code, codeAgain, 'TOTP code must be consistent within current 30s epoch');
  });
});
