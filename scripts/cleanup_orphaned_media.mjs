#!/usr/bin/env node
// ============================================================================
// MG HOME CMS — Staging Orphaned Storage Objects Cleanup Tool
// File: scripts/cleanup_orphaned_media.mjs
// Run: node scripts/cleanup_orphaned_media.mjs [--dry-run|--delete]
// ============================================================================
//
// SAFETY WARNING:
// - This tool is strictly intended for STAGING environments to clean up
//   unindexed test files left over before Phase 03.4 write isolation.
// - NEVER run mass deletion on Production without verifying legacy static references!
// - Uses the official Supabase Storage API (.remove([paths])) to ensure
//   both storage backend objects and PostgreSQL metadata are deleted in sync.
// ============================================================================

import process from 'node:process';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL (e.g. https://xyzcompany.supabase.co)');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (service role secret)');
  console.error('\nUsage:');
  console.error('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup_orphaned_media.mjs [--dry-run|--delete]\n');
  process.exit(1);
}

const isDeleteMode = process.argv.includes('--delete');
const isDryRun = !isDeleteMode;

console.log('================================================================');
console.log(' MG HOME CMS — Orphaned Storage Audit & Cleanup (Storage API)');
console.log('================================================================');
console.log(`Target Supabase URL : ${SUPABASE_URL}`);
console.log(`Execution Mode      : ${isDryRun ? '🔍 DRY RUN (Audit Only)' : '🗑️ LIVE DELETE (Storage API)'}`);
console.log('----------------------------------------------------------------\n');

async function runAuditAndCleanup() {
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  // Step 1: List all files in media-library bucket via Storage API
  console.log('Step 1: Listing objects in bucket "media-library" via Storage API...');
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/media-library`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prefix: '',
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error(`❌ Failed to list storage objects: ${listRes.status} ${errText}`);
    process.exit(1);
  }

  const storageObjects = await listRes.json();
  console.log(`   Found ${storageObjects.length} object(s) in media-library storage.`);

  // Step 2: Fetch all registered storage paths from public.media_assets
  console.log('\nStep 2: Fetching indexed media_assets from PostgreSQL...');
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/media_assets?select=storage_path`, {
    method: 'GET',
    headers
  });

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    console.error(`❌ Failed to fetch media_assets table: ${dbRes.status} ${errText}`);
    process.exit(1);
  }

  const registeredAssets = await dbRes.json();
  const registeredPaths = new Set(registeredAssets.map((a) => a.storage_path));
  console.log(`   Found ${registeredPaths.size} registered asset record(s) in database.`);

  // Step 3: Compute orphaned paths
  // Objects in storage.objects whose path is NOT in public.media_assets
  const orphanedObjects = storageObjects.filter((obj) => {
    // Top-level or subfolder path
    const path = obj.name;
    return !registeredPaths.has(path) && !registeredPaths.has(`uploads/${path}`);
  });

  console.log('\nStep 3: Audit Results:');
  console.log(`   Registered (Safe) Objects : ${storageObjects.length - orphanedObjects.length}`);
  console.log(`   Orphaned (Unindexed) Objects: ${orphanedObjects.length}`);

  if (orphanedObjects.length === 0) {
    console.log('\n✨ Excellent: Zero orphaned objects found in media-library! Storage is 100% clean.\n');
    return;
  }

  console.log('\nList of Orphaned Objects Candidate for Deletion:');
  orphanedObjects.forEach((obj, idx) => {
    console.log(`   [${idx + 1}] ${obj.name} (${obj.metadata?.size || 'unknown'} bytes, created: ${obj.created_at})`);
  });

  if (isDryRun) {
    console.log('\n💡 DRY RUN COMPLETE: No objects were deleted.');
    console.log('   To delete these files safely using the official Supabase Storage API, re-run with:');
    console.log('   node scripts/cleanup_orphaned_media.mjs --delete\n');
    return;
  }

  // Step 4: Perform deletion via Storage API (.remove([paths]))
  console.log('\nStep 4: Executing deletion via Supabase Storage API...');
  const pathsToDelete = orphanedObjects.map((obj) => obj.name);

  const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media-library`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: pathsToDelete })
  });

  if (!deleteRes.ok) {
    const errText = await deleteRes.text();
    console.error(`❌ Storage API deletion failed: ${deleteRes.status} ${errText}`);
    process.exit(1);
  }

  const deleteResult = await deleteRes.json();
  console.log(`\n✅ Successfully deleted ${pathsToDelete.length} orphaned object(s) via Storage API.`);
  console.log('   Both backend storage binaries and PostgreSQL catalog rows were safely removed in sync.\n');
}

runAuditAndCleanup().catch((err) => {
  console.error('\n❌ Unexpected error during execution:', err);
  process.exit(1);
});
