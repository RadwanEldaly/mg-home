// ============================================================================
// MG HOME CMS — Snapshot Publishing & Restoration Integrity Test Suite
// File: tests/snapshot_integrity.test.mjs
// Run: node --test tests/snapshot_integrity.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure model of publish_page_revision validation and snapshot generation
 */
function publishPageRevision({ siteSettings, pageMetadata, sections, userId, notes }) {
  if (!userId) {
    throw new Error('ACCESS DENIED: Publishing requires an active AAL2 (TOTP MFA) session.');
  }

  // Validate site settings
  if (!siteSettings || !siteSettings.local_phone || siteSettings.local_phone.trim().length === 0) {
    throw new Error('VALIDATION ERROR: Draft site settings are missing or contain an invalid phone number.');
  }

  // Validate page metadata
  if (!pageMetadata || !pageMetadata.title_ar || pageMetadata.title_ar.trim().length === 0) {
    throw new Error('VALIDATION ERROR: Draft page metadata is missing or contains an empty Arabic title.');
  }

  // Validate sections
  if (!sections || sections.length === 0) {
    throw new Error('VALIDATION ERROR: Cannot publish an empty page. At least one section must exist.');
  }

  const visibleSections = sections.filter(s => s.is_visible);
  if (visibleSections.length === 0) {
    throw new Error('VALIDATION ERROR: Cannot publish with zero visible sections. At least one section must be visible.');
  }

  const snapshot = {
    version: '2.3.0',
    published_at: new Date().toISOString(),
    published_by: userId,
    site_settings: { ...siteSettings },
    page_metadata: { ...pageMetadata },
    sections: [...sections]
      .sort((a, b) => a.display_order - b.display_order)
      .map(s => ({
        id: s.id,
        type: s.section_type,
        label: s.section_label,
        order: s.display_order,
        isVisible: s.is_visible,
        anchorId: s.anchor_id,
        content: s.content || {},
        settings: s.settings || {}
      }))
  };

  // Verify DB check constraint condition
  assert.equal(typeof snapshot.site_settings, 'object');
  assert.equal(typeof snapshot.page_metadata, 'object');
  assert.ok(Array.isArray(snapshot.sections));
  assert.ok(snapshot.sections.length > 0);

  return snapshot;
}

/**
 * Pure model of restore_revision_to_draft validation and restoration
 */
function restoreRevisionToDraft({ snapshot, currentSettings, currentMetadata }) {
  if (!snapshot) {
    throw new Error('NOT FOUND: Revision does not exist.');
  }

  // 1. Schema check
  if (
    !snapshot.version ||
    !snapshot.site_settings ||
    typeof snapshot.site_settings !== 'object' ||
    !snapshot.page_metadata ||
    typeof snapshot.page_metadata !== 'object' ||
    !Array.isArray(snapshot.sections)
  ) {
    throw new Error('CORRUPT SNAPSHOT: Snapshot data does not conform to the required v2.3.0 schema.');
  }

  if (snapshot.sections.length === 0) {
    throw new Error('CORRUPT SNAPSHOT: Cannot restore an empty revision with zero sections.');
  }

  // 2. Validate section types
  const ALLOWED_TYPES = new Set([
    'hero', 'services', 'copper', 'gallery', 'contact', 'cta-banner', 'faq', 'testimonials', 'text-image'
  ]);

  for (const sec of snapshot.sections) {
    if (!sec.type || !ALLOWED_TYPES.has(sec.type)) {
      throw new Error(`CORRUPT SNAPSHOT: Unrecognized or missing section type (${sec.type}) in snapshot.`);
    }
  }

  // 3. Restore site settings safely
  const restoredSettings = {
    business_name_ar: (snapshot.site_settings.business_name_ar || '').trim() || currentSettings.business_name_ar,
    business_name_en: (snapshot.site_settings.business_name_en || '').trim() || currentSettings.business_name_en,
    local_phone: (snapshot.site_settings.local_phone || '').trim() || currentSettings.local_phone,
    country_code: (snapshot.site_settings.country_code || '').trim() || currentSettings.country_code,
    is_country_code_confirmed: snapshot.site_settings.is_country_code_confirmed === false ? false : true,
    instagram_url: (snapshot.site_settings.instagram_url || '').trim() || currentSettings.instagram_url,
    instagram_handle: (snapshot.site_settings.instagram_handle || '').trim() || currentSettings.instagram_handle,
    facebook_url: (snapshot.site_settings.facebook_url || '').trim() || currentSettings.facebook_url,
    service_messages_ar: typeof snapshot.site_settings.service_messages_ar === 'object' && snapshot.site_settings.service_messages_ar !== null
      ? snapshot.site_settings.service_messages_ar
      : currentSettings.service_messages_ar,
    service_messages_en: typeof snapshot.site_settings.service_messages_en === 'object' && snapshot.site_settings.service_messages_en !== null
      ? snapshot.site_settings.service_messages_en
      : currentSettings.service_messages_en
  };

  // 4. Restore metadata safely
  const restoredMetadata = {
    title_ar: (snapshot.page_metadata.title_ar || '').trim() || currentMetadata.title_ar,
    title_en: (snapshot.page_metadata.title_en || '').trim() || currentMetadata.title_en,
    meta_description_ar: (snapshot.page_metadata.meta_description_ar || '').trim() || currentMetadata.meta_description_ar,
    meta_description_en: (snapshot.page_metadata.meta_description_en || '').trim() || currentMetadata.meta_description_en,
    og_image_url: (snapshot.page_metadata.og_image_url || '').trim() || currentMetadata.og_image_url
  };

  // 5. Restore sections
  const restoredSections = snapshot.sections.map((s, idx) => ({
    id: s.id || `mock-id-${idx}`,
    section_type: s.type,
    section_label: (s.label || '').trim() || `Section ${idx + 1}`,
    display_order: s.order !== undefined ? s.order : (idx + 1) * 10,
    is_visible: s.isVisible !== undefined ? Boolean(s.isVisible) : true,
    anchor_id: (s.anchorId || `sec-${idx}`).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    content: typeof s.content === 'object' && s.content !== null ? s.content : {},
    settings: typeof s.settings === 'object' && s.settings !== null ? s.settings : {}
  }));

  return {
    restoredSettings,
    restoredMetadata,
    restoredSections
  };
}

