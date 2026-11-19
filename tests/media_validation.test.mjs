// ============================================================================
// MG HOME CMS — Media Binary Signature & Security Validation Test Suite
// File: tests/media_validation.test.mjs
// Run: node --test tests/media_validation.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Validates binary magic signatures for image files
 */
function validateImageBinary(buffer, claimedMime, fileSize, width, height) {
  // 1. File size check
  if (!fileSize || fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
    throw new Error('VALIDATION ERROR: File size must be between 1 byte and 5MB.');
  }

  // 2. Dimension check
  if (!width || width <= 0 || width > 8192 || !height || height <= 0 || height > 8192) {
    throw new Error('VALIDATION ERROR: Image dimensions must be between 1x1 and 8192x8192.');
  }

  // 3. Header bytes
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    throw new Error('VALIDATION ERROR: Binary header bytes (at least 12 bytes) required for signature verification.');
  }

  let detectedMime = null;

  // JPEG SOI: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    detectedMime = 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    detectedMime = 'image/png';
  }
  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    detectedMime = 'image/webp';
  }

  if (!detectedMime) {
    throw new Error('SECURITY ERROR: File magic header signature does not match allowed image formats.');
  }

  if (detectedMime !== claimedMime) {
    throw new Error(`SECURITY ERROR: File magic header signature (${detectedMime}) does not match claimed MIME type (${claimedMime}).`);
  }

  return {
    valid: true,
    detectedMime,
    fileSize,
    width,
    height
  };
}

describe('4. Media Binary Signature & Upload Security Tests', () => {
  it('Should approve valid JPEG binary header', () => {
    // FF D8 FF E0 00 10 4A 46 49 46 00 01 (JPEG JFIF)
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const result = validateImageBinary(jpegBytes.buffer, 'image/jpeg', 150000, 1920, 1080);
    assert.equal(result.valid, true);
    assert.equal(result.detectedMime, 'image/jpeg');
  });

  it('Should approve valid PNG binary header', () => {
    // 89 50 4E 47 0D 0A 1A 0A 00 00 00 0D (PNG signature + IHDR length)
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const result = validateImageBinary(pngBytes.buffer, 'image/png', 240000, 800, 600);
    assert.equal(result.valid, true);
    assert.equal(result.detectedMime, 'image/png');
  });

  it('Should approve valid WebP binary header', () => {
    // RIFF (52 49 46 46) ... WEBP (57 45 42 50)
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const result = validateImageBinary(webpBytes.buffer, 'image/webp', 85000, 1200, 800);
    assert.equal(result.valid, true);
    assert.equal(result.detectedMime, 'image/webp');
  });

  it('Should reject MIME spoofing: Executable file (.exe / MZ header) renamed to .jpg', () => {
    // 4D 5A (MZ DOS executable header)
    const exeBytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    assert.throws(
      () => validateImageBinary(exeBytes.buffer, 'image/jpeg', 100000, 800, 600),
      /File magic header signature does not match allowed image formats/
    );
  });

  it('Should reject MIME mismatch: PNG file uploaded with image/jpeg claimed MIME', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    assert.throws(
      () => validateImageBinary(pngBytes.buffer, 'image/jpeg', 200000, 800, 600),
      /does not match claimed MIME type/
    );
  });

  it('Should reject oversized file (> 5MB)', () => {
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const oversized = 6 * 1024 * 1024; // 6MB
    assert.throws(
      () => validateImageBinary(jpegBytes.buffer, 'image/jpeg', oversized, 1920, 1080),
      /File size must be between 1 byte and 5MB/
    );
  });

  it('Should reject invalid dimensions (0px or > 8192px)', () => {
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    assert.throws(
      () => validateImageBinary(jpegBytes.buffer, 'image/jpeg', 150000, 0, 1080),
      /Image dimensions must be between 1x1 and 8192x8192/
    );
    assert.throws(
      () => validateImageBinary(jpegBytes.buffer, 'image/jpeg', 150000, 9000, 1080),
      /Image dimensions must be between 1x1 and 8192x8192/
    );
  });
});
