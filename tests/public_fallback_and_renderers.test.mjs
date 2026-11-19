// ============================================================================
// MG HOME CMS — Public Fallback & Section Renderers Test Suite
// File: tests/public_fallback_and_renderers.test.mjs
// Run: node --test tests/public_fallback_and_renderers.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('6. Public Fallback & Section Renderers Tests', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const cmsClientJs = fs.readFileSync(path.resolve('js/cms-client.js'), 'utf8');

  it('index.html must preserve Google Tag Manager (GTM-KVDSVFG5) and Google Ads (AW-18574001849)', () => {
    assert.match(indexHtml, /GTM-KVDSVFG5/, 'Must contain GTM-KVDSVFG5 container ID');
    assert.match(indexHtml, /AW-18574001849/, 'Must contain AW-18574001849 conversion ID');
    assert.match(indexHtml, /AW-18574001849\/l3JKCIbF-rgdELmN45hF/, 'Must contain Google Ads conversion label');
  });

  it('index.html must contain static fallback container #page-sections-container with existing 5 sections', () => {
    assert.match(indexHtml, /<main id="page-sections-container">/i, 'Must have page-sections-container');
    assert.match(indexHtml, /data-section-id="sec-hero-01"/, 'Hero section must have data-section-id');
    assert.match(indexHtml, /data-section-id="sec-services-02"/, 'Services section must have data-section-id');
    assert.match(indexHtml, /data-section-id="sec-copper-03"/, 'Copper section must have data-section-id');
    assert.match(indexHtml, /data-section-id="sec-gallery-04"/, 'Gallery section must have data-section-id');
    assert.match(indexHtml, /data-section-id="sec-contact-05"/, 'Contact section must have data-section-id');
  });

  it('index.html must load js/cms-client.js after translations, config, and main', () => {
    const mainPos = indexHtml.indexOf('src="js/main.js"');
    const clientPos = indexHtml.indexOf('src="js/cms-client.js"');
    assert.ok(mainPos > 0, 'main.js must be present');
    assert.ok(clientPos > mainPos, 'cms-client.js must be loaded after main.js');
  });

  it('cms-client.js must define SectionRenderers for all nine supported section types', () => {
    const requiredTypes = [
      'hero',
      'services',
      'copper',
      'gallery',
      'contact',
      'cta-banner',
      'faq',
      'testimonials',
      'text-image'
    ];

    for (const t of requiredTypes) {
      assert.match(
        cmsClientJs,
        new RegExp(`'${t}':\\s*function`, 'i'),
        `SectionRenderers must define renderer for '${t}'`
      );
    }
  });

  it('All section renderers in cms-client.js must generate valid DOM strings with tracking attributes', () => {
    // Execute a sandbox eval of the SectionRenderers extracted from cms-client.js
    const rendererMatch = cmsClientJs.match(/var SectionRenderers = \{([\s\S]*?)\n  \};/);
    assert.ok(rendererMatch, 'Must find SectionRenderers object in cms-client.js');

    // Create a mock sandbox to test each renderer function
    function createMockRenderer() {
      const mockEnv = {
        escapeHtml: (str) => String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        window: {
          SITE_CONFIG: {
            contact: { localNumber: '0538061531' },
            gallery: []
          }
        }
      };

      const fn = new Function('mockEnv', `
        var escapeHtml = mockEnv.escapeHtml;
        var window = mockEnv.window;
        var SectionRenderers = {${rendererMatch[1]}};
        return SectionRenderers;
      `);

      return fn(mockEnv);
    }

    const renderers = createMockRenderer();

    // 1. Hero
    const heroHtml = renderers['hero']({
      id: 'h1',
      anchorId: 'hero',
      content: {
        badgeAr: 'شارة البطل',
        titleHighlightAr: 'MG HOME',
        titleSuffixAr: 'لخدمات التكييف',
        features: [{ textAr: 'فنيون معتمدون' }]
      }
    }, 'ar');
    assert.match(heroHtml, /class="hero-section"/);
    assert.match(heroHtml, /data-wa-link/);
    assert.match(heroHtml, /شارة البطل/);
    assert.match(heroHtml, /فنيون معتمدون/);

    // 2. Services
    const srvHtml = renderers['services']({
      id: 's1',
      anchorId: 'services',
      content: {
        badgeAr: 'خدماتنا',
        titleAr: 'حلول التكييف',
        items: [{ titleAr: 'مكيفات سبليت', waService: 'split' }]
      }
    }, 'ar');
    assert.match(srvHtml, /class="service-card/);
    assert.match(srvHtml, /data-wa-link/);
    assert.match(srvHtml, /data-wa-service="split"/);

    // 3. Copper
    const copHtml = renderers['copper']({
      id: 'c1',
      anchorId: 'copper-piping',
      content: {
        badgeAr: 'تمديد النحاس',
        titleAr: 'مواسير النحاس',
        types: [{ titleAr: 'أمريكي', tagAr: 'أصلي', waServiceKey: 'copperAmerican' }],
        fieldworkCards: [{ titleAr: 'تأسيس جداري' }]
      }
    }, 'ar');
    assert.match(copHtml, /class="copper-card/);
    assert.match(copHtml, /data-wa-service="copperAmerican"/);
    assert.match(copHtml, /تأسيس جداري/);

    // 4. Gallery
    const gallHtml = renderers['gallery']({
      id: 'g1',
      anchorId: 'gallery',
      content: {
        badgeAr: 'معرض الأعمال',
        titleAr: 'أعمالنا',
        items: [{ id: 'photo-1', titleAr: 'عمل ميداني' }]
      }
    }, 'ar');
    assert.match(gallHtml, /id="gallery-grid"/);
    assert.match(gallHtml, /class="gallery-filter-nav"/);

    // 5. Contact
    const contHtml = renderers['contact']({
      id: 'ct1',
      anchorId: 'contact',
      content: {
        badgeAr: 'تواصل',
        titleAr: 'اتصل بنا',
        localPhone: '0538061531'
      }
    }, 'ar');
    assert.match(contHtml, /id="quick-inquiry-form"/);
    assert.match(contHtml, /data-wa-link/);
    assert.match(contHtml, /data-tel-link/);
    assert.match(contHtml, /0538061531/);

    // 6. CTA-Banner
    const ctaHtml = renderers['cta-banner']({
      id: 'cta1',
      anchorId: 'cta',
      content: {
        titleAr: 'احجز الآن',
        subtitleAr: 'خصم خاص',
        buttonTextAr: 'ابدأ المحادثة'
      }
    }, 'ar');
    assert.match(ctaHtml, /احجز الآن/);
    assert.match(ctaHtml, /data-wa-link/);

    // 7. FAQ
    const faqHtml = renderers['faq']({
      id: 'f1',
      anchorId: 'faq',
      content: {
        titleAr: 'الأسئلة الشائعة',
        items: [{ questionAr: 'سؤال 1', answerAr: 'جواب 1' }]
      }
    }, 'ar');
    assert.match(faqHtml, /<details class="faq-item"/);
    assert.match(faqHtml, /سؤال 1/);

    // 8. Testimonials
    const testHtml = renderers['testimonials']({
      id: 't1',
      anchorId: 'testimonials',
      content: {
        titleAr: 'آراء العملاء',
        items: [{ clientNameAr: 'أحمد', commentAr: 'خدمة ممتازة' }]
      }
    }, 'ar');
    assert.match(testHtml, /class="testimonial-card/);
    assert.match(testHtml, /أحمد/);

    // 9. Text-Image
    const txtImgHtml = renderers['text-image']({
      id: 'ti1',
      anchorId: 'about-us',
      content: {
        titleAr: 'عن المؤسسة',
        descriptionAr: 'نص وصفي'
      }
    }, 'ar');
    assert.match(txtImgHtml, /عن المؤسسة/);
    assert.match(txtImgHtml, /نص وصفي/);
  });
});
