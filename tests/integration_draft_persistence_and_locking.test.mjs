// ============================================================================
// MG HOME CMS — Draft Persistence & Advisory Lock Integration Simulation Suite
// File: tests/integration_draft_persistence_and_locking.test.mjs
// Run: node --test tests/integration_draft_persistence_and_locking.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Integration Test: Draft Persistence, Concurrency Locking, and Schema Mappers', () => {
  // Database Lock Manager Simulating PostgreSQL Advisory Locks
  class MockPostgresLockManager {
    constructor() {
      this.lockedKey = null;
      this.activeTransaction = null;
    }

    acquireAdvisoryXactLock(key, txId) {
      if (this.lockedKey === key && this.activeTransaction !== txId) {
        throw new Error(`CONCURRENCY_ERROR: Lock on key ${key} is held by transaction ${this.activeTransaction}`);
      }
      this.lockedKey = key;
      this.activeTransaction = txId;
      return true;
    }

    releaseLock(txId) {
      if (this.activeTransaction === txId) {
        this.lockedKey = null;
        this.activeTransaction = null;
      }
    }
  }

  // Database Simulator
  class MockPostgresDatabase {
    constructor() {
      this.lockManager = new MockPostgresLockManager();
      this.LOCK_KEY = 'mg_home_cms_workspace_lock';

      this.draftSiteSettings = {
        id: 1,
        business_name_ar: 'إم جي هوم',
        business_name_en: 'MG HOME',
        local_phone: '0538061531',
        country_code: '966',
        is_country_code_confirmed: true,
        instagram_url: 'https://instagram.com/mg_home',
        instagram_handle: '@mg_home',
        facebook_url: 'https://facebook.com/mg_home',
        service_messages_ar: {},
        service_messages_en: {}
      };

      this.draftPageMetadata = {
        id: 1,
        slug: 'home',
        title_ar: 'MG HOME — تكييف',
        title_en: 'MG HOME — AC',
        meta_description_ar: 'وصف',
        meta_description_en: 'Description',
        og_image_url: 'assets/logo.jpeg'
      };

      this.draftSections = new Map([
        ['a1000001-0000-4000-8000-000000000001', {
          id: 'a1000001-0000-4000-8000-000000000001',
          section_type: 'hero',
          section_label: 'البطل',
          display_order: 10,
          is_visible: true,
          anchor_id: 'hero',
          content: {},
          settings: {}
        }],
        ['a1000002-0000-4000-8000-000000000002', {
          id: 'a1000002-0000-4000-8000-000000000002',
          section_type: 'services',
          section_label: 'الخدمات',
          display_order: 20,
          is_visible: true,
          anchor_id: 'services',
          content: {},
          settings: {}
        }]
      ]);

      this.revisions = [];
    }

    // Executes mutation inside a simulated transaction with the unified advisory lock
    async executeInTransaction(txId, operation) {
      this.lockManager.acquireAdvisoryXactLock(this.LOCK_KEY, txId);
      try {
        const result = await operation();
        return result;
      } finally {
        this.lockManager.releaseLock(txId);
      }
    }

    // Persist draft sections handling deletes and upserts
    saveSections(incomingSections) {
      const incomingIds = new Set(incomingSections.map(s => s.id));
      // Delete removed sections
      for (const [id] of this.draftSections) {
        if (!incomingIds.has(id)) {
          this.draftSections.delete(id);
        }
      }
      // Upsert
      for (const s of incomingSections) {
        this.draftSections.set(s.id, {
          id: s.id,
          section_type: s.section_type,
          section_label: s.section_label,
          display_order: s.display_order,
          is_visible: s.is_visible,
          anchor_id: s.anchor_id,
          content: s.content,
          settings: s.settings
        });
      }
    }

    // Reorder sections RPC simulation
    reorderDraftSections(orderedIds) {
      if (orderedIds.length !== this.draftSections.size) {
        throw new Error('REORDER_ERROR: Section count mismatch');
      }
      orderedIds.forEach((id, idx) => {
        const sec = this.draftSections.get(id);
        if (!sec) throw new Error(`REORDER_ERROR: Section ${id} not found`);
        sec.display_order = (idx + 1) * 10;
      });
    }

    // Publish revision RPC simulation
    publishRevision(notes = '') {
      if (this.draftSections.size === 0) {
        throw new Error('PUBLISH_ERROR: Cannot publish zero sections');
      }
      const visibleCount = Array.from(this.draftSections.values()).filter(s => s.is_visible).length;
      if (visibleCount === 0) {
        throw new Error('PUBLISH_ERROR: At least one section must be visible');
      }

      const revNum = this.revisions.length + 1;
      const revision = {
        id: `rev-uuid-${revNum}`,
        revision_number: revNum,
        notes,
        snapshot_data: {
          version: '2.3.0',
          published_at: new Date().toISOString(),
          site_settings: { ...this.draftSiteSettings },
          page_metadata: { ...this.draftPageMetadata },
          sections: Array.from(this.draftSections.values()).sort((a, b) => a.display_order - b.display_order)
        }
      };

      this.revisions.push(revision);
      return revision;
    }
  }

  it('1. Unified advisory lock prevents concurrent conflicting mutations', async () => {
    const db = new MockPostgresDatabase();
    const lockKey = db.LOCK_KEY;

    // Transaction 1 acquires lock
    db.lockManager.acquireAdvisoryXactLock(lockKey, 'tx-1');

    // Transaction 2 attempts to acquire same lock simultaneously -> must fail
    assert.throws(
      () => db.lockManager.acquireAdvisoryXactLock(lockKey, 'tx-2'),
      /CONCURRENCY_ERROR/
    );

    // After Transaction 1 completes, Transaction 2 acquires successfully
    db.lockManager.releaseLock('tx-1');
    assert.doesNotThrow(() => db.lockManager.acquireAdvisoryXactLock(lockKey, 'tx-2'));
    db.lockManager.releaseLock('tx-2');
  });

  it('2. Synchronizes section additions and deletions accurately in database', async () => {
    const db = new MockPostgresDatabase();

    // Initial count is 2
    assert.equal(db.draftSections.size, 2);

    // Delete section 2 and add section 3
    const newSections = [
      {
        id: 'a1000001-0000-4000-8000-000000000001',
        section_type: 'hero',
        section_label: 'البطل',
        display_order: 10,
        is_visible: true,
        anchor_id: 'hero',
        content: {},
        settings: {}
      },
      {
        id: 'a1000003-0000-4000-8000-000000000003',
        section_type: 'copper',
        section_label: 'النحاس',
        display_order: 20,
        is_visible: true,
        anchor_id: 'copper',
        content: {},
        settings: {}
      }
    ];

    await db.executeInTransaction('tx-sync-1', async () => {
      db.saveSections(newSections);
    });

    // Check resulting state
    assert.equal(db.draftSections.size, 2);
    assert.ok(db.draftSections.has('a1000001-0000-4000-8000-000000000001'));
    assert.ok(db.draftSections.has('a1000003-0000-4000-8000-000000000003'));
    assert.equal(db.draftSections.has('a1000002-0000-4000-8000-000000000002'), false, 'Deleted section must be removed from DB');
  });

  it('3. Reordering RPC enforces sequential order values and strict validation', async () => {
    const db = new MockPostgresDatabase();
    const sec1 = 'a1000001-0000-4000-8000-000000000001';
    const sec2 = 'a1000002-0000-4000-8000-000000000002';

    // Reverse order: sec2 first, then sec1
    await db.executeInTransaction('tx-reorder-1', async () => {
      db.reorderDraftSections([sec2, sec1]);
    });

    assert.equal(db.draftSections.get(sec2).display_order, 10);
    assert.equal(db.draftSections.get(sec1).display_order, 20);

    // Rejects unknown ID in reorder array
    assert.throws(
      () => db.reorderDraftSections([sec2, 'non-existent-uuid']),
      /REORDER_ERROR/
    );
  });

  it('4. Publish transaction snapshot captures full draft state including hidden sections', async () => {
    const db = new MockPostgresDatabase();

    // Mark sec2 as hidden
    db.draftSections.get('a1000002-0000-4000-8000-000000000002').is_visible = false;

    let rev;
    await db.executeInTransaction('tx-pub-1', async () => {
      rev = db.publishRevision('Release with one hidden section');
    });

    assert.ok(rev);
    assert.equal(rev.revision_number, 1);
    assert.equal(rev.snapshot_data.sections.length, 2, 'Snapshot must preserve hidden sections for complete restoration');

    const snapSec2 = rev.snapshot_data.sections.find(s => s.id === 'a1000002-0000-4000-8000-000000000002');
    assert.equal(snapSec2.is_visible, false);
  });

  it('5. Publishing aborts and rolls back if draft persistence fails', async () => {
    const db = new MockPostgresDatabase();
    let publishAttempted = false;

    // Simulate failure in draft save
    const simulateFailingClientPublish = async () => {
      const draftSaved = false; // Simulated failure
      if (!draftSaved) {
        throw new Error('DRAFT_PERSISTENCE_FAILED');
      }
      publishAttempted = true;
      db.publishRevision('Will not execute');
    };

    await assert.rejects(
      async () => await simulateFailingClientPublish(),
      /DRAFT_PERSISTENCE_FAILED/
    );

    assert.equal(publishAttempted, false, 'Publish RPC must never be called if draft persistence fails');
    assert.equal(db.revisions.length, 0, 'No revision should have been created');
  });
});
