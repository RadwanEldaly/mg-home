// ============================================================================
// MG HOME CMS — Preview Protocol & Origin Hardening Test Suite
// File: tests/preview_protocol.test.mjs
// Run: node --test tests/preview_protocol.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const PROTOCOL_NAME = 'MG_HOME_CMS_PREVIEW';
const PROTOCOL_VERSION = '2.3.0';

class MockIframePreviewChannel {
  constructor({ parentOrigin, allowedOrigins }) {
    this.parentOrigin = parentOrigin;
    this.allowedOrigins = new Set(allowedOrigins);
    this.isConnected = false;
    this.currentSections = [];
    this.selectedSectionId = null;
    this.dispatchedMessagesToParent = [];
  }

  // Receive message in iframe from outside
  receiveMessage(event) {
    // 1. Source verification
    if (event.source !== 'window.parent') {
      return { accepted: false, reason: 'REJECTED: Source is not window.parent' };
    }

    // 2. Origin verification
    if (!this.allowedOrigins.has(event.origin) && event.origin !== 'null') {
      return { accepted: false, reason: `REJECTED: Origin ${event.origin} not in allowed origins` };
    }

    // 3. Schema verification
    const data = event.data;
    if (!data || data.protocol !== PROTOCOL_NAME || data.version !== PROTOCOL_VERSION) {
      return { accepted: false, reason: 'REJECTED: Invalid protocol name or version' };
    }

    switch (data.type) {
      case 'MG_PREVIEW_HANDSHAKE_ACK':
        this.isConnected = true;
        return { accepted: true, action: 'ACKNOWLEDGED' };

      case 'MG_PREVIEW_INIT':
        this.currentSections = data.payload?.sections || [];
        return { accepted: true, action: 'HYDRATED_SECTIONS', count: this.currentSections.length };

      case 'MG_PREVIEW_HIGHLIGHT_SECTION':
        this.selectedSectionId = data.payload?.sectionId || null;
        return { accepted: true, action: 'HIGHLIGHTED', sectionId: this.selectedSectionId };

      default:
        return { accepted: false, reason: `REJECTED: Unknown message type ${data.type}` };
    }
  }

  // User clicked a section in iframe preview
  clickSection(sectionId) {
    const msg = {
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      type: 'MG_PREVIEW_SECTION_SELECTED',
      payload: { sectionId },
      timestamp: Date.now()
    };
    this.dispatchedMessagesToParent.push(msg);
    return msg;
  }
}

describe('5. Preview Protocol & Origin Hardening Tests', () => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://mg-home.online'
  ];

  it('Should reject message when origin is spoofed / unauthorized', () => {
    const channel = new MockIframePreviewChannel({ parentOrigin: 'http://localhost:5173', allowedOrigins });
    const maliciousEvent = {
      origin: 'https://evil-hacker-site.com',
      source: 'window.parent',
      data: {
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: 'MG_PREVIEW_INIT',
        payload: { sections: [] }
      }
    };

    const res = channel.receiveMessage(maliciousEvent);
    assert.equal(res.accepted, false);
    assert.match(res.reason, /not in allowed origins/);
    assert.equal(channel.isConnected, false);
  });

  it('Should reject message when source is not window.parent', () => {
    const channel = new MockIframePreviewChannel({ parentOrigin: 'http://localhost:5173', allowedOrigins });
    const spoofedSourceEvent = {
      origin: 'http://localhost:5173',
      source: 'some-third-party-window',
      data: {
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: 'MG_PREVIEW_INIT',
        payload: { sections: [] }
      }
    };

    const res = channel.receiveMessage(spoofedSourceEvent);
    assert.equal(res.accepted, false);
    assert.match(res.reason, /Source is not window\.parent/);
  });

  it('Should reject message with malformed protocol or wrong version', () => {
    const channel = new MockIframePreviewChannel({ parentOrigin: 'http://localhost:5173', allowedOrigins });
    const badVersionEvent = {
      origin: 'http://localhost:5173',
      source: 'window.parent',
      data: {
        protocol: PROTOCOL_NAME,
        version: '1.0.0', // outdated
        type: 'MG_PREVIEW_INIT',
        payload: {}
      }
    };

    const res = channel.receiveMessage(badVersionEvent);
    assert.equal(res.accepted, false);
    assert.match(res.reason, /Invalid protocol name or version/);
  });

  it('Should execute full handshake: READY -> ACK -> INIT', () => {
    const channel = new MockIframePreviewChannel({ parentOrigin: 'http://localhost:5173', allowedOrigins });

    // 1. ACK received
    const ackRes = channel.receiveMessage({
      origin: 'http://localhost:5173',
      source: 'window.parent',
      data: {
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: 'MG_PREVIEW_HANDSHAKE_ACK',
        payload: { status: 'connected' }
      }
    });
    assert.equal(ackRes.accepted, true);
    assert.equal(channel.isConnected, true);

    // 2. INIT received with sections
    const initRes = channel.receiveMessage({
      origin: 'http://localhost:5173',
      source: 'window.parent',
      data: {
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: 'MG_PREVIEW_INIT',
        payload: {
          sections: [
            { id: 'sec-hero-01', type: 'hero', label: 'Hero' },
            { id: 'sec-services-02', type: 'services', label: 'Services' }
          ]
        }
      }
    });
    assert.equal(initRes.accepted, true);
    assert.equal(channel.currentSections.length, 2);
  });

  it('Should dispatch MG_PREVIEW_SECTION_SELECTED with correct schema on section click', () => {
    const channel = new MockIframePreviewChannel({ parentOrigin: 'http://localhost:5173', allowedOrigins });
    const msg = channel.clickSection('sec-services-02');

    assert.equal(msg.protocol, PROTOCOL_NAME);
    assert.equal(msg.version, PROTOCOL_VERSION);
    assert.equal(msg.type, 'MG_PREVIEW_SECTION_SELECTED');
    assert.equal(msg.payload.sectionId, 'sec-services-02');
    assert.equal(channel.dispatchedMessagesToParent.length, 1);
  });
});
