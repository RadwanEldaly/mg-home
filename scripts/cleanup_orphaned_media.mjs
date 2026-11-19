#!/usr/bin/env node
// ============================================================================
// MG HOME CMS — Staging Orphaned Storage Objects Cleanup Tool (Phase 03.10 Hardened)
// File: scripts/cleanup_orphaned_media.mjs
// Run: node scripts/cleanup_orphaned_media.mjs [--dry-run|--delete --confirm-staging-project=<ref> --report=<report.json>]
// ============================================================================
//
// MANDATORY SAFETY GUARDS:
// 1. Mandatory Staging Project Allowlist:
//    STAGING_PROJECT_ALLOWLIST is mandatory in ALL cases. No fuzzy fallback allowed.
//    Rejects Production and unknown projects unconditionally.
// 2. Strict Repository Root & Codebase Verification (fail-closed):
//    Explicitly verifies index.html, package.json, supabase/, js/, css/,
//    and explicit required asset directories (Img, Img-2, Img - 3, Logo, assets).
//    Recursively scans public codebase and protects normalized paths and basenames.
// 3. Strict Full-Metadata Report Schema Validation:
//    Requires --report=<report.json>. Validates schema_version '3.10', project_ref,
//    target_url, timestamps, and requires orphaned_candidates to be a non-empty array
//    with strict size, mimetype, and duplicate path rejection.
// 4. Candidate Set Comparison with Live Storage:
//    Compares approved candidates against live storage on count, paths, sizes, and MIMEs.
// 5. Recursive Storage Enumeration:
//    Recursively enumerates all subdirectories in media-library bucket.
// 6. Deterministic Database Pagination:
//    Uses order=storage_path.asc to guarantee zero skipped records.
// 7. Safe Storage API Deletion:
//    Deletes via storage.from('media-library').remove([paths]).
// ============================================================================

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

// ----------------------------------------------------------------------------
// Configuration & Environment Helpers
// ----------------------------------------------------------------------------
export function getCleanupConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const STAGING_PROJECT_ALLOWLIST = process.env.STAGING_PROJECT_ALLOWLIST
    ? process.env.STAGING_PROJECT_ALLOWLIST.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : null;

  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_PROJECT_ALLOWLIST };
}

// ----------------------------------------------------------------------------
// SAFETY GUARD 1: Mandatory Staging Allowlist & Absolute Production Rejection
// ----------------------------------------------------------------------------
export function validateStagingTarget(ref, allowlist) {
  if (!ref) {
    return { valid: false, error: 'Target project reference is empty.' };
  }
  const normalized = ref.toLowerCase();

  // 1. Absolute production rejection
  if (normalized.includes('prod') || normalized.includes('production')) {
    return {
      valid: false,
      error: `CRITICAL SAFETY VIOLATION: Target project "${ref}" appears to be Production! Execution strictly blocked.`
    };
  }

  // 2. Mandatory Allowlist Check (No fuzzy fallback allowed!)
  if (!allowlist || allowlist.length === 0) {
    return {
      valid: false,
      error: 'CRITICAL CONFIGURATION ERROR: STAGING_PROJECT_ALLOWLIST is mandatory. You must explicitly set STAGING_PROJECT_ALLOWLIST to an approved list of staging project references.'
    };
  }

  if (!allowlist.includes(normalized)) {
    return {
      valid: false,
      error: `SAFETY VIOLATION: Target project "${ref}" is not in the authorized STAGING_PROJECT_ALLOWLIST (${allowlist.join(', ')}).`
    };
  }

  return { valid: true };
}

// ----------------------------------------------------------------------------
// SAFETY GUARD 2: Fail-Closed Recursive Codebase Static Asset Scanner
// ----------------------------------------------------------------------------
export const REQUIRED_ROOT_FILES = ['index.html', 'package.json'];
export const REQUIRED_ROOT_DIRS = ['supabase', 'js', 'css'];
export const REQUIRED_ASSET_DIRS = ['Img', 'Img-2', 'Img - 3', 'Logo', 'assets'];