describe('3. Snapshot Publishing & Restoration Integrity Tests', () => {
  const validSettings = {
    business_name_ar: 'إم جي هوم',
    business_name_en: 'MG HOME',
    local_phone: '0538061531',
    country_code: '966',
    is_country_code_confirmed: true
  };

  const validMetadata = {
    title_ar: 'MG HOME — لجميع خدمات التكييف',
    title_en: 'MG HOME — AC Services',
    meta_description_ar: 'الوصف التجريبي'
  };

  const validSections = [
    { id: 'sec-1', section_type: 'hero', section_label: 'Hero', display_order: 10, is_visible: true, anchor_id: 'hero' },
    { id: 'sec-2', section_type: 'services', section_label: 'Services', display_order: 20, is_visible: true, anchor_id: 'services' },
    { id: 'sec-3', section_type: 'copper', section_label: 'Copper', display_order: 30, is_visible: false, anchor_id: 'copper' }
  ];

  it('Publishing: Should reject when zero sections exist', () => {
    assert.throws(
      () => publishPageRevision({ siteSettings: validSettings, pageMetadata: validMetadata, sections: [], userId: 'admin-1' }),
      /Cannot publish an empty page/
    );
  });

  it('Publishing: Should reject when all sections are hidden (zero visible)', () => {
    const hiddenSections = validSections.map(s => ({ ...s, is_visible: false }));
    assert.throws(
      () => publishPageRevision({ siteSettings: validSettings, pageMetadata: validMetadata, sections: hiddenSections, userId: 'admin-1' }),
      /Cannot publish with zero visible sections/
    );
  });

  it('Publishing: Should reject when site settings has missing or empty phone', () => {
    assert.throws(
      () => publishPageRevision({ siteSettings: { ...validSettings, local_phone: '' }, pageMetadata: validMetadata, sections: validSections, userId: 'admin-1' }),
      /invalid phone number/
    );
  });

  it('Publishing: Should reject when page metadata has empty Arabic title', () => {
    assert.throws(
      () => publishPageRevision({ siteSettings: validSettings, pageMetadata: { ...validMetadata, title_ar: '   ' }, sections: validSections, userId: 'admin-1' }),
      /empty Arabic title/
    );
  });

  it('Publishing: Should include both visible AND hidden sections in published snapshot', () => {
    const snapshot = publishPageRevision({
      siteSettings: validSettings,
      pageMetadata: validMetadata,
      sections: validSections,
      userId: 'admin-1',
      notes: 'Test snapshot'
    });

    assert.equal(snapshot.sections.length, 3, 'Must capture all 3 sections');
    assert.equal(snapshot.sections[0].isVisible, true);
    assert.equal(snapshot.sections[2].isVisible, false, 'Hidden section visibility state must be preserved');
  });

  it('Restoration: Should reject corrupt snapshot missing top-level keys', () => {
    assert.throws(
      () => restoreRevisionToDraft({ snapshot: { version: '2.3.0' }, currentSettings: validSettings, currentMetadata: validMetadata }),
      /CORRUPT SNAPSHOT/
    );
  });

  it('Restoration: Should reject snapshot with invalid section type', () => {
    const corruptSnapshot = {
      version: '2.3.0',
      site_settings: validSettings,
      page_metadata: validMetadata,
      sections: [{ type: 'malicious-injected-type', label: 'Bad' }]
    };
    assert.throws(
      () => restoreRevisionToDraft({ snapshot: corruptSnapshot, currentSettings: validSettings, currentMetadata: validMetadata }),
      /Unrecognized or missing section type/
    );
  });

  it('Restoration: Should safely handle null, missing, and malformed fields during restoration', () => {
    const snapshotWithNulls = {
      version: '2.3.0',
      site_settings: {
        business_name_ar: '', // empty should fall back to current
        local_phone: null,
        is_country_code_confirmed: false,
        service_messages_ar: 'corrupt-string-not-object' // malformed should fall back to current
      },
      page_metadata: {
        title_ar: null
      },
      sections: [
        {
          id: 'sec-restored',
          type: 'hero',
          label: '',
          anchorId: 'HERO WITH SPACES & #$%^' // malformed anchor
        }
      ]
    };

    const result = restoreRevisionToDraft({
      snapshot: snapshotWithNulls,
      currentSettings: validSettings,
      currentMetadata: validMetadata
    });

    assert.equal(result.restoredSettings.business_name_ar, 'إم جي هوم');
    assert.equal(result.restoredSettings.local_phone, '0538061531');
    assert.equal(result.restoredSettings.is_country_code_confirmed, false);
    assert.equal(result.restoredMetadata.title_ar, 'MG HOME — لجميع خدمات التكييف');
    assert.equal(result.restoredSections[0].anchor_id, 'hero-with-spaces-------', 'Anchor must be sanitized to valid slug');
  });
});
