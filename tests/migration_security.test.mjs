// ============================================================================
// MG HOME CMS — Security & Migration Integrity Unit Test Suite
// File: tests/migration_security.test.mjs
// Run: node --test tests/migration_security.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('1. Database Migration & Security Hardening Tests', () => {
  const migrationPath = path.resolve('supabase/migrations/20261119000001_initial_schema_v2_3_0.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('Migration file must exist and contain non-empty SQL content', () => {
    assert.ok(sql.length > 1000, 'Migration SQL must be substantial');
  });

  it('Global privilege hardening must revoke EXECUTE from PUBLIC and anon', () => {
    assert.match(
      sql,
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i,
      'Must revoke default execute from PUBLIC'
    );
    assert.match(
      sql,
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon/i,
      'Must revoke default execute from anon'
    );
  });

  it('Single-Admin constraint must be enforced at database level on admin_profiles', () => {
    // 1. Column-level constraint
    assert.match(
      sql,
      /is_singleton\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+true\s+CHECK\s*\(\s*is_singleton\s*=\s*true\s*\)/i,
      'admin_profiles must contain is_singleton CHECK constraint'
    );
    assert.match(
      sql,
      /CONSTRAINT\s+uq_admin_profiles_singleton\s+UNIQUE\s*\(\s*is_singleton\s*\)/i,
      'admin_profiles must enforce UNIQUE constraint on is_singleton'
    );
    // 2. Trigger-level constraint
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.fn_enforce_single_admin\(\)/i,
      'Must define fn_enforce_single_admin trigger function'
    );
    assert.match(
      sql,
      /CREATE TRIGGER trg_enforce_single_admin\s+BEFORE INSERT ON public\.admin_profiles/i,
      'Must bind trg_enforce_single_admin trigger'
    );
  });

  it('Direct draft mutations must participate in unified workspace advisory lock', () => {
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.fn_acquire_workspace_lock\(\)/i,
      'Must define fn_acquire_workspace_lock trigger function'
    );
    assert.match(
      sql,
      /pg_advisory_xact_lock\(hashtext\('mg_home_cms_workspace_lock'\)\)/i,
      'fn_acquire_workspace_lock must acquire workspace advisory lock'
    );
    assert.match(
      sql,
      /CREATE TRIGGER trg_lock_draft_settings\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.draft_site_settings/i,
      'draft_site_settings must have lock trigger'
    );
    assert.match(
      sql,
      /CREATE TRIGGER trg_lock_draft_metadata\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.draft_page_metadata/i,
      'draft_page_metadata must have lock trigger'
    );
    assert.match(
      sql,
      /CREATE TRIGGER trg_lock_draft_sections\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.draft_page_sections/i,
      'draft_page_sections must have lock trigger'
    );
  });

  it('is_admin_aal2 must verify super_admin role, JWT aal2, AND verified TOTP factor', () => {
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.is_admin_aal2\(\)/i,
      'Must define is_admin_aal2 helper'
    );
    assert.match(
      sql,
      /role\s*=\s*'super_admin'/i,
      'Must check super_admin role'
    );
    assert.match(
      sql,
      /auth\.jwt\(\)\s*->>\s*'aal'\s*=\s*'aal2'/i,
      'Must verify JWT aal2 claim'
    );
    assert.match(
      sql,
      /factor_type\s*=\s*'totp'\s+AND\s+status\s*=\s*'verified'/i,
      'Must check verified TOTP factor in auth.mfa_factors'
    );
  });

  it('All sensitive RPCs must acquire the unified workspace lock', () => {
    const rpcs = [
      'reorder_draft_sections',
      'publish_page_revision',
      'restore_revision_to_draft'
    ];
    for (const rpc of rpcs) {
      const regex = new RegExp(`FUNCTION public\\.${rpc}[\\s\\S]*?pg_advisory_xact_lock\\(hashtext\\('mg_home_cms_workspace_lock'\\)\\)`, 'i');
      assert.match(sql, regex, `${rpc} must acquire mg_home_cms_workspace_lock`);
    }
  });

  it('All functions and RPCs must have explicit REVOKE from PUBLIC/anon and explicit GRANT to authenticated', () => {
    const funcs = [
      'fn_set_updated_at',
      'fn_prevent_singleton_deletion',
      'fn_enforce_single_admin',
      'fn_acquire_workspace_lock',
      'is_admin_aal2',
      'reorder_draft_sections',
      'publish_page_revision',
      'restore_revision_to_draft',
      'validate_and_register_media_asset'
    ];

    for (const f of funcs) {
      assert.match(
        sql,
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\(`, 'i'),
        `${f} must have explicit REVOKE statement`
      );
    }

    const authenticatedRPCs = [
      'is_admin_aal2',
      'reorder_draft_sections',
      'publish_page_revision',
      'restore_revision_to_draft',
      'validate_and_register_media_asset'
    ];

    for (const rpc of authenticatedRPCs) {
      assert.match(
        sql,
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([\\s\\S]*?\\)\\s+TO authenticated`, 'i'),
        `${rpc} must have explicit GRANT EXECUTE TO authenticated`
      );
    }
  });

  it('Page Revisions table must enforce strict non-empty snapshot schema', () => {
    assert.match(
      sql,
      /jsonb_typeof\(snapshot_data->'site_settings'\)\s*=\s*'object'/i,
      'Must check site_settings is object'
    );
    assert.match(
      sql,
      /jsonb_typeof\(snapshot_data->'page_metadata'\)\s*=\s*'object'/i,
      'Must check page_metadata is object'
    );
    assert.match(
      sql,
      /jsonb_typeof\(snapshot_data->'sections'\)\s*=\s*'array'/i,
      'Must check sections is array'
    );
    assert.match(
      sql,
      /jsonb_array_length\(snapshot_data->'sections'\)\s*>\s*0/i,
      'Must check sections array is not empty'
    );
  });
});