export function scanCodebaseProtectedAssets(rootDir = process.cwd()) {
  // 1. Verify required root files (fail-closed)
  for (const rf of REQUIRED_ROOT_FILES) {
    const filePath = path.join(rootDir, rf);
    if (!fs.existsSync(filePath)) {
      throw new Error(`FAIL-CLOSED: Cannot verify repository root. Missing required root file: "${rf}".`);
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`FAIL-CLOSED: Cannot verify repository root. Path "${rf}" is not a regular file.`);
    }
  }

  // 2. Verify required root directories (fail-closed)
  for (const rd of REQUIRED_ROOT_DIRS) {
    const dirPath = path.join(rootDir, rd);
    if (!fs.existsSync(dirPath)) {
      throw new Error(`FAIL-CLOSED: Cannot verify repository root. Missing required root directory: "${rd}".`);
    }
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`FAIL-CLOSED: Cannot verify repository root. Path "${rd}" is not a directory.`);
    }
  }

  // 3. Verify explicit required asset directories (fail-closed)
  for (const ad of REQUIRED_ASSET_DIRS) {
    const assetPath = path.join(rootDir, ad);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`FAIL-CLOSED: Missing required asset directory: "${ad}".`);
    }
    const stat = fs.statSync(assetPath);
    if (!stat.isDirectory()) {
      throw new Error(`FAIL-CLOSED: Required asset directory "${ad}" is not a directory.`);
    }
  }

  const protectedPaths = new Set();
  const protectedBasenames = new Set();

  function scanTextFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = content.match(/[\w\-./\\]+\.(?:webp|jpg|jpeg|png|svg|ico|gif)/gi) || [];
      for (const m of matches) {
        const normalized = m.replace(/\\/g, '/').replace(/^\/+/, '');
        protectedPaths.add(normalized);
        protectedBasenames.add(path.basename(normalized).toLowerCase());
      }
    } catch (err) {
      throw new Error(`FAIL-CLOSED: Failed reading text asset file "${filePath}": ${err.message}`);
    }
  }

  function scanDirectoryRecursive(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          scanDirectoryRecursive(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          // If image file on disk, protect its relative path and basename
          if (['.webp', '.jpg', '.jpeg', '.png', '.svg', '.ico', '.gif'].includes(ext)) {
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            protectedPaths.add(relPath);
            protectedBasenames.add(entry.name.toLowerCase());
          }
          // If code or style file, scan references inside it
          if (['.js', '.css', '.html', '.json'].includes(ext)) {
            scanTextFile(fullPath);
          }
        }
      }
    } catch (err) {
      throw new Error(`FAIL-CLOSED: Failed scanning directory "${dirPath}": ${err.message}`);
    }
  }

  // 1. Scan index.html
  scanTextFile(path.join(rootDir, 'index.html'));

  // 2. Scan code directories recursively
  scanDirectoryRecursive(path.join(rootDir, 'js'));
  scanDirectoryRecursive(path.join(rootDir, 'css'));

  // 3. Scan physical asset directories recursively
  for (const ad of REQUIRED_ASSET_DIRS) {
    const fullDirPath = path.join(rootDir, ad);
    scanDirectoryRecursive(fullDirPath);
  }

  return { protectedPaths, protectedBasenames };
}

