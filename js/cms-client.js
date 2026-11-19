/**
 * ============================================================================
 * MG HOME — Lightweight Public CMS Client & Visual Preview Engine (v2.3.0)
 * File: js/cms-client.js
 * ============================================================================
 * 
 * Capabilities:
 * 1. Active Published Revision Hydration:
 *    Fetches active published revision from Supabase PostgREST with 1500ms timeout.
 *    Dynamically updates DOM sections, meta tags, and SITE_CONFIG.
 *    Falls back smoothly to static HTML on network timeout or failure.
 * 2. Visual Builder Iframe Preview Protocol:
 *    Implements MG_HOME_CMS_PREVIEW v2.3.0 postMessage protocol for live drafting.
 *    Supports click-to-select, real-time section updates, and reordering.
 * 3. Analytics & Interaction Preservation:
 *    Preserves Google Tag (GTM-KVDSVFG5) and Google Ads (AW-18574001849) event
 *    listeners and data attributes on dynamically generated DOM nodes.
 */

(function () {
  'use strict';

  var PROTOCOL_NAME = 'MG_HOME_CMS_PREVIEW';
  var PROTOCOL_VERSION = '2.3.0';
  var FETCH_TIMEOUT_MS = 1500;

  // Global Config with Fallback Detection
  var cmsConfig = window.MG_CMS_CONFIG || {
    supabaseUrl: (window.localStorage && localStorage.getItem('mg_supabase_url')) || '',
    supabaseAnonKey: (window.localStorage && localStorage.getItem('mg_supabase_anon_key')) || ''
  };

  // Determine if running inside builder preview mode
  var isPreviewMode = (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('preview_mode') === 'true' || window.self !== window.top;
    } catch (e) {
      return false;
    }
  })();

  // --------------------------------------------------------------------------
  // Helper: Get Current Language ('ar' | 'en')
  // --------------------------------------------------------------------------
  function getCurrentLang() {
    return document.documentElement.lang || (window.AppState && window.AppState.lang) || 'ar';
  }

  // --------------------------------------------------------------------------
  // Helper: Escape HTML to prevent injection
  // --------------------------------------------------------------------------
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --------------------------------------------------------------------------
  // Step 1: DOM Section Renderers (Matching css/style.css markup)
  // --------------------------------------------------------------------------
  var SectionRenderers = {
    'hero': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var badge = escapeHtml(isAr ? c.badgeAr : (c.badgeEn || c.badgeAr));
      var titleHighlight = escapeHtml(isAr ? c.titleHighlightAr : (c.titleHighlightEn || c.titleHighlightAr));
      var titleSuffix = escapeHtml(isAr ? c.titleSuffixAr : (c.titleSuffixEn || c.titleSuffixAr));
      var description = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));
      var primaryCtaText = escapeHtml(isAr ? c.primaryCtaTextAr : (c.primaryCtaTextEn || c.primaryCtaTextAr));
      var secondaryCtaText = escapeHtml(isAr ? c.secondaryCtaTextAr : (c.secondaryCtaTextEn || c.secondaryCtaTextAr));
      var watermarkImg = escapeHtml(c.watermarkImage || 'assets/logo/mg-home-wave-logo.png');
      var visualImg = escapeHtml(c.visualImage || 'assets/maintenance/ac-split-hall-installation.jpeg');
      var badgeTitle = escapeHtml(isAr ? c.floatingBadgeTitleAr : (c.floatingBadgeTitleEn || c.floatingBadgeTitleAr));
      var badgeSubtitle = escapeHtml(isAr ? c.floatingBadgeSubtitleAr : (c.floatingBadgeSubtitleEn || c.floatingBadgeSubtitleAr));

      var features = isAr ? (c.featuresAr || []) : (c.featuresEn || c.featuresAr || []);
      var featuresHtml = features.map(function (feat) {
        return '<div class="hero-feature-item">' +
          '<div class="hero-feature-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>' +
              '<polyline points="22 4 12 14.01 9 11.01"></polyline>' +
            '</svg>' +
          '</div>' +
          '<span class="hero-feature-text">' + escapeHtml(feat) + '</span>' +
        '</div>';
      }).join('');

      return '<section class="hero-section" id="' + escapeHtml(section.anchorId || 'hero') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="hero-brand-bg" aria-hidden="true">' +
          '<img src="' + watermarkImg + '" alt="" class="hero-brand-logo-img" width="820" height="280" loading="eager" />' +
        '</div>' +
        '<div class="container hero-grid">' +
          '<div class="hero-content">' +
            '<div class="hero-badge">' +
              '<span class="hero-badge-dot"></span>' +
              '<span>' + badge + '</span>' +
            '</div>' +
            '<h1 class="hero-title">' +
              '<span class="hero-title-highlight">' + titleHighlight + '</span><br>' +
              '<span>' + titleSuffix + '</span>' +
            '</h1>' +
            '<p class="hero-description">' + description + '</p>' +
            '<div class="hero-actions">' +
              '<a href="#" class="btn-primary" data-wa-link>' +
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                  '<path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.668-.7c.96.523 1.942.848 2.792.848 3.179 0 5.765-2.586 5.767-5.766.001-3.182-2.585-5.768-5.767-5.768zm0 10.363c-.803 0-1.637-.232-2.385-.697l-.17-.107-1.77.464.472-1.724-.117-.186a4.582 4.582 0 01-.703-2.482c.001-2.529 2.059-4.586 4.59-4.586 2.53 0 4.588 2.057 4.588 4.586 0 2.53-2.058 4.587-4.405 4.587v.147zm2.518-3.447c-.138-.07-.817-.404-.943-.45-.127-.046-.22-.07-.312.07-.093.139-.358.45-.44.542-.08.093-.162.105-.3.035-.138-.07-.584-.215-1.113-.687-.411-.366-.689-.819-.77-958-.08-.139-.009-.214.06-.283.063-.062.139-.162.208-.243.07-.081.093-.139.139-.232.046-.093.023-.174-.012-.243-.035-.07-.312-.753-.428-1.03-.112-.27-.226-.233-.312-.238-.081-.004-.174-.005-.266-.005-.093 0-.243.035-.37.174-.127.139-.486.475-.486 1.159s.498 1.344.567 1.437c.07.092.98 1.498 2.374 2.101.332.144.591.23.794.294.333.106.637.091.877.055.267-.04 817-.334.933-.657.116-.323.116-.6.081-.657-.035-.058-.127-.093-.266-.162z"/>' +
                '</svg>' +
                '<span>' + primaryCtaText + '</span>' +
              '</a>' +
              '<a href="#services" class="btn-secondary">' +
                '<span>' + secondaryCtaText + '</span>' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<line x1="7" y1="17" x2="17" y2="7"></line>' +
                  '<polyline points="7 7 17 7 17 17"></polyline>' +
                '</svg>' +
              '</a>' +
            '</div>' +
            '<div class="hero-features">' + featuresHtml + '</div>' +
          '</div>' +
          '<div class="hero-visual">' +
            '<div class="hero-image-card">' +
              '<img src="' + visualImg + '" alt="MG HOME" class="hero-img" width="600" height="450" fetchpriority="high" />' +
              '<div class="hero-floating-badge">' +
                '<div class="hero-floating-icon">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>' +
                    '<polyline points="22 4 12 14.01 9 11.01"></polyline>' +
                  '</svg>' +
                '</div>' +
                '<div>' +
                  '<p class="hero-floating-title">' + badgeTitle + '</p>' +
                  '<p class="hero-floating-subtitle">' + badgeSubtitle + '</p>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    },

    'services': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var badge = escapeHtml(isAr ? c.badgeAr : (c.badgeEn || c.badgeAr));
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var desc = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));

      var items = c.items || [];
      var itemsHtml = items.map(function (item) {
        var itemTitle = escapeHtml(isAr ? item.titleAr : (item.titleEn || item.titleAr));
        var itemDesc = escapeHtml(isAr ? item.descriptionAr : (item.descriptionEn || item.descriptionAr));
        var btnText = escapeHtml(isAr ? item.btnTextAr : (item.btnTextEn || item.btnTextAr));
        var waService = escapeHtml(item.waService || 'default');

        var bullets = isAr ? (item.bulletsAr || []) : (item.bulletsEn || item.bulletsAr || []);
        var bulletsHtml = bullets.map(function (b) {
          return '<li><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>' + escapeHtml(b) + '</span></li>';
        }).join('');

        return '<article class="service-card stagger-item">' +
          '<div class="service-icon-box">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
              '<rect x="2" y="4" width="20" height="9" rx="2"></rect>' +
              '<line x1="6" y1="9" x2="6.01" y2="9"></line>' +
              '<line x1="10" y1="9" x2="14" y2="9"></line>' +
              '<path d="M6 17a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3"></path>' +
            '</svg>' +
          '</div>' +
          '<h3 class="service-title">' + itemTitle + '</h3>' +
          '<p class="service-desc">' + itemDesc + '</p>' +
          '<ul class="service-bullets">' + bulletsHtml + '</ul>' +
          '<a href="#" class="service-action-btn" data-wa-link data-wa-service="' + waService + '">' +
            '<span>' + btnText + '</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>' +
          '</a>' +
        '</article>';
      }).join('');

      return '<section class="section section-alt" id="' + escapeHtml(section.anchorId || 'services') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<span class="section-badge">' + badge + '</span>' +
            '<h2 class="section-title">' + title + '</h2>' +
            '<p class="section-description">' + desc + '</p>' +
          '</div>' +
          '<div class="services-grid stagger-group">' + itemsHtml + '</div>' +
        '</div>' +
      '</section>';
    },

    'copper': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var badge = escapeHtml(isAr ? c.badgeAr : (c.badgeEn || c.badgeAr));
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var desc = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));

      var types = c.types || [];
      var typesHtml = types.map(function (t) {
        var tTitle = escapeHtml(isAr ? t.titleAr : (t.titleEn || t.titleAr));
        var tDesc = escapeHtml(isAr ? t.descriptionAr : (t.descriptionEn || t.descriptionAr));
        var tTag = escapeHtml(isAr ? t.tagAr : (t.tagEn || t.tagAr));
        var tBtn = escapeHtml(isAr ? t.btnTextAr : (t.btnTextEn || t.btnTextAr));
        var tImg = escapeHtml(t.image || 'assets/copper/american-copper-pipe.jpeg');
        var waService = escapeHtml(t.waService || 'copper');

        var bullets = isAr ? (t.bulletsAr || []) : (t.bulletsEn || t.bulletsAr || []);
        var bulletsHtml = bullets.map(function (b) {
          return '<li><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>' + escapeHtml(b) + '</span></li>';
        }).join('');

        return '<article class="copper-card stagger-item">' +
          '<div class="copper-img-wrapper">' +
            '<img src="' + tImg + '" alt="' + tTitle + '" class="copper-img" loading="lazy" width="600" height="450" />' +
            '<span class="copper-tag">' + tTag + '</span>' +
          '</div>' +
          '<div class="copper-body">' +
            '<h3 class="copper-title">' + tTitle + '</h3>' +
            '<p class="copper-desc">' + tDesc + '</p>' +
            '<ul class="copper-bullets">' + bulletsHtml + '</ul>' +
            '<a href="#" class="copper-btn" data-wa-link data-wa-service="' + waService + '">' +
              '<span>' + tBtn + '</span>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>' +
            '</a>' +
          '</div>' +
        '</article>';
      }).join('');

      var fieldwork = c.fieldwork || {};
      var fieldworkBadge = escapeHtml(isAr ? fieldwork.badgeAr : (fieldwork.badgeEn || fieldwork.badgeAr));
      var fieldworkTitle = escapeHtml(isAr ? fieldwork.titleAr : (fieldwork.titleEn || fieldwork.titleAr));
      var fieldworkDesc = escapeHtml(isAr ? fieldwork.descriptionAr : (fieldwork.descriptionEn || fieldwork.descriptionAr));
      var fieldworkBtn = escapeHtml(isAr ? fieldwork.btnTextAr : (fieldwork.btnTextEn || fieldwork.btnTextAr));

      var photos = fieldwork.photos || [];
      var photosHtml = photos.map(function (p) {
        var pTitle = escapeHtml(isAr ? p.titleAr : (p.titleEn || p.titleAr));
        var pDesc = escapeHtml(isAr ? p.descAr : (p.descEn || p.descAr));
        var pImg = escapeHtml(p.image || '');

        return '<div class="copper-fieldwork-item stagger-item">' +
          '<img src="' + pImg + '" alt="' + pTitle + '" class="copper-fieldwork-img" loading="lazy" width="400" height="300" />' +
          '<div class="copper-fieldwork-caption">' +
            '<strong>' + pTitle + '</strong>' +
            '<span>' + pDesc + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<section class="section section-copper" id="' + escapeHtml(section.anchorId || 'copper-piping') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<span class="section-badge">' + badge + '</span>' +
            '<h2 class="section-title">' + title + '</h2>' +
            '<p class="section-description">' + desc + '</p>' +
          '</div>' +
          '<div class="copper-grid stagger-group">' + typesHtml + '</div>' +
          '<div class="copper-fieldwork-panel reveal-on-scroll">' +
            '<div class="copper-fieldwork-header">' +
              '<div>' +
                '<span class="section-badge">' + fieldworkBadge + '</span>' +
                '<h3 class="copper-fieldwork-title">' + fieldworkTitle + '</h3>' +
                '<p class="copper-fieldwork-desc">' + fieldworkDesc + '</p>' +
              '</div>' +
              '<a href="#" class="btn-primary" data-wa-link data-wa-service="copper">' +
                '<span>' + fieldworkBtn + '</span>' +
              '</a>' +
            '</div>' +
            '<div class="copper-fieldwork-grid stagger-group">' + photosHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    },

    'gallery': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var badge = escapeHtml(isAr ? c.badgeAr : (c.badgeEn || c.badgeAr));
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var desc = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));

      var filters = c.categories || [
        { id: 'all', labelAr: 'الكل', labelEn: 'All' },
        { id: 'copper', labelAr: 'مواسير وتأسيس', labelEn: 'Copper Piping' },
        { id: 'split', labelAr: 'تكييف سبليت', labelEn: 'Split AC' },
        { id: 'duct', labelAr: 'دكت وتكييف مركزي', labelEn: 'Duct AC' },
        { id: 'standing', labelAr: 'دولابي وتجاري', labelEn: 'Commercial' },
        { id: 'washing', labelAr: 'غسالات وصحون', labelEn: 'Washers' },
        { id: 'appliances', labelAr: 'تبريد وأجهزة', labelEn: 'Appliances' }
      ];

      var filtersHtml = filters.map(function (f, idx) {
        var activeClass = idx === 0 ? 'filter-btn active' : 'filter-btn';
        var fLabel = escapeHtml(isAr ? f.labelAr : (f.labelEn || f.labelAr));
        return '<button type="button" class="' + activeClass + '" data-filter="' + escapeHtml(f.id) + '">' + fLabel + '</button>';
      }).join('');

      return '<section class="section" id="' + escapeHtml(section.anchorId || 'gallery') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<span class="section-badge">' + badge + '</span>' +
            '<h2 class="section-title">' + title + '</h2>' +
            '<p class="section-description">' + desc + '</p>' +
          '</div>' +
          '<div class="gallery-filter-nav" role="tablist" aria-label="Gallery Filters">' + filtersHtml + '</div>' +
          '<div class="gallery-grid" id="gallery-grid"></div>' +
        '</div>' +
      '</section>';
    },

    'contact': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var badge = escapeHtml(isAr ? c.badgeAr : (c.badgeEn || c.badgeAr));
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var desc = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));
      var phone = escapeHtml(c.localPhone || (window.SITE_CONFIG && window.SITE_CONFIG.contact.localNumber) || '0538061531');
      var formTitle = escapeHtml(isAr ? c.formTitleAr : (c.formTitleEn || c.formTitleAr));
      var formSubtitle = escapeHtml(isAr ? c.formSubtitleAr : (c.formSubtitleEn || c.formSubtitleAr));
      var formSubmitBtn = escapeHtml(isAr ? c.formSubmitBtnAr : (c.formSubmitBtnEn || c.formSubmitBtnAr));

      return '<section class="section section-alt" id="' + escapeHtml(section.anchorId || 'contact') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<span class="section-badge">' + badge + '</span>' +
            '<h2 class="section-title">' + title + '</h2>' +
            '<p class="section-description">' + desc + '</p>' +
          '</div>' +
          '<div class="contact-grid">' +
            '<div class="contact-info-panel">' +
              '<div class="contact-card">' +
                '<div class="contact-card-icon wa">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.668-.7c.96.523 1.942.848 2.792.848 3.179 0 5.765-2.586 5.767-5.766.001-3.182-2.585-5.768-5.767-5.768zm0 10.363c-.803 0-1.637-.232-2.385-.697l-.17-.107-1.77.464.472-1.724-.117-.186a4.582 4.582 0 01-.703-2.482c.001-2.529 2.059-4.586 4.59-4.586 2.53 0 4.588 2.057 4.588 4.586 0 2.53-2.058 4.587-4.405 4.587v.147zm2.518-3.447c-.138-.07-.817-.404-.943-.45-.127-.046-.22-.07-.312.07-.093.139-.358.45-.44.542-.08.093-.162.105-.3.035-.138-.07-.584-.215-1.113-.687-.411-.366-.689-.819-.77-958-.08-.139-.009-.214.06-.283.063-.062.139-.162.208-.243.07-.081.093-.139.139-.232.046-.093.023-.174-.012-.243-.035-.07-.312-.753-.428-1.03-.112-.27-.226-.233-.312-.238-.081-.004-.174-.005-.266-.005-.093 0-.243.035-.37.174-.127.139-.486.475-.486 1.159s.498 1.344.567 1.437c.07.092.98 1.498 2.374 2.101.332.144.591.23.794.294.333.106.637.091.877.055.267-.04 817-.334.933-.657.116-.323.116-.6.081-.657-.035-.058-.127-.093-.266-.162z"/></svg>' +
                '</div>' +
                '<div class="contact-card-content">' +
                  '<span class="contact-card-label">' + (isAr ? 'المحادثة الفورية عبر واتساب' : 'WhatsApp Instant Chat') + '</span>' +
                  '<span class="contact-card-value" data-phone-display>' + phone + '</span>' +
                  '<p class="contact-card-note">' + (isAr ? 'تواصل مباشر لتحديد الموعد واستقبال استفسارات الصيانة والأسعار.' : 'Direct communication for appointments, pricing, and inquiries.') + '</p>' +
                  '<a href="#" class="contact-link-btn wa" data-wa-link><span>' + (isAr ? 'بدء محادثة واتساب' : 'Start WhatsApp Chat') + '</span></a>' +
                '</div>' +
              '</div>' +
              '<div class="contact-card">' +
                '<div class="contact-card-icon call">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' +
                '</div>' +
                '<div class="contact-card-content">' +
                  '<span class="contact-card-label">' + (isAr ? 'الاتصال الهاتفي المباشر' : 'Direct Phone Call') + '</span>' +
                  '<span class="contact-card-value" data-phone-display>' + phone + '</span>' +
                  '<p class="contact-card-note">' + (isAr ? 'متاحون للرد السريع على الاتصالات واستقبال استفساراتكم وحجز المواعيد.' : 'Ready for fast phone responses and booking appointments.') + '</p>' +
                  '<a href="tel:' + phone + '" class="contact-link-btn call" data-tel-link><span>' + (isAr ? 'إجراء اتصال هاتفي' : 'Call Directly') + '</span></a>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="contact-form-panel">' +
              '<h3 class="contact-form-title">' + formTitle + '</h3>' +
              '<p class="contact-form-subtitle">' + formSubtitle + '</p>' +
              '<form id="quick-inquiry-form">' +
                '<div class="form-group">' +
                  '<label for="inquiry-service" class="form-label">' + (isAr ? 'نوع الخدمة المطلوبة' : 'Service Type') + '</label>' +
                  '<select id="inquiry-service" class="form-control" required>' +
                    '<option value="split">' + (isAr ? 'صيانة أو تركيب مكيفات سبليت' : 'Split AC Installation & Repair') + '</option>' +
                    '<option value="copper">' + (isAr ? 'تأسيس وتمديد مواسير النحاس' : 'Copper Piping Installation') + '</option>' +
                    '<option value="duct">' + (isAr ? 'تمديد دكت وتكييف مركزي' : 'Duct & Central AC') + '</option>' +
                    '<option value="standing">' + (isAr ? 'مكيفات دولابية أو ستائر هوائية' : 'Standing AC & Air Curtains') + '</option>' +
                    '<option value="washing">' + (isAr ? 'صيانة غسالات أوتوماتيك وغسالات أطباق' : 'Washing Machines & Dishwashers') + '</option>' +
                    '<option value="fridge">' + (isAr ? 'صيانة ثلاجات وأجهزة تبريد' : 'Refrigerators & Cooling') + '</option>' +
                    '<option value="other">' + (isAr ? 'خدمات صيانة أخرى' : 'Other Maintenance Services') + '</option>' +
                  '</select>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label for="inquiry-name" class="form-label">' + (isAr ? 'الاسم الكريم (اختياري)' : 'Your Name (Optional)') + '</label>' +
                  '<input type="text" id="inquiry-name" class="form-control" placeholder="' + (isAr ? 'مثال: أبو محمد' : 'e.g. John') + '" />' +
                '</div>' +
                '<div class="form-group">' +
                  '<label for="inquiry-details" class="form-label">' + (isAr ? 'وصف العطل أو تفاصيل الطلب' : 'Issue Description / Details') + '</label>' +
                  '<textarea id="inquiry-details" class="form-control" placeholder="' + (isAr ? 'اكتب وصفًا موجزًا للمشكلة أو نوع الجهاز والحي...' : 'Brief description of issue, appliance type, and district...') + '"></textarea>' +
                '</div>' +
                '<button type="submit" class="btn-form-submit">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.668-.7c.96.523 1.942.848 2.792.848 3.179 0 5.765-2.586 5.767-5.766.001-3.182-2.585-5.768-5.767-5.768zm0 10.363c-.803 0-1.637-.232-2.385-.697l-.17-.107-1.77.464.472-1.724-.117-.186a4.582 4.582 0 01-.703-2.482c.001-2.529 2.059-4.586 4.59-4.586 2.53 0 4.588 2.057 4.588 4.586 0 2.53-2.058 4.587-4.405 4.587v.147zm2.518-3.447c-.138-.07-.817-.404-.943-.45-.127-.046-.22-.07-.312.07-.093.139-.358.45-.44.542-.08.093-.162.105-.3.035-.138-.07-.584-.215-1.113-.687-.411-.366-.689-.819-.77-958-.08-.139-.009-.214.06-.283.063-.062.139-.162.208-.243.07-.081.093-.139.139-.232.046-.093.023-.174-.012-.243-.035-.07-.312-.753-.428-1.03-.112-.27-.226-.233-.312-.238-.081-.004-.174-.005-.266-.005-.093 0-.243.035-.37.174-.127.139-.486.475-.486 1.159s.498 1.344.567 1.437c.07.092.98 1.498 2.374 2.101.332.144.591.23.794.294.333.106.637.091.877.055.267-.04 817-.334.933-.657.116-.323.116-.6.081-.657-.035-.058-.127-.093-.266-.162z"/></svg>' +
                  '<span>' + formSubmitBtn + '</span>' +
                '</button>' +
              '</form>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    },

    'cta-banner': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var subtitle = escapeHtml(isAr ? c.subtitleAr : (c.subtitleEn || c.subtitleAr));
      var buttonText = escapeHtml(isAr ? c.buttonTextAr : (c.buttonTextEn || c.buttonTextAr));
      var waService = escapeHtml(c.waService || 'default');

      return '<section class="section section-cta-banner" id="' + escapeHtml(section.anchorId || 'cta-banner') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="cta-banner-wrapper" style="background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%); border-radius: 20px; padding: 48px 32px; color: #fff; text-align: center; box-shadow: 0 10px 30px rgba(2, 132, 199, 0.2);">' +
            '<h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 12px; color: #fff;">' + title + '</h2>' +
            '<p style="font-size: 1.05rem; opacity: 0.92; max-width: 600px; margin: 0 auto 28px; line-height: 1.6;">' + subtitle + '</p>' +
            '<a href="#" class="btn-primary" data-wa-link data-wa-service="' + waService + '" style="display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #0369a1; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.1);">' +
              '<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.668-.7c.96.523 1.942.848 2.792.848 3.179 0 5.765-2.586 5.767-5.766.001-3.182-2.585-5.768-5.767-5.768zm0 10.363c-.803 0-1.637-.232-2.385-.697l-.17-.107-1.77.464.472-1.724-.117-.186a4.582 4.582 0 01-.703-2.482c.001-2.529 2.059-4.586 4.59-4.586 2.53 0 4.588 2.057 4.588 4.586 0 2.53-2.058 4.587-4.405 4.587v.147zm2.518-3.447c-.138-.07-.817-.404-.943-.45-.127-.046-.22-.07-.312.07-.093.139-.358.45-.44.542-.08.093-.162.105-.3.035-.138-.07-.584-.215-1.113-.687-.411-.366-.689-.819-.77-958-.08-.139-.009-.214.06-.283.063-.062.139-.162.208-.243.07-.081.093-.139.139-.232.046-.093.023-.174-.012-.243-.035-.07-.312-.753-.428-1.03-.112-.27-.226-.233-.312-.238-.081-.004-.174-.005-.266-.005-.093 0-.243.035-.37.174-.127.139-.486.475-.486 1.159s.498 1.344.567 1.437c.07.092.98 1.498 2.374 2.101.332.144.591.23.794.294.333.106.637.091.877.055.267-.04 817-.334.933-.657.116-.323.116-.6.081-.657-.035-.058-.127-.093-.266-.162z"/></svg>' +
              '<span>' + buttonText + '</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</section>';
    },

    'faq': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var subtitle = escapeHtml(isAr ? c.subtitleAr : (c.subtitleEn || c.subtitleAr));

      var items = c.items || [];
      var itemsHtml = items.map(function (item) {
        var q = escapeHtml(isAr ? item.questionAr : (item.questionEn || item.questionAr));
        var a = escapeHtml(isAr ? item.answerAr : (item.answerEn || item.answerAr));
        return '<details class="faq-item" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px 24px; margin-bottom: 12px;">' +
          '<summary style="font-weight: 700; cursor: pointer; color: var(--text-primary); font-size: 1.05rem;">' + q + '</summary>' +
          '<p style="margin-top: 12px; color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;">' + a + '</p>' +
        '</details>';
      }).join('');

      return '<section class="section" id="' + escapeHtml(section.anchorId || 'faq') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<h2 class="section-title">' + title + '</h2>' +
            (subtitle ? '<p class="section-description">' + subtitle + '</p>' : '') +
          '</div>' +
          '<div class="faq-list" style="max-width: 800px; margin: 0 auto;">' + itemsHtml + '</div>' +
        '</div>' +
      '</section>';
    },

    'testimonials': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var subtitle = escapeHtml(isAr ? c.subtitleAr : (c.subtitleEn || c.subtitleAr));

      var items = c.items || [];
      var itemsHtml = items.map(function (item) {
        var name = escapeHtml(isAr ? item.clientNameAr : (item.clientNameEn || item.clientNameAr));
        var role = escapeHtml(isAr ? item.roleAr : (item.roleEn || item.roleAr));
        var comment = escapeHtml(isAr ? item.commentAr : (item.commentEn || item.commentAr));
        return '<div class="testimonial-card stagger-item" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm);">' +
          '<div style="color: #f59e0b; font-size: 1.1rem; margin-bottom: 12px;">★★★★★</div>' +
          '<p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px; font-style: italic;">“' + comment + '”</p>' +
          '<div>' +
            '<strong style="display: block; color: var(--text-primary); font-size: 0.95rem;">' + name + '</strong>' +
            '<span style="color: var(--text-muted); font-size: 0.85rem;">' + role + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<section class="section section-alt" id="' + escapeHtml(section.anchorId || 'testimonials') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div class="section-header reveal-on-scroll">' +
            '<h2 class="section-title">' + title + '</h2>' +
            (subtitle ? '<p class="section-description">' + subtitle + '</p>' : '') +
          '</div>' +
          '<div class="testimonials-grid stagger-group" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">' + itemsHtml + '</div>' +
        '</div>' +
      '</section>';
    },

    'text-image': function (section, lang) {
      var isAr = lang === 'ar';
      var c = section.content || {};
      var title = escapeHtml(isAr ? c.titleAr : (c.titleEn || c.titleAr));
      var body = escapeHtml(isAr ? c.descriptionAr : (c.descriptionEn || c.descriptionAr));
      var img = escapeHtml(c.image || '');
      var align = c.alignment || 'right';

      var imgBlock = img ? '<div style="flex: 1; min-width: 280px; border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-md);"><img src="' + img + '" alt="' + title + '" style="width: 100%; height: auto; display: block;" loading="lazy" /></div>' : '';
      var textBlock = '<div style="flex: 1; min-width: 280px;">' +
        '<h2 class="section-title" style="margin-bottom: 16px;">' + title + '</h2>' +
        '<p class="section-description" style="line-height: 1.7; margin: 0;">' + body + '</p>' +
      '</div>';

      var contentLayout = align === 'left' ? (imgBlock + textBlock) : (textBlock + imgBlock);

      return '<section class="section" id="' + escapeHtml(section.anchorId || 'custom-text-image') + '" data-section-id="' + escapeHtml(section.id) + '">' +
        '<div class="container">' +
          '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 40px;">' + contentLayout + '</div>' +
        '</div>' +
      '</section>';
    }
  };

  // --------------------------------------------------------------------------
  // Step 2: Render All Sections into Container
  // --------------------------------------------------------------------------
  function renderSections(sectionsList, lang) {
    var container = document.getElementById('page-sections-container') || document.querySelector('main');
    if (!container) return;

    var activeLang = lang || getCurrentLang();
    var visibleSections = (sectionsList || []).filter(function (s) {
      return s.isVisible !== false && s.is_visible !== false;
    });

    if (visibleSections.length === 0) {
      console.warn('[MG CMS] Empty visible sections list; retaining fallback content.');
      return;
    }

    var htmlParts = [];
    visibleSections.forEach(function (sec) {
      var renderer = SectionRenderers[sec.type];
      if (typeof renderer === 'function') {
        htmlParts.push(renderer(sec, activeLang));
      } else {
        console.warn('[MG CMS] Unknown section type:', sec.type);
      }
    });

    container.innerHTML = htmlParts.join('\n');

    // Re-bind interactive modules from js/main.js
    reinitializePageInteractions();
  }

  // --------------------------------------------------------------------------
  // Step 3: Re-initialize Page Interactions & Analytics
  // --------------------------------------------------------------------------
  function reinitializePageInteractions() {
    // 1. Re-initialize contact links (WhatsApp, Tel, Socials)
    if (typeof window.initContactLinks === 'function') {
      window.initContactLinks();
    }

    // 2. Re-initialize gallery filtering & rendering
    if (typeof window.initGallery === 'function') {
      window.initGallery();
    }

    // 3. Re-initialize quick inquiry form
    if (typeof window.initQuickInquiryForm === 'function') {
      window.initQuickInquiryForm();
    }

    // 4. Re-initialize scroll animations
    if (typeof window.initScrollReveals === 'function') {
      window.initScrollReveals();
    }

    // 5. If in preview mode, re-attach click-to-select handlers
    if (isPreviewMode) {
      attachPreviewSelectionHandlers();
    }
  }

  // --------------------------------------------------------------------------
  // Step 4: Preview Handshake & PostMessage Handling
  // --------------------------------------------------------------------------
  function attachPreviewSelectionHandlers() {
    document.querySelectorAll('[data-section-id]').forEach(function (el) {
      el.style.transition = 'outline 0.2s ease, box-shadow 0.2s ease';
      el.style.cursor = 'pointer';

      el.addEventListener('mouseenter', function () {
        if (!el.classList.contains('cms-selected')) {
          el.style.outline = '2px dashed #0284c7';
          el.style.outlineOffset = '-2px';
        }
      });

      el.addEventListener('mouseleave', function () {
        if (!el.classList.contains('cms-selected')) {
          el.style.outline = 'none';
        }
      });

      el.addEventListener('click', function (e) {
        // Prevent anchor navigation while editing
        var link = e.target.closest('a');
        if (link && isPreviewMode) {
          e.preventDefault();
        }

        var secId = el.getAttribute('data-section-id');
        if (secId && window.parent && window.parent !== window) {
          // Highlight active selected element
          document.querySelectorAll('.cms-selected').forEach(function (node) {
            node.classList.remove('cms-selected');
            node.style.outline = 'none';
          });
          el.classList.add('cms-selected');
          el.style.outline = '3px solid #0284c7';
          el.style.outlineOffset = '-3px';

          window.parent.postMessage({
            protocol: PROTOCOL_NAME,
            version: PROTOCOL_VERSION,
            type: 'MG_PREVIEW_SECTION_SELECTED',
            payload: { sectionId: secId },
            timestamp: Date.now()
          }, '*');
        }
      });
    });
  }

  function setupPreviewProtocol() {
    // Notify parent window that preview frame is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: 'MG_PREVIEW_HANDSHAKE_READY',
        timestamp: Date.now()
      }, '*');
    }

    // Listen for messages from builder admin shell
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || data.protocol !== PROTOCOL_NAME) return;

      switch (data.type) {
        case 'MG_PREVIEW_INIT':
          if (data.payload) {
            var payload = data.payload;

            // Apply Site Settings in-memory
            if (payload.siteSettings && window.SITE_CONFIG) {
              window.SITE_CONFIG.contact.localNumber = payload.siteSettings.localPhone || window.SITE_CONFIG.contact.localNumber;
              window.SITE_CONFIG.contact.countryCode = payload.siteSettings.countryCode || window.SITE_CONFIG.contact.countryCode;
              window.SITE_CONFIG.contact.instagramUrl = payload.siteSettings.instagramUrl || window.SITE_CONFIG.contact.instagramUrl;
              window.SITE_CONFIG.contact.facebookUrl = payload.siteSettings.facebookUrl || window.SITE_CONFIG.contact.facebookUrl;
              if (payload.siteSettings.serviceMessagesAr) {
                window.SITE_CONFIG.contact.serviceMessages.ar = payload.siteSettings.serviceMessagesAr;
              }
              if (payload.siteSettings.serviceMessagesEn) {
                window.SITE_CONFIG.contact.serviceMessages.en = payload.siteSettings.serviceMessagesEn;
              }
            }

            // Apply Page Metadata
            if (payload.pageMetadata) {
              var isAr = getCurrentLang() === 'ar';
              document.title = (isAr ? payload.pageMetadata.titleAr : payload.pageMetadata.titleEn) || document.title;
            }

            // Render Sections
            if (Array.isArray(payload.sections)) {
              renderSections(payload.sections);
            }
          }
          break;

        case 'MG_PREVIEW_UPDATE_SECTION':
          if (data.payload && data.payload.section) {
            var sec = data.payload.section;
            var el = document.querySelector('[data-section-id="' + sec.id + '"]');
            var renderer = SectionRenderers[sec.type];
            if (el && typeof renderer === 'function') {
              var tempDiv = document.createElement('div');
              tempDiv.innerHTML = renderer(sec, getCurrentLang());
              var newEl = tempDiv.firstElementChild;
              if (newEl) {
                el.parentNode.replaceChild(newEl, el);
                reinitializePageInteractions();
              }
            }
          }
          break;

        case 'MG_PREVIEW_HIGHLIGHT_SECTION':
          if (data.payload && data.payload.sectionId) {
            var targetEl = document.querySelector('[data-section-id="' + data.payload.sectionId + '"]');
            document.querySelectorAll('.cms-selected').forEach(function (n) {
              n.classList.remove('cms-selected');
              n.style.outline = 'none';
            });
            if (targetEl) {
              targetEl.classList.add('cms-selected');
              targetEl.style.outline = '3px solid #0284c7';
              targetEl.style.outlineOffset = '-3px';
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          break;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Step 5: Active Published Revision Hydration (Fast PostgREST Fetch)
  // --------------------------------------------------------------------------
  function hydrateActiveRevision() {
    var url = cmsConfig.supabaseUrl;
    var key = cmsConfig.supabaseAnonKey;

    if (!url || !key) {
      // Quietly continue with embedded static HTML
      return;
    }

    var endpoint = url.replace(/\/+$/, '') + '/rest/v1/page_revisions?is_active=eq.true&select=revision_number,snapshot,published_at&limit=1';
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;

    var fetchOptions = {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Accept': 'application/json'
      }
    };
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    fetch(endpoint, fetchOptions)
      .then(function (res) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].snapshot) {
          return;
        }

        var snapshot = rows[0].snapshot;

        // 1. Hydrate Site Settings
        if (snapshot.site_settings && window.SITE_CONFIG) {
          var s = snapshot.site_settings;
          window.SITE_CONFIG.contact.localNumber = s.local_phone || window.SITE_CONFIG.contact.localNumber;
          window.SITE_CONFIG.contact.countryCode = s.country_code || window.SITE_CONFIG.contact.countryCode;
          window.SITE_CONFIG.contact.instagramUrl = s.instagram_url || window.SITE_CONFIG.contact.instagramUrl;
          window.SITE_CONFIG.contact.facebookUrl = s.facebook_url || window.SITE_CONFIG.contact.facebookUrl;
          if (s.service_messages_ar) window.SITE_CONFIG.contact.serviceMessages.ar = s.service_messages_ar;
          if (s.service_messages_en) window.SITE_CONFIG.contact.serviceMessages.en = s.service_messages_en;
        }

        // 2. Hydrate Page Title & Metadata
        if (snapshot.page_metadata) {
          var m = snapshot.page_metadata;
          var isAr = getCurrentLang() === 'ar';
          var title = isAr ? m.title_ar : m.title_en;
          var desc = isAr ? m.meta_description_ar : m.meta_description_en;
          if (title) document.title = title;
          if (desc) {
            var metaDescEl = document.querySelector('meta[name="description"]');
            if (metaDescEl) metaDescEl.setAttribute('content', desc);
          }
        }

        // 3. Hydrate Sections
        if (Array.isArray(snapshot.sections) && snapshot.sections.length > 0) {
          // Normalize section schema from snake_case snapshot if necessary
          var normalized = snapshot.sections.map(function (item) {
            return {
              id: item.id,
              type: item.type,
              label: item.label,
              anchorId: item.anchor_id || item.anchorId,
              isVisible: item.is_visible !== undefined ? item.is_visible : item.isVisible,
              displayOrder: item.display_order !== undefined ? item.display_order : item.displayOrder,
              content: item.content || {},
              settings: item.settings || {}
            };
          });

          renderSections(normalized);
        }
      })
      .catch(function (err) {
        // Safe fallback: static HTML remains in DOM
        if (err.name === 'AbortError') {
          console.info('[MG CMS] Active revision fetch timed out; using static fallback.');
        } else {
          console.info('[MG CMS] Static fallback active (' + err.message + ').');
        }
      });
  }

  // --------------------------------------------------------------------------
  // Step 6: Bootstrap on DOMContentLoaded
  // --------------------------------------------------------------------------
  function bootstrap() {
    if (isPreviewMode) {
      setupPreviewProtocol();
      attachPreviewSelectionHandlers();
    } else {
      hydrateActiveRevision();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Expose API for parent window or debugging
  window.MG_CMS_CLIENT = {
    version: PROTOCOL_VERSION,
    isPreviewMode: isPreviewMode,
    renderSections: renderSections,
    reinitializePageInteractions: reinitializePageInteractions
  };
})();
