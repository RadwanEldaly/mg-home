// ============================================================================
// MG HOME CMS — Center Canvas: Sandboxed Preview (v2.3.0)
// File: admin/src/components/builder/CenterCanvas.tsx
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { Layout, Globe } from 'lucide-react';

export const CenterCanvas: React.FC = () => {
  const { 
    sections, 
    viewportMode, 
    activeLanguage, 
    selectedSectionId, 
    selectSection,
    siteSettings,
    pageMetadata
  } = useCMS();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewType, setViewType] = useState<'canvas' | 'live-site'>('canvas');
  const isAr = activeLanguage === 'ar';

  // Responsive width class based on active viewport mode
  const getContainerWidth = () => {
    switch (viewportMode) {
      case 'mobile': return 'w-[375px] h-[780px] shadow-2xl rounded-[36px] border-[8px] border-slate-800';
      case 'tablet': return 'w-[768px] h-[900px] shadow-2xl rounded-[28px] border-[10px] border-slate-800';
      case 'desktop': return 'w-full h-full rounded-lg border border-slate-800';
    }
  };

  // Synchronize draft state with the preview iframe via postMessage
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;

    const payload = {
      protocol: 'MG_HOME_CMS_PREVIEW',
      version: '2.3.0',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'MG_PREVIEW_INIT',
      payload: {
        version: '2.3.0',
        siteSettings,
        pageMetadata,
        sections: sections.filter(s => s.isVisible)
      }
    };

    try {
      iframeRef.current.contentWindow.postMessage(
        payload,
        '*' // Uses wildcard in dev canvas container, constrained by strict listener inside iframe
      );
    } catch (e) {
      console.warn('[CenterCanvas] postMessage sync notice:', e);
    }
  }, [sections, siteSettings, pageMetadata, activeLanguage, viewType]);

  // Handle bidirectional handshake and selection messages from the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // 1. Source verification: Accept ONLY messages originating from our active iframe
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) {
        return;
      }

      // 2. Protocol and version schema validation
      if (!e.data || e.data.protocol !== 'MG_HOME_CMS_PREVIEW' || e.data.version !== '2.3.0') {
        return;
      }

      // 3. Handle Handshake
      if (e.data.type === 'MG_PREVIEW_HANDSHAKE_READY') {
        if (iframeRef.current?.contentWindow) {
          // Send ACK
          iframeRef.current.contentWindow.postMessage({
            protocol: 'MG_HOME_CMS_PREVIEW',
            version: '2.3.0',
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'MG_PREVIEW_HANDSHAKE_ACK',
            payload: { status: 'connected' }
          }, '*');

          // Send Initial Snapshot
          iframeRef.current.contentWindow.postMessage({
            protocol: 'MG_HOME_CMS_PREVIEW',
            version: '2.3.0',
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'MG_PREVIEW_INIT',
            payload: {
              version: '2.3.0',
              siteSettings,
              pageMetadata,
              sections: sections.filter(s => s.isVisible)
            }
          }, '*');
        }
      } else if (e.data.type === 'MG_PREVIEW_SECTION_SELECTED') {
        if (typeof e.data.payload?.sectionId === 'string') {
          selectSection(e.data.payload.sectionId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sections, siteSettings, pageMetadata, selectSection]);

  return (
    <main className="flex-1 bg-slate-950 flex flex-col items-center justify-start overflow-hidden relative p-4 select-none">
      {/* View Switcher Controls */}
      <div className="mb-3 flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 z-10 shrink-0">
        <button
          type="button"
          onClick={() => setViewType('canvas')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
            viewType === 'canvas'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>{isAr ? 'محرر التصميم' : 'Design Canvas'}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewType('live-site')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
            viewType === 'live-site'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isAr ? 'معاينة الموقع الحية (Iframe)' : 'Live Site Preview'}</span>
        </button>
      </div>

      {/* Viewport Canvas Wrapper */}
      <div className={`transition-all duration-300 relative bg-slate-900 flex flex-col overflow-hidden ${getContainerWidth()}`}>
        {/* Device Top Bar for mobile/tablet simulation */}
        {viewportMode !== 'desktop' && (
          <div className="h-6 bg-slate-800 flex items-center justify-center shrink-0">
            <div className="w-16 h-3 bg-slate-900 rounded-full" />
          </div>
        )}

        {viewType === 'live-site' ? (
          /* Live Iframe Sandbox Preview */
          <iframe
            ref={iframeRef}
            src="/index.html?preview_mode=true"
            title="MG HOME Public Site Preview"
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          /* Live Preview Container (Simulated Sandboxed Web View) */
          <div 
            className="flex-1 w-full h-full overflow-y-auto bg-slate-50 text-slate-900"
            dir={isAr ? 'rtl' : 'ltr'}
            style={{ fontFamily: isAr ? 'Tajawal, sans-serif' : 'Plus Jakarta Sans, sans-serif' }}
          >
            {/* Header Preview */}
            <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sky-700 text-sm">MG HOME</span>
                <span className="text-[10px] text-slate-500">
                  {isAr ? siteSettings.businessNameAr : siteSettings.businessNameEn}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full font-bold text-[10px]">
                  {siteSettings.localPhone}
                </span>
              </div>
            </div>

            {/* Sections List Preview */}
            <div className="divide-y divide-slate-100">
              {sections.filter(s => s.isVisible).map(section => {
                const isSelected = selectedSectionId === section.id;

                return (
                  <div
                    key={section.id}
                    onClick={() => selectSection(section.id)}
                    className={`relative p-6 transition-all cursor-pointer ${
                      isSelected 
                        ? 'ring-2 ring-sky-500 bg-sky-50/30' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Selected Indicator Tag */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 rtl:left-auto rtl:right-2 z-10 px-2 py-0.5 rounded bg-sky-500 text-white font-mono text-[10px] font-bold shadow-sm">
                        {section.label} (#{section.anchorId})
                      </div>
                    )}

                    {/* Render Simulated Section View based on type */}
                    <SectionPreviewRenderer 
                      section={section} 
                      isAr={isAr} 
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer Preview */}
            <div className="bg-slate-900 text-slate-300 p-6 text-center text-xs">
              <p className="font-bold text-white mb-1">MG HOME</p>
              <p className="text-slate-400 text-[11px] mb-3">
                {isAr ? 'لجميع خدمات التكييف والصيانة المعتمدة بالمملكة' : 'Certified AC & Home Appliance Maintenance Services'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                © 2026 MG HOME — {siteSettings.localPhone}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

// ----------------------------------------------------------------------------
// In-Memory Section View Renderer for Canvas Preview
// ----------------------------------------------------------------------------
const SectionPreviewRenderer: React.FC<{ section: any; isAr: boolean }> = ({ section, isAr }) => {
  const c = section.content || {};

  switch (section.type) {
    case 'hero':
      return (
        <div className="py-6 text-center">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold mb-3">
            {isAr ? c.badgeAr : c.badgeEn}
          </span>
          <h2 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
            <span className="text-sky-600">{isAr ? c.titleHighlightAr : c.titleHighlightEn}</span>{' '}
            {isAr ? c.titleSuffixAr : c.titleSuffixEn}
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto mb-4 leading-relaxed">
            {isAr ? c.descriptionAr : c.descriptionEn}
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm">
              {isAr ? c.primaryCtaTextAr : c.primaryCtaTextEn}
            </span>
            <span className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold">
              {isAr ? c.secondaryCtaTextAr : c.secondaryCtaTextEn}
            </span>
          </div>
        </div>
      );

    case 'services':
      return (
        <div className="py-4">
          <div className="text-center mb-4">
            <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
              {isAr ? c.badgeAr : c.badgeEn}
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              {isAr ? c.titleAr : c.titleEn}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(c.items || []).slice(0, 4).map((item: any, i: number) => (
              <div key={item.id || i} className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 mb-1">{isAr ? item.titleAr : item.titleEn}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2">{isAr ? item.descriptionAr : item.descriptionEn}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'copper':
      return (
        <div className="py-4">
          <div className="text-center mb-4">
            <span className="text-xs font-bold text-orange-600">{isAr ? c.badgeAr : c.badgeEn}</span>
            <h3 className="text-lg font-bold text-slate-900">{isAr ? c.titleAr : c.titleEn}</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(c.types || []).map((t: any, i: number) => (
              <div key={t.id || i} className="p-2.5 bg-orange-50/50 rounded-lg border border-orange-100">
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-600 text-white rounded">
                  {isAr ? t.tagAr : t.tagEn}
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">{isAr ? t.titleAr : t.titleEn}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="py-4">
          <div className="text-center mb-3">
            <span className="text-xs font-bold text-emerald-600">{isAr ? c.badgeAr : c.badgeEn}</span>
            <h3 className="text-lg font-bold text-slate-900">{isAr ? c.titleAr : c.titleEn}</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(c.items || []).slice(0, 3).map((item: any, i: number) => (
              <div key={item.id || i} className="aspect-square bg-slate-200 rounded-lg overflow-hidden relative">
                {item.image && (
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute bottom-1 right-1 rtl:right-auto rtl:left-1 text-[9px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded">
                  {isAr ? item.categoryAr : item.categoryEn}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'contact':
      return (
        <div className="py-4 text-center">
          <span className="text-xs font-bold text-blue-600">{isAr ? c.badgeAr : c.badgeEn}</span>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{isAr ? c.titleAr : c.titleEn}</h3>
          <p className="text-xs text-slate-500 mb-3">{isAr ? c.descriptionAr : c.descriptionEn}</p>
          <div className="p-4 bg-slate-100 rounded-xl max-w-sm mx-auto text-xs text-slate-600">
            <p className="font-semibold">{isAr ? c.formTitleAr : c.formTitleEn}</p>
            <p className="text-[11px] text-slate-400 mt-1">{isAr ? c.workingHoursAr : c.workingHoursEn}</p>
          </div>
        </div>
      );

    case 'cta-banner':
      return (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 text-white text-center">
          <h3 className="text-lg font-bold mb-1">{isAr ? c.titleAr : c.titleEn}</h3>
          <p className="text-xs text-sky-100 mb-3">{isAr ? c.subtitleAr : c.subtitleEn}</p>
          <span className="px-4 py-1.5 bg-white text-sky-800 rounded-lg text-xs font-bold inline-block shadow-sm">
            {isAr ? c.buttonTextAr : c.buttonTextEn}
          </span>
        </div>
      );

    case 'faq':
      return (
        <div className="py-4">
          <h3 className="text-lg font-bold text-slate-900 text-center mb-3">{isAr ? c.titleAr : c.titleEn}</h3>
          <div className="space-y-2">
            {(c.items || []).slice(0, 2).map((item: any, i: number) => (
              <div key={item.id || i} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <p className="font-bold text-slate-800 mb-1">{isAr ? item.questionAr : item.questionEn}</p>
                <p className="text-slate-500 text-[11px]">{isAr ? item.answerAr : item.answerEn}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'testimonials':
      return (
        <div className="py-4">
          <h3 className="text-lg font-bold text-slate-900 text-center mb-3">{isAr ? c.titleAr : c.titleEn}</h3>
          <div className="grid grid-cols-2 gap-2">
            {(c.items || []).slice(0, 2).map((item: any, i: number) => (
              <div key={item.id || i} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">{isAr ? item.clientNameAr : item.clientNameEn}</p>
                <p className="text-amber-500 text-[10px]">★★★★★</p>
                <p className="text-slate-500 text-[11px] mt-1 line-clamp-2">{isAr ? item.commentAr : item.commentEn}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'text-image':
      return (
        <div className="py-4 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="text-md font-bold text-slate-900 mb-1">{isAr ? c.titleAr : c.titleEn}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{isAr ? c.descriptionAr : c.descriptionEn}</p>
          </div>
          {c.image && (
            <div className="w-24 h-24 rounded-lg bg-slate-200 overflow-hidden shrink-0">
              <img src={c.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="p-4 text-center text-xs text-slate-400">
          {section.label}
        </div>
      );
  }
};
