// ============================================================================
// MG HOME CMS — Atomic Publish Confirmation Modal (v2.3.0)
// File: admin/src/components/modals/PublishModal.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { UploadCloud, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({ isOpen, onClose }) => {
  const { 
    sections, 
    publishRevision, 
    isPublishing, 
    activeLanguage 
  } = useCMS();

  const [notes, setNotes] = useState('');
  const [successResult, setSuccessResult] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAr = activeLanguage === 'ar';

  if (!isOpen) return null;

  const visibleCount = sections.filter(s => s.isVisible).length;
  const hiddenCount = sections.filter(s => !s.isVisible).length;

  const handlePublish = async () => {
    setErrorMessage(null);
    const res = await publishRevision(notes.trim() || undefined);
    if (res.success && res.revisionNumber) {
      setSuccessResult(res.revisionNumber);
    } else {
      setErrorMessage(res.error || (isAr ? 'فشلت عملية النشر' : 'Publishing failed'));
    }
  };

  const handleClose = () => {
    setSuccessResult(null);
    setErrorMessage(null);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 left-4 rtl:left-auto rtl:right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        {successResult ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {isAr ? 'تم النشر بنجاح على الدومين المباشر!' : 'Published Live Successfully!'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {isAr ? `تم حفظ المراجعة رقم #${successResult} وتحديث الموقع المباشر في أقل من 20 مللي ثانية.` : `Revision #${successResult} is now live with zero-downtime atomic propagation.`}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
            >
              {isAr ? 'إغلاق والعودة للمحرر' : 'Close & Return'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isAr ? 'تأكيد نشر التعديلات للجمهور' : 'Confirm Live Publishing'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? 'سيتم تجميد مسودة العمل الحالية ونشرها كنسخة معتمدة ومؤرخة.' : 'Create an immutable revision snapshot and deploy live.'}
                </p>
              </div>
            </div>

            {/* Snapshot Summary Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span>{isAr ? 'إجمالي الأقسام المتضمنة باللقطة:' : 'Total Sections Captured:'}</span>
                <span className="font-bold text-white font-mono">{sections.length}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400">
                <span>{isAr ? 'الأقسام المرئية للجمهور:' : 'Visible to Public:'}</span>
                <span className="font-bold font-mono">{visibleCount}</span>
              </div>
              {hiddenCount > 0 && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>{isAr ? 'أقسام محفوظة بالمسودة (مخفية):' : 'Hidden in Draft:'}</span>
                  <span className="font-bold font-mono">{hiddenCount}</span>
                </div>
              )}
            </div>

            {/* Release Note */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isAr ? 'ملاحظة توثيقية عن هذا التحديث (اختياري):' : 'Release Note (Optional):'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'مثال: تحديث عروض النحاس وإضافة الأسئلة الشائعة...' : 'e.g., Updated copper pricing and added FAQ...'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
              />
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || visibleCount === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 flex items-center gap-2 transition-all hover:scale-[1.01]"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{isAr ? 'نشر فوري الآن' : 'Publish Live Now'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
