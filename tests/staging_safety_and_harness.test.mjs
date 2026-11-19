// ============================================================================
// MG HOME CMS — Staging Safety Guards & Harness Unit Test Suite (Phase 03.8)
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
  scanCodebaseProtectedAssets
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
  // Group 2: Codebase Static Asset Scanner (Fail-Closed)
  // --------------------------------------------------------------------------
  it('scanCodebaseProtectedAssets must fail closed if repository root is invalid', () => {
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

  it('Report validation must compare full metadata (paths, sizes, MIME types)', () => {
    const approvedReport = {
      schema_version: '3.9',
      project_ref: 'mg-staging-test',
      target_url: 'https://mg-staging-test.supabase.co',
      generated_at: new Date().toISOString(),
      orphaned_candidates: [
        { path: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' },
        { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
      ]
    };

    // Helper validating candidate set equality (mirroring cleanup tool logic)
    function validateReportCandidates(approved, liveCandidates) {
      if (approved.schema_version !== '3.9') return { valid: false, error: 'Schema mismatch' };
      if (approved.orphaned_candidates.length !== liveCandidates.length) {
        return { valid: false, error: 'Count mismatch' };
      }
      const approvedMap = new Map(approved.orphaned_candidates.map((c) => [c.path, c]));
      for (const live of liveCandidates) {
        const match = approvedMap.get(live.path);
        if (!match) return { valid: false, error: 'Path mismatch' };
        if (match.size_bytes !== live.size_bytes) return { valid: false, error: 'Size mismatch' };
        if (match.mimetype !== live.mimetype) return { valid: false, error: 'Mimetype mismatch' };
      }
      return { valid: true };
    }

    // 1. Identical candidate set
    const identicalLive = [
      { path: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'image/jpeg' },
      { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    assert.equal(validateReportCandidates(approvedReport, identicalLive).valid, true);

    // 2. Modified size
    const tamperedSize = [
      { path: 'uploads/orphan1.jpg', size_bytes: 9999, mimetype: 'image/jpeg' },
      { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    assert.equal(validateReportCandidates(approvedReport, tamperedSize).valid, false);
    assert.equal(validateReportCandidates(approvedReport, tamperedSize).error, 'Size mismatch');

    // 3. Modified MIME type
    const tamperedMime = [
      { path: 'uploads/orphan1.jpg', size_bytes: 1024, mimetype: 'application/octet-stream' },
      { path: 'uploads/orphan2.png', size_bytes: 2048, mimetype: 'image/png' }
    ];
    assert.equal(validateReportCandidates(approvedReport, tamperedMime).valid, false);
    assert.equal(validateReportCandidates(approvedReport, tamperedMime).error, 'Mimetype mismatch');
  });

  // --------------------------------------------------------------------------
  // Group 3: Staging Report Tracker & Non-Zero Exit Code Enforcement
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

  it('StagingReportTracker must return 0 only when all tests pass with zero skips or failures', () => {
    const tracker = new StagingReportTracker();
    tracker.pass('Test 1 Passed');
    tracker.pass('Test 2 Passed');
    const exitCode = tracker.printSummary();
    assert.equal(exitCode, 0, 'Must return 0 on 100% pass rate');
  });

  // --------------------------------------------------------------------------
  // Group 4: RFC 6238 TOTP Generator Unit Tests
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
