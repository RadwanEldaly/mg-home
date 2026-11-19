// ============================================================================
// MG HOME CMS — Admin Header Toolbar (v2.3.0)
// File: admin/src/components/layout/AdminHeader.tsx
// ============================================================================

import React from 'react';
import { useCMS } from '../../context/CMSContext';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  RotateCcw, 
  RotateCw, 
  Save, 
  UploadCloud, 
  History, 
  Settings, 
  LogOut, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AdminHeaderProps {
  onOpenPublishModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenSettingsModal: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onOpenPublishModal,
  onOpenHistoryModal,
  onOpenSettingsModal
}) => {
  const {
    activeLanguage,
    setActiveLanguage,
    viewportMode,
    setViewportMode,
    saveStatus,
    canUndo,
    canRedo,
    undo,
    redo,
    saveDraft,
    isPublishing,
    logout
  } = useCMS();

  const isAr = activeLanguage === 'ar';

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30 sticky top-0">
      {/* Brand & Page Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center font-black text-sky-400">
            MG
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
              MG HOME <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700 font-mono">v2.3 CMS</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'إدارة الصفحة الرئيسية (Home Landing Page)' : 'Single Page Builder (Home)'}
            </p>
          </div>
        </div>
      </div>

      {/* Center Toolbar: Viewports, Undo/Redo & Save Status */}
      <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
        {/* Device Viewports */}
        <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-1 rtl:border-r-0 rtl:border-l rtl:pr-0 rtl:mr-0 rtl:pl-2 rtl:ml-1">
          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            title={isAr ? 'شاشة حاسوب (Desktop)' : 'Desktop View'}
            className={`p-2 rounded-lg transition-all ${
              viewportMode === 'desktop' 
                ? 'bg-sky-500 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('tablet')}
            title={isAr ? 'جهاز لوحي (Tablet 768px)' : 'Tablet View'}
            className={`p-2 rounded-lg transition-all ${
              viewportMode === 'tablet' 
                ? 'bg-sky-500 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            title={isAr ? 'هاتف ذكي (Mobile 375px)' : 'Mobile View'}
            className={`p-2 rounded-lg transition-all ${
              viewportMode === 'mobile' 
                ? 'bg-sky-500 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-1 rtl:border-r-0 rtl:border-l rtl:pr-0 rtl:mr-0 rtl:pl-2 rtl:ml-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title={isAr ? 'تراجع (Ctrl+Z)' : 'Undo'}
            className={`p-2 rounded-lg transition-all ${
              canUndo ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title={isAr ? 'إعادة (Ctrl+Y)' : 'Redo'}
            className={`p-2 rounded-lg transition-all ${
              canRedo ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Language Preview Switcher */}
        <button
          type="button"
          onClick={() => setActiveLanguage(isAr ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>{isAr ? 'English' : 'العربية'}</span>
        </button>

        {/* Save Status Badge */}
        <div className="px-2.5 py-1 flex items-center gap-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-400">{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">{isAr ? 'المسودة محفوظة' : 'Draft Saved'}</span>
            </>
          )}
          {saveStatus === 'modified' && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-sky-300">{isAr ? 'تعديلات مسودة' : 'Unpublished'}</span>
            </>
          )}
        </div>
      </div>

      {/* Right Actions: Settings, History & Publish */}
      <div className="flex items-center gap-2">
        {/* Site Settings */}
        <button
          type="button"
          onClick={onOpenSettingsModal}
          title={isAr ? 'إعدادات الموقع العام' : 'Site Settings'}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Revision History */}
        <button
          type="button"
          onClick={onOpenHistoryModal}
          title={isAr ? 'سجل المراجعات والاسترجاع' : 'Revision History'}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Save Draft Button */}
        <button
          type="button"
          onClick={saveDraft}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <Save className="w-3.5 h-3.5 text-slate-400" />
          <span>{isAr ? 'حفظ مسودة' : 'Save Draft'}</span>
        </button>

        {/* Publish Live Button */}
        <button
          type="button"
          onClick={onOpenPublishModal}
          disabled={isPublishing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          <span>{isAr ? 'نشر مباشر' : 'Publish Live'}</span>
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title={isAr ? 'تسجيل الخروج' : 'Logout'}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors border border-transparent"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
