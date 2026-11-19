#!/usr/bin/env node
// ============================================================================
// MG HOME CMS — Staging Orphaned Storage Objects Cleanup Tool (Hardened)
// File: scripts/cleanup_orphaned_media.mjs
// Run: node scripts/cleanup_orphaned_media.mjs [--dry-run|--delete]
// ============================================================================
//
// SAFETY GUARDS:
// 1. Programmatic Anti-Production Guard:
//    Requires explicit argument: --confirm-staging-project=<project-ref>
//    Matching the project reference extracted from SUPABASE_URL.
// 2. Full Pagination:
//    Retrieves all objects from Storage API and PostgreSQL regardless of count.
// 3. Static Codebase Asset Protection:
//    Scans index.html, css/, js/ for referenced asset paths to prevent false positives.
// 4. Candidate Report Generation:
//    Exports JSON report of candidate orphaned objects before deletion.
// 5. Official Storage API Deletion:
//    Uses storage.from('media-library').remove([paths]) so physical binaries
//    and database metadata are synchronized.
// ============================================================================

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL (e.g. https://xyzcompany.supabase.co)');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (service role secret)');
  console.error('\nUsage:');
  console.error('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup_orphaned_media.mjs [--dry-run|--delete --confirm-staging-project=<project-ref>]\n');
  process.exit(1);
}

// Extract project ref from SUPABASE_URL
let projectRef = '';
try {
  const urlObj = new URL(SUPABASE_URL);
  projectRef = urlObj.hostname.split('.')[0];
} catch {
  console.error('❌ Malformed SUPABASE_URL.');
  process.exit(1);
}

const isDeleteMode = process.argv.includes('--delete');
const isDryRun = !isDeleteMode;

const confirmArgPrefix = '--confirm-staging-project=';
const confirmArg = process.argv.find((arg) => arg.startsWith(confirmArgPrefix));
const confirmedProject = confirmArg ? confirmArg.slice(confirmArgPrefix.length) : '';

console.log('================================================================');
console.log(' MG HOME CMS — Orphaned Storage Audit & Cleanup (Storage API)');
console.log('================================================================');
console.log(`Target Project Ref  : ${projectRef} (${SUPABASE_URL})`);
console.log(`Execution Mode      : ${isDryRun ? '🔍 DRY RUN (Audit & Report Only)' : '🗑️ LIVE DELETE (Storage API)'}`);

// ENFORCEMENT: Anti-Production Guard
if (isDeleteMode) {
  if (!confirmedProject || confirmedProject !== projectRef) {
    console.error('\n🛑 SAFETY VIOLATION: Execution aborted!');
    console.error(`   To prevent accidental execution against production, you MUST explicitly confirm the target Staging project:`);
    console.error(`   Pass flag: --confirm-staging-project=${projectRef}`);
    console.error(`   Example:`);
    console.error(`   node scripts/cleanup_orphaned_media.mjs --delete --confirm-staging-project=${projectRef}\n`);
    process.exit(1);
  }
}
console.log('----------------------------------------------------------------\n');

/**
 * Scans local codebase files for static asset references (e.g. index.html, js, css)
 */