// ----------------------------------------------------------------------------
// SAFETY GUARD 3: Strict Full-Metadata Report Validation (fail-closed)
// ----------------------------------------------------------------------------
export function validateCleanupReport(report, expectedContext = {}) {
  if (!report || typeof report !== 'object') {
    return { valid: false, error: 'Report must be a non-null JSON object.' };
  }

  const expectedSchema = expectedContext.expectedSchemaVersion || '3.10';
  if (!report.schema_version || report.schema_version !== expectedSchema) {
    return {
      valid: false,
      error: `Report schema_version "${report.schema_version}" is incompatible (expected "${expectedSchema}").`
    };
  }

  if (!report.project_ref || typeof report.project_ref !== 'string' || report.project_ref.trim() === '') {
    return { valid: false, error: 'Missing or invalid project_ref in report.' };
  }
  if (expectedContext.projectRef && report.project_ref.toLowerCase() !== expectedContext.projectRef.toLowerCase()) {
    return {
      valid: false,
      error: `Report project_ref "${report.project_ref}" does not match target project "${expectedContext.projectRef}".`
    };
  }

  if (!report.target_url || typeof report.target_url !== 'string' || report.target_url.trim() === '') {
    return { valid: false, error: 'Missing or invalid target_url in report.' };
  }
  if (expectedContext.targetUrl && report.target_url !== expectedContext.targetUrl) {
    return {
      valid: false,
      error: `Report target_url "${report.target_url}" does not match target URL "${expectedContext.targetUrl}".`
    };
  }

  if (!report.generated_at || typeof report.generated_at !== 'string' || isNaN(Date.parse(report.generated_at))) {
    return { valid: false, error: 'Report generated_at timestamp is invalid or missing.' };
  }

  if (typeof report.total_objects !== 'number' || report.total_objects < 0 || !Number.isInteger(report.total_objects)) {
    return { valid: false, error: 'Report total_objects must be a non-negative integer.' };
  }
  if (typeof report.kept_count !== 'number' || report.kept_count < 0 || !Number.isInteger(report.kept_count)) {
    return { valid: false, error: 'Report kept_count must be a non-negative integer.' };
  }
  if (typeof report.candidate_count !== 'number' || report.candidate_count < 0 || !Number.isInteger(report.candidate_count)) {
    return { valid: false, error: 'Report candidate_count must be a non-negative integer.' };
  }

  if (!Array.isArray(report.orphaned_candidates)) {
    return { valid: false, error: 'orphaned_candidates must be an array.' };
  }
  if (report.orphaned_candidates.length !== report.candidate_count) {
    return {
      valid: false,
      error: `orphaned_candidates count (${report.orphaned_candidates.length}) does not match candidate_count (${report.candidate_count}).`
    };
  }

  const seenPaths = new Set();
  for (let i = 0; i < report.orphaned_candidates.length; i++) {
    const c = report.orphaned_candidates[i];
    if (!c || typeof c !== 'object') {
      return { valid: false, error: `Candidate entry at index ${i} is not a valid object.` };
    }
    if (!c.path || typeof c.path !== 'string' || c.path.trim() === '') {
      return { valid: false, error: `Candidate at index ${i} has missing or empty path.` };
    }
    const normPath = c.path.trim();
    if (seenPaths.has(normPath)) {
      return { valid: false, error: `Duplicate candidate path detected in report: "${normPath}".` };
    }
    seenPaths.add(normPath);

    if (typeof c.size_bytes !== 'number' || c.size_bytes <= 0 || !Number.isInteger(c.size_bytes)) {
      return { valid: false, error: `Candidate "${c.path}" has invalid size_bytes (${c.size_bytes}). Must be a positive integer.` };
    }
    if (!c.mimetype || typeof c.mimetype !== 'string' || c.mimetype.trim() === '' || c.mimetype === 'unknown') {
      return { valid: false, error: `Candidate "${c.path}" has missing or invalid mimetype (${c.mimetype}).` };
    }
    if (!c.created_at || typeof c.created_at !== 'string' || isNaN(Date.parse(c.created_at))) {
      return { valid: false, error: `Candidate "${c.path}" has missing or invalid created_at timestamp.` };
    }
  }

  return { valid: true };
}

// ----------------------------------------------------------------------------
// SAFETY GUARD 4: Candidate Set Comparison Against Live Storage
// ----------------------------------------------------------------------------
export function compareReportAgainstLive(approvedCandidates, liveCandidates) {
  if (!Array.isArray(approvedCandidates) || !Array.isArray(liveCandidates)) {
    return { valid: false, error: 'Both approvedCandidates and liveCandidates must be arrays.' };
  }

  if (approvedCandidates.length !== liveCandidates.length) {
    return {
      valid: false,
      error: `Candidate count changed between audit and execution! Approved report: ${approvedCandidates.length}, Live storage: ${liveCandidates.length}.`
    };
  }

  const approvedMap = new Map();
  for (const c of approvedCandidates) {
    approvedMap.set(c.path, c);
  }

  const liveMap = new Map();
  for (const c of liveCandidates) {
    const key = c.name || c.path;
    liveMap.set(key, c);
  }

  if (approvedMap.size !== liveMap.size) {
    return {
      valid: false,
      error: `Distinct candidate count mismatch: approved report has ${approvedMap.size}, live has ${liveMap.size}.`
    };
  }

  for (const [pathName, liveItem] of liveMap.entries()) {
    const approvedItem = approvedMap.get(pathName);
    if (!approvedItem) {
      return { valid: false, error: `Live storage contains orphan "${pathName}" not present in approved report!` };
    }
    const liveSize = liveItem.size_bytes ?? liveItem.size;
    if (approvedItem.size_bytes !== liveSize) {
      return {
        valid: false,
        error: `Object "${pathName}" size changed between audit and execution (Report: ${approvedItem.size_bytes}, Live: ${liveSize})!`
      };
    }
    const liveMime = liveItem.mimetype || liveItem.mimeType;
    if (approvedItem.mimetype !== liveMime) {
      return {
        valid: false,
        error: `Object "${pathName}" mimetype changed between audit and execution (Report: ${approvedItem.mimetype}, Live: ${liveMime})!`
      };
    }
  }

  for (const [pathName] of approvedMap.entries()) {
    if (!liveMap.has(pathName)) {
      return {
        valid: false,
        error: `Approved orphan "${pathName}" is no longer present in live storage candidate list!`
      };
    }
  }

  return { valid: true };
}

