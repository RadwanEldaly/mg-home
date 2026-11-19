// ============================================================================
// MG HOME CMS — Section Reordering Validation Test Suite
// File: tests/reorder_validation.test.mjs
// Run: node --test tests/reorder_validation.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure model of the reorder_draft_sections database validation algorithm
 */
function validateAndReorder(existingSections, requestedIds) {
  if (!requestedIds || !Array.isArray(requestedIds) || requestedIds.length === 0) {
    throw new Error('VALIDATION ERROR: p_ordered_ids array cannot be null or empty.');
  }

  // 1. Check for duplicates in requested IDs
  const uniqueRequested = new Set(requestedIds);
  if (uniqueRequested.size !== requestedIds.length) {
    throw new Error('VALIDATION ERROR: Duplicate section IDs detected in reorder payload.');
  }

  // 2. Count existing sections
  const existingMap = new Map(existingSections.map(s => [s.id, s]));

  // 3. Check for unknown IDs
  for (const id of requestedIds) {
    if (!existingMap.has(id)) {
      throw new Error(`VALIDATION ERROR: Unknown section ID(s) provided that do not exist in draft sections: ${id}`);
    }
  }

  // 4. Check for missing IDs (omissions)
  if (requestedIds.length !== existingSections.length) {
    throw new Error(
      `VALIDATION ERROR: Every existing draft section must appear exactly once in the reorder payload (expected ${existingSections.length}, got ${requestedIds.length}).`
    );
  }

  // 5. Apply reordering
  return requestedIds.map((id, index) => {
    const sec = existingMap.get(id);
    return {
      ...sec,
      display_order: (index + 1) * 10
    };
  });
}

describe('2. Section Reordering Validation Tests', () => {
  const mockDraftSections = [
    { id: '11111111-1111-1111-1111-111111111111', label: 'Hero', display_order: 10 },
    { id: '22222222-2222-2222-2222-222222222222', label: 'Services', display_order: 20 },
    { id: '33333333-3333-3333-3333-333333333333', label: 'Copper', display_order: 30 },
    { id: '44444444-4444-4444-4444-444444444444', label: 'Gallery', display_order: 40 },
    { id: '55555555-5555-5555-5555-555555555555', label: 'Contact', display_order: 50 }
  ];

  it('Should reject null or empty reorder array', () => {
    assert.throws(() => validateAndReorder(mockDraftSections, null), /cannot be null or empty/);
    assert.throws(() => validateAndReorder(mockDraftSections, []), /cannot be null or empty/);
  });

  it('Should reject reorder array with duplicate IDs', () => {
    const duplicatePayload = [
      '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111', // duplicate
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444'
    ];
    assert.throws(
      () => validateAndReorder(mockDraftSections, duplicatePayload),
      /Duplicate section IDs detected/
    );
  });

  it('Should reject reorder array with unknown/non-existent IDs', () => {
    const unknownPayload = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
      '99999999-9999-9999-9999-999999999999' // unknown
    ];
    assert.throws(
      () => validateAndReorder(mockDraftSections, unknownPayload),
      /Unknown section ID\(s\) provided/
    );
  });

  it('Should reject reorder array with missing/omitted IDs', () => {
    const partialPayload = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
      // missing 4 and 5
    ];
    assert.throws(
      () => validateAndReorder(mockDraftSections, partialPayload),
      /Every existing draft section must appear exactly once/
    );
  });

  it('Should accept valid reordered permutation and assign sequential 10-step orders', () => {
    const validPermutation = [
      '55555555-5555-5555-5555-555555555555', // Contact first
      '22222222-2222-2222-2222-222222222222', // Services second
      '11111111-1111-1111-1111-111111111111', // Hero third
      '44444444-4444-4444-4444-444444444444', // Gallery fourth
      '33333333-3333-3333-3333-333333333333'  // Copper fifth
    ];

    const result = validateAndReorder(mockDraftSections, validPermutation);
    assert.equal(result.length, 5);
    assert.equal(result[0].id, '55555555-5555-5555-5555-555555555555');
    assert.equal(result[0].display_order, 10);
    assert.equal(result[1].id, '22222222-2222-2222-2222-222222222222');
    assert.equal(result[1].display_order, 20);
    assert.equal(result[2].id, '11111111-1111-1111-1111-111111111111');
    assert.equal(result[2].display_order, 30);
    assert.equal(result[3].id, '44444444-4444-4444-4444-444444444444');
    assert.equal(result[3].display_order, 40);
    assert.equal(result[4].id, '33333333-3333-3333-3333-333333333333');
    assert.equal(result[4].display_order, 50);
  });
});