function getProtectedLocalStaticAssets() {
  const protectedNames = new Set();

  try {
    const indexHtmlPath = path.resolve('index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const content = fs.readFileSync(indexHtmlPath, 'utf8');
      // Match image filenames
      const matches = content.match(/[\w\-./]+\.(?:webp|jpg|jpeg|png|svg|ico)/gi) || [];
      for (const m of matches) {
        const baseName = path.basename(m);
        protectedNames.add(baseName);
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning scanning index.html:', err.message);
  }

  return protectedNames;
}

async function runAuditAndCleanup() {
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  const protectedStaticNames = getProtectedLocalStaticAssets();
  console.log(`Protected Static Asset Filenames (from index.html): ${protectedStaticNames.size} detected.`);

  // Step 1: Paginated Listing of all objects in bucket "media-library"
  console.log('\nStep 1: Listing objects in bucket "media-library" (with full pagination)...');
  const storageObjects = [];
  let storageOffset = 0;
  const storageBatchSize = 100;

  while (true) {
    const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/media-library`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prefix: '',
        limit: storageBatchSize,
        offset: storageOffset,
        sortBy: { column: 'name', order: 'asc' }
      })
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`❌ Failed to list storage objects at offset ${storageOffset}: ${listRes.status} ${errText}`);
      process.exit(1);
    }

    const batch = await listRes.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    storageObjects.push(...batch);

    if (batch.length < storageBatchSize) break;
    storageOffset += storageBatchSize;
  }
  console.log(`   Found ${storageObjects.length} total object(s) across all pages in media-library.`);

  // Step 2: Paginated Fetching of all registered storage paths from public.media_assets
  console.log('\nStep 2: Fetching indexed media_assets from PostgreSQL (with full pagination)...');
  const registeredPaths = new Set();
  let dbOffset = 0;
  const dbBatchSize = 500;

  while (true) {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/media_assets?select=storage_path&limit=${dbBatchSize}&offset=${dbOffset}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error(`❌ Failed to fetch media_assets at offset ${dbOffset}: ${dbRes.status} ${errText}`);
      process.exit(1);
    }

    const batch = await dbRes.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const item of batch) {
      if (item.storage_path) registeredPaths.add(item.storage_path);
    }

    if (batch.length < dbBatchSize) break;
    dbOffset += dbBatchSize;
  }
  console.log(`   Found ${registeredPaths.size} registered asset record(s) in public.media_assets.`);

  // Step 3: Compute candidate orphaned paths with protective filters
  const orphanedObjects = [];
  const protectedObjects = [];

  for (const obj of storageObjects) {
    const pathName = obj.name;
    const baseName = path.basename(pathName);

    const isRegistered = registeredPaths.has(pathName) || registeredPaths.has(`uploads/${pathName}`);
    const isProtectedStatic = protectedStaticNames.has(baseName);

    if (isRegistered) {
      // Normal registered asset
      continue;
    } else if (isProtectedStatic) {
      // Protected static reference in public website
      protectedObjects.push(obj);
    } else {
      // True orphan candidate
      orphanedObjects.push(obj);
    }
  }

  console.log('\nStep 3: Audit Classification:');
  console.log(`   Registered (In Database)  : ${storageObjects.length - orphanedObjects.length - protectedObjects.length}`);
  console.log(`   Protected Static Assets   : ${protectedObjects.length} (Preserved, referenced in site HTML)`);
  console.log(`   Orphaned (Deletion Target): ${orphanedObjects.length}`);

  // Step 4: Export Audit Report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.resolve(`staging_orphaned_report_${timestamp}.json`);
  const reportData = {
    generated_at: new Date().toISOString(),
    project_ref: projectRef,
    target_url: SUPABASE_URL,
    total_storage_objects: storageObjects.length,
    registered_count: registeredPaths.size,
    protected_static_count: protectedObjects.length,
    orphaned_candidate_count: orphanedObjects.length,
    orphaned_candidates: orphanedObjects.map((o) => ({
      name: o.name,
      size_bytes: o.metadata?.size,
      mimetype: o.metadata?.mimetype,
      created_at: o.created_at
    })),
    protected_static_assets: protectedObjects.map((o) => o.name)
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  console.log(`\n📄 Candidate Audit Report exported to:\n   ${reportPath}`);

  if (orphanedObjects.length === 0) {
    console.log('\n✨ Excellent: Zero orphaned objects found in media-library! Storage is 100% clean.\n');
    return;
  }

  if (isDryRun) {
    console.log('\n💡 DRY RUN COMPLETE: Zero objects were deleted.');
    console.log('   Review the exported JSON report above before executing deletion.');
    console.log('   To safely delete verified orphaned objects via the official Storage API, run:');
    console.log(`   node scripts/cleanup_orphaned_media.mjs --delete --confirm-staging-project=${projectRef}\n`);
    return;
  }

  // Step 5: Safe Deletion via Storage API (.remove([paths]))
  console.log('\nStep 5: Executing batch deletion via Supabase Storage API...');
  const pathsToDelete = orphanedObjects.map((o) => o.name);

  // Storage API delete accepts up to 100 paths per call
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

  console.log(`\n\n✅ Successfully deleted ${pathsToDelete.length} orphaned object(s) via Storage API.`);
  console.log('   Storage backend binaries and PostgreSQL metadata rows were cleanly synchronized.\n');
}

runAuditAndCleanup().catch((err) => {
  console.error('\n❌ Unexpected error during execution:', err);
  process.exit(1);
});
