// ============================================================================
// MG HOME CMS — Global Site Settings Modal (v2.3.0)
// File: admin/src/components/modals/SiteSettingsModal.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { Settings, X, Phone, Check, Save } from 'lucide-react';

interface SiteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SiteSettingsModal: React.FC<SiteSettingsModalProps> = ({ isOpen, onClose }) => {
  const { siteSettings, updateSiteSettings, activeLanguage } = useCMS();
  const isAr = activeLanguage === 'ar';

  const [formData, setFormData] = useState({ ...siteSettings });
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(formData);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إعدادات الموقع العام والتواصل' : 'Global Site Settings'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'تعديل أرقام الهواتف، روابط المنصات، وبادئات رسائل واتساب.' : 'Configure business numbers, social URLs, and WhatsApp presets.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Business Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {isAr ? 'اسم المنشأة بالعربية:' : 'Business Name (AR):'}
              </label>
              <input
                type="text"
                value={formData.businessNameAr}
                onChange={(e) => setFormData({ ...formData, businessNameAr: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {isAr ? 'اسم المنشأة بالإنجليزية:' : 'Business Name (EN):'}
              </label>
              <input
                type="text"
                value={formData.businessNameEn}
                onChange={(e) => setFormData({ ...formData, businessNameEn: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          {/* Contact Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {isAr ? 'رقم الهاتف المحلي (واتساب واتصال):' : 'Local Phone Number:'}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute top-2.5 left-3 rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  value={formData.localPhone}
                  onChange={(e) => setFormData({ ...formData, localPhone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2 text-white font-mono focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {isAr ? 'مفتاح الدولة الدولي (Saudi Arabia: 966):' : 'Country Dial Code:'}
              </label>
              <input
                type="text"
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          {/* Social Channels */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              {isAr ? 'رابط حساب انستغرام:' : 'Instagram Profile URL:'}
            </label>
            <input
              type="url"
              value={formData.instagramUrl}
              onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              {isAr ? 'رابط صفحة فيسبوك:' : 'Facebook Page URL:'}
            </label>
            <input
              type="url"
              value={formData.facebookUrl}
              onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-sky-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {savedNotice ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> {isAr ? 'تم حفظ الإعدادات بالمسودة' : 'Saved to draft'}
              </span>
            ) : <span />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-sky-500/20"
              >
                <Save className="w-4 h-4" />
                <span>{isAr ? 'حفظ الإعدادات' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