// ----------------------------------------------------------------------------
// Core Execution Pipeline
// ----------------------------------------------------------------------------
export async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_PROJECT_ALLOWLIST } = getCleanupConfig();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ Missing required environment variables:');
    console.error('   - SUPABASE_URL (e.g. https://your-staging-ref.supabase.co)');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY (service role secret)');
    console.error('   - STAGING_PROJECT_ALLOWLIST (mandatory comma-separated staging project references)');
    console.error('\nUsage:');
    console.error('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... STAGING_PROJECT_ALLOWLIST=... node scripts/cleanup_orphaned_media.mjs [options]');
    console.error('   Options:');
    console.error('     --dry-run (default: audits storage and exports candidate report)');
    console.error('     --delete --confirm-staging-project=<project-ref> --report=<report.json>\n');
    process.exit(1);
  }

  let projectRef = '';
  try {
    const urlObj = new URL(SUPABASE_URL);
    projectRef = urlObj.hostname.split('.')[0].toLowerCase();
  } catch {
    console.error('❌ Malformed SUPABASE_URL.');
    process.exit(1);
  }

  const isDeleteMode = process.argv.includes('--delete');
  const isDryRun = !isDeleteMode;

  const confirmArgPrefix = '--confirm-staging-project=';
  const confirmArg = process.argv.find((arg) => arg.startsWith(confirmArgPrefix));
  const confirmedProject = confirmArg ? confirmArg.slice(confirmArgPrefix.length).toLowerCase() : '';

  const reportArgPrefix = '--report=';
  const reportArg = process.argv.find((arg) => arg.startsWith(reportArgPrefix));
  const reportFilePath = reportArg ? reportArg.slice(reportArgPrefix.length) : '';

  console.log('================================================================');
  console.log(' MG HOME CMS — Orphaned Storage Audit & Cleanup Tool (v3.9)');
  console.log('================================================================');
  console.log(`Target Supabase URL : ${SUPABASE_URL}`);
  console.log(`Target Project Ref  : ${projectRef}`);
  console.log(`Execution Mode      : ${isDryRun ? '🔍 DRY RUN (Audit & Report Only)' : '🗑️ LIVE DELETE (Storage API)'}`);

  const targetValidation = validateStagingTarget(projectRef, STAGING_PROJECT_ALLOWLIST);
  if (!targetValidation.valid) {
    console.error(`\n🛑 ${targetValidation.error}\n`);
    process.exit(1);
  }

  if (isDeleteMode) {
    if (!confirmedProject || confirmedProject !== projectRef) {
      console.error('\n🛑 SAFETY VIOLATION: Target confirmation missing or mismatched!');
      console.error(`   To authorize deletion on Staging, pass: --confirm-staging-project=${projectRef}`);
      process.exit(1);
    }

    if (!reportFilePath) {
      console.error('\n🛑 SAFETY VIOLATION: Deletion requires an approved audit report!');
      console.error('   Run audit first in dry-run mode to generate a report, then execute with:');
      console.error(`   --delete --confirm-staging-project=${projectRef} --report=<path-to-report.json>\n`);
      process.exit(1);
    }
  }
  console.log('----------------------------------------------------------------\n');

  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  // Step 1: Scan codebase with fail-closed guarantee (recursive)
  console.log('Step 1: Recursively scanning public codebase and asset directories for protected assets...');
  let codebaseProtection;
  try {
    codebaseProtection = scanCodebaseProtectedAssets();
    console.log(`   Protected ${codebaseProtection.protectedPaths.size} path reference(s) and ${codebaseProtection.protectedBasenames.size} distinct filename(s).`);
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  // Step 2: Recursive Storage Enumeration
  console.log('\nStep 2: Recursively enumerating all objects and subdirectories in "media-library"...');
  const storageObjects = [];
  const prefixesToTraverse = [''];
  const visitedPrefixes = new Set();
  const batchSize = 100;

  while (prefixesToTraverse.length > 0) {
    const currentPrefix = prefixesToTraverse.shift();
    if (visitedPrefixes.has(currentPrefix)) continue;
    visitedPrefixes.add(currentPrefix);

    let offset = 0;
    while (true) {
      const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/media-library`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prefix: currentPrefix,
          limit: batchSize,
          offset,
          sortBy: { column: 'name', order: 'asc' }
        })
      });

      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`❌ Failed listing storage objects at prefix "${currentPrefix}" offset ${offset}: ${listRes.status} ${errText}`);
        process.exit(1);
      }

      const batch = await listRes.json();
      if (!Array.isArray(batch) || batch.length === 0) break;

      for (const item of batch) {
        const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name;

        // In Supabase Storage, directory objects have id: null or missing metadata
        if (item.id === null || !item.metadata) {
          prefixesToTraverse.push(fullPath);
        } else {
          storageObjects.push({
            name: fullPath,
            size_bytes: item.metadata?.size ?? 0,
            mimetype: item.metadata?.mimetype ?? 'unknown',
            created_at: item.created_at || item.updated_at || new Date().toISOString()
          });
        }
      }

      if (batch.length < batchSize) break;
      offset += batchSize;
    }
  }
  console.log(`   Discovered ${storageObjects.length} total concrete storage object(s) across ${visitedPrefixes.size} directory prefix(es).`);

  // Step 3: Deterministic Database Fetching
  console.log('\nStep 3: Fetching registered assets from PostgreSQL (deterministic order=storage_path.asc)...');
  const registeredPaths = new Set();
  let dbOffset = 0;
  const dbBatchSize = 500;

  while (true) {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/media_assets?select=storage_path&order=storage_path.asc&limit=${dbBatchSize}&offset=${dbOffset}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error(`❌ Failed fetching media_assets at offset ${dbOffset}: ${dbRes.status} ${errText}`);
      process.exit(1);
    }

    const batch = await dbRes.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const row of batch) {
      if (row.storage_path) registeredPaths.add(row.storage_path);
    }

    if (batch.length < dbBatchSize) break;
    dbOffset += dbBatchSize;
  }
  console.log(`   Found ${registeredPaths.size} registered asset record(s) in database.`);

  // Step 4: Strict Classification of Storage Objects
  const classifiedItems = storageObjects.map((obj) => {
    const objPath = obj.name;
    const baseName = path.basename(objPath).toLowerCase();

    // 1. Database check
    if (registeredPaths.has(objPath) || registeredPaths.has(`uploads/${objPath}`)) {
      return { ...obj, status: 'KEEP', reason: 'REGISTERED_IN_DATABASE' };
    }

    // 2. Codebase static asset check (normalized path or basename)
    if (codebaseProtection.protectedPaths.has(objPath) || codebaseProtection.protectedBasenames.has(baseName)) {
      return { ...obj, status: 'KEEP', reason: 'REFERENCED_IN_PUBLIC_CODEBASE' };
    }

    // 3. Safety check: Uncertain classification (zero bytes or missing metadata)
    if (!obj.mimetype || obj.mimetype === 'unknown' || obj.size_bytes <= 0) {
      return { ...obj, status: 'KEEP', reason: 'UNCERTAIN_PROTECTED' };
    }

    // 4. Candidate for deletion
    return { ...obj, status: 'DELETE_CANDIDATE', reason: 'UNREGISTERED_ORPHAN' };
  });

  const keptCount = classifiedItems.filter((i) => i.status === 'KEEP').length;
  const candidateList = classifiedItems.filter((i) => i.status === 'DELETE_CANDIDATE');

  console.log('\nStep 4: Classification Results:');
  console.log(`   Total Objects Analyzed : ${classifiedItems.length}`);
  console.log(`   Protected / Kept       : ${keptCount}`);
  console.log(`   Orphaned Candidates   : ${candidateList.length}`);

  // Step 5: Export Audit Report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportOutputName = `staging_orphaned_report_${projectRef}_${timestamp}.json`;
  const reportPath = path.resolve(reportOutputName);

  const reportPayload = {
    schema_version: '3.10',
    project_ref: projectRef,
    target_url: SUPABASE_URL,
    generated_at: new Date().toISOString(),
    total_objects: classifiedItems.length,
    kept_count: keptCount,
    candidate_count: candidateList.length,
    orphaned_candidates: candidateList.map((c) => ({
      path: c.name,
      size_bytes: c.size_bytes,
      mimetype: c.mimetype,
      created_at: c.created_at,
      reason: c.reason
    })),
    protected_summary: {
      registered_in_db: classifiedItems.filter((i) => i.reason === 'REGISTERED_IN_DATABASE').length,
      referenced_in_codebase: classifiedItems.filter((i) => i.reason === 'REFERENCED_IN_PUBLIC_CODEBASE').length,
      uncertain_protected: classifiedItems.filter((i) => i.reason === 'UNCERTAIN_PROTECTED').length
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), 'utf8');
  console.log(`\n📄 Complete Audit Report generated at:\n   ${reportPath}`);

  if (candidateList.length === 0) {
    console.log('\n✨ Storage is 100% clean. Zero orphaned objects discovered.\n');
    return;
  }

  // If Dry-Run, exit cleanly
  if (isDryRun) {
    console.log('\n💡 DRY-RUN FINISHED: Zero objects were modified or deleted.');
    console.log('   Review the audit report JSON above. To execute verified deletion:');
    console.log(`   node scripts/cleanup_orphaned_media.mjs --delete --confirm-staging-project=${projectRef} --report=${reportOutputName}\n`);
    return;
  }

  // --------------------------------------------------------------------------
  // SAFETY GUARD 3 & 4: Strict Full-Metadata Report Validation & Comparison
  // --------------------------------------------------------------------------
  console.log('\nStep 6: Performing comprehensive report validation & candidate set comparison...');
  let approvedReport;
  try {
    const rawReport = fs.readFileSync(path.resolve(reportFilePath), 'utf8');
    approvedReport = JSON.parse(rawReport);
  } catch (err) {
    console.error(`❌ Failed reading approved report "${reportFilePath}": ${err.message}`);
    process.exit(1);
  }

  // 1. Strict schema and metadata validation
  const reportValidation = validateCleanupReport(approvedReport, {
    projectRef,
    targetUrl: SUPABASE_URL,
    expectedSchemaVersion: '3.10'
  });
  if (!reportValidation.valid) {
    console.error(`\n🛑 SAFETY ABORT: Report validation failed: ${reportValidation.error}\n`);
    process.exit(1);
  }

  // 2. Strict comparison against live storage
  const compareResult = compareReportAgainstLive(approvedReport.orphaned_candidates, candidateList);
  if (!compareResult.valid) {
    console.error(`\n🛑 SAFETY ABORT: Live storage comparison failed: ${compareResult.error}\n`);
    process.exit(1);
  }

  console.log(`   Verification successful: Live candidate set matches approved report 100% on paths, sizes, and MIME types (${approvedReport.orphaned_candidates.length} objects).`);

  // Step 7: Batch Deletion via Storage API (.remove([paths]))
  console.log('\nStep 7: Executing safe batch deletion via Supabase Storage API...');
  const pathsToDelete = Array.from(liveMap.keys());
  const deleteBatchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < pathsToDelete.length; i += deleteBatchSize) {
    const chunk = pathsToDelete.slice(i, i + deleteBatchSize);
    const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media-library`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ prefixes: chunk })
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      console.error(`❌ Batch deletion failed at index ${i}: ${deleteRes.status} ${errText}`);
      process.exit(1);
    }

    deletedCount += chunk.length;
    process.stdout.write(`   Deleted ${deletedCount}/${pathsToDelete.length} objects...\r`);
  }

  console.log(`\n\n✅ Successfully deleted ${pathsToDelete.length} verified orphaned object(s) via Storage API.`);
  console.log('   Storage backend binaries and PostgreSQL catalog rows synchronized.\n');
}

// Execute when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/cleanup_orphaned_media.mjs')) {
  main().catch((err) => {
    console.error('\n❌ Fatal execution error:', err);
    process.exit(1);
  });
}
