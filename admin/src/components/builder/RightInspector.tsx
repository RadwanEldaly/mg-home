// ============================================================================
// MG HOME CMS — Right Inspector: Section Properties & Content (v2.3.0)
// File: admin/src/components/builder/RightInspector.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { Sliders, FileText, Paintbrush, Hash, Eye, EyeOff } from 'lucide-react';

export const RightInspector: React.FC = () => {
  const {
    sections,
    selectedSectionId,
    updateSection,
    activeLanguage
  } = useCMS();

  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');
  const [formLocale, setFormLocale] = useState<'ar' | 'en'>('ar');

  const selectedSection = sections.find(s => s.id === selectedSectionId);
  const isAr = activeLanguage === 'ar';

  if (!selectedSection) {
    return (
      <aside className="w-96 bg-slate-900 border-l border-slate-800 rtl:border-l-0 rtl:border-r p-6 flex flex-col items-center justify-center text-center text-slate-500 h-[calc(100vh-4rem)] select-none">
        <Sliders className="w-8 h-8 mb-2 text-slate-600" />
        <p className="text-xs font-semibold">
          {isAr ? 'حدد قسمًا من الشاشة للبدء في تحريره' : 'Select a section from the canvas to edit'}
        </p>
      </aside>
    );
  }

  const content = selectedSection.content || {};
  const settings = selectedSection.settings || {
    backgroundVariant: 'default',
    paddingTop: 'medium',
    paddingBottom: 'medium'
  };

  const handleContentChange = (field: string, value: any) => {
    updateSection(selectedSection.id, {
      content: {
        ...content,
        [field]: value
      }
    });
  };

  const handleSettingsChange = (field: string, value: any) => {
    updateSection(selectedSection.id, {
      settings: {
        ...settings,
        [field]: value
      }
    });
  };

  return (
    <aside className="w-96 bg-slate-900 border-l border-slate-800 rtl:border-l-0 rtl:border-r flex flex-col h-[calc(100vh-4rem)] z-20 select-none">
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
            {selectedSection.type}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {selectedSection.isVisible ? (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <Eye className="w-3 h-3" /> {isAr ? 'مرئي للعامة' : 'Visible'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                <EyeOff className="w-3 h-3" /> {isAr ? 'مخفي' : 'Hidden'}
              </span>
            )}
          </div>
        </div>

        {/* Section Label Edit */}
        <input
          type="text"
          value={selectedSection.label}
          onChange={(e) => updateSection(selectedSection.id, { label: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-hidden focus:border-sky-500 transition-colors"
          placeholder={isAr ? 'تسمية القسم...' : 'Section label...'}
        />

        {/* Anchor ID */}
        <div className="mt-2 flex items-center gap-1 text-slate-400 text-xs">
          <Hash className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-mono text-slate-400">
            {isAr ? 'معرّف الرابط الداخلي (Anchor):' : 'Anchor ID:'}
          </span>
          <input
            type="text"
            value={selectedSection.anchorId}
            onChange={(e) => updateSection(selectedSection.id, { anchorId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-mono text-sky-300 focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Tabs: Content vs Appearance */}
      <div className="grid grid-cols-2 p-2 border-b border-slate-800 gap-1 bg-slate-950/20">
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'content'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isAr ? 'المحتوى والنصوص' : 'Content'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'style'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          <span>{isAr ? 'المظهر والتصميم' : 'Design & Style'}</span>
        </button>
      </div>

      {/* Inspector Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'content' ? (
          <div>
            {/* Language Selection Bar inside Content Inspector */}
            <div className="flex items-center justify-between mb-3 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 px-2">
                {isAr ? 'لغة التحرير الحالية:' : 'Edit Language:'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFormLocale('ar')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    formLocale === 'ar' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  العربية (RTL)
                </button>
                <button
                  type="button"
                  onClick={() => setFormLocale('en')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    formLocale === 'en' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  English (LTR)
                </button>
              </div>
            </div>

            {/* Dynamic Content Form Fields */}
            <div className="space-y-3.5 text-xs">
              {/* Badge Field */}
              {'badgeAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'الشارة العلوية (Badge):' : 'Section Badge:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.badgeAr || '') : (content.badgeEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'badgeAr' : 'badgeEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Title Highlight Field */}
              {'titleHighlightAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'عنوان البداية البارز (Highlight):' : 'Title Highlight:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.titleHighlightAr || '') : (content.titleHighlightEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'titleHighlightAr' : 'titleHighlightEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Title / Title Suffix Field */}
              {('titleAr' in content || 'titleSuffixAr' in content) && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'العنوان الرئيسي:' : 'Main Title:'}
                  </label>
                  <input
                    type="text"
                    value={
                      formLocale === 'ar' 
                        ? (content.titleSuffixAr || content.titleAr || '') 
                        : (content.titleSuffixEn || content.titleEn || '')
                    }
                    onChange={(e) => {
                      const key = 'titleSuffixAr' in content 
                        ? (formLocale === 'ar' ? 'titleSuffixAr' : 'titleSuffixEn')
                        : (formLocale === 'ar' ? 'titleAr' : 'titleEn');
                      handleContentChange(key, e.target.value);
                    }}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Subtitle Field */}
              {'subtitleAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'العنوان الفرعي:' : 'Subtitle:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.subtitleAr || '') : (content.subtitleEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'subtitleAr' : 'subtitleEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Description Field */}
              {'descriptionAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'الوصف والنص التفصيلي:' : 'Description Text:'}
                  </label>
                  <textarea
                    rows={4}
                    value={formLocale === 'ar' ? (content.descriptionAr || '') : (content.descriptionEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'descriptionAr' : 'descriptionEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium leading-relaxed"
                  />
                </div>
              )}

              {/* Primary CTA Button Text */}
              {'primaryCtaTextAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'نص زر الإجراء الأول (CTA):' : 'Primary Button Text:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.primaryCtaTextAr || '') : (content.primaryCtaTextEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'primaryCtaTextAr' : 'primaryCtaTextEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Secondary CTA Button Text */}
              {'secondaryCtaTextAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'نص زر الإجراء الثاني:' : 'Secondary Button Text:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.secondaryCtaTextAr || '') : (content.secondaryCtaTextEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'secondaryCtaTextAr' : 'secondaryCtaTextEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* General CTA Button Text */}
              {'buttonTextAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'نص زر الإجراء:' : 'Button Label:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.buttonTextAr || '') : (content.buttonTextEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'buttonTextAr' : 'buttonTextEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}

              {/* Working Hours (Contact) */}
              {'workingHoursAr' in content && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    {isAr ? 'أوقات العمل:' : 'Working Hours:'}
                  </label>
                  <input
                    type="text"
                    value={formLocale === 'ar' ? (content.workingHoursAr || '') : (content.workingHoursEn || '')}
                    onChange={(e) => handleContentChange(formLocale === 'ar' ? 'workingHoursAr' : 'workingHoursEn', e.target.value)}
                    dir={formLocale === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-sky-500 font-medium"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Style & Presentation Tab */
          <div className="space-y-4 text-xs">
            {/* Background Variant */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1.5">
                {isAr ? 'نمط خلفية القسم:' : 'Background Style:'}
              </label>
              <select
                value={settings.backgroundVariant || 'default'}
                onChange={(e) => handleSettingsChange('backgroundVariant', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-hidden focus:border-sky-500"
              >
                <option value="default">{isAr ? 'فاتح أساسي (Default Light)' : 'Default Light'}</option>
                <option value="surface-alt">{isAr ? 'سطح بديل مائل للرمادي (Surface Alt)' : 'Surface Alt'}</option>
                <option value="glass-gradient">{isAr ? 'تدرج زجاجي مائي (Glass Gradient)' : 'Glass Gradient'}</option>
                <option value="dark-brand">{isAr ? 'كحلي داكن فاخر (Dark Brand)' : 'Dark Brand'}</option>
              </select>
            </div>

            {/* Padding Top */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1.5">
                {isAr ? 'الهامش العلوي (Padding Top):' : 'Padding Top:'}
              </label>
              <select
                value={settings.paddingTop || 'medium'}
                onChange={(e) => handleSettingsChange('paddingTop', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-hidden focus:border-sky-500"
              >
                <option value="none">{isAr ? 'بدون هامش (0px)' : 'None (0px)'}</option>
                <option value="small">{isAr ? 'صغير (40px)' : 'Small (40px)'}</option>
                <option value="medium">{isAr ? 'متوسط قياسي (80px)' : 'Medium (80px)'}</option>
                <option value="large">{isAr ? 'واسع فسيح (120px)' : 'Large (120px)'}</option>
              </select>
            </div>

            {/* Padding Bottom */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1.5">
                {isAr ? 'الهامش السفلي (Padding Bottom):' : 'Padding Bottom:'}
              </label>
              <select
                value={settings.paddingBottom || 'medium'}
                onChange={(e) => handleSettingsChange('paddingBottom', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-hidden focus:border-sky-500"
              >
                <option value="none">{isAr ? 'بدون هامش (0px)' : 'None (0px)'}</option>
                <option value="small">{isAr ? 'صغير (40px)' : 'Small (40px)'}</option>
                <option value="medium">{isAr ? 'متوسط قياسي (80px)' : 'Medium (80px)'}</option>
                <option value="large">{isAr ? 'واسع فسيح (120px)' : 'Large (120px)'}</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
