// ============================================================================
// MG HOME CMS — Revision History & Safe Rollback Modal (v2.3.0)
// File: admin/src/components/modals/RevisionHistoryModal.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { History, RotateCcw, Check, X, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({ isOpen, onClose }) => {
  const { revisions, restoreRevision, activeLanguage } = useCMS();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAr = activeLanguage === 'ar';

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    setStatusMessage(null);
    const res = await restoreRevision(id);
    setRestoringId(null);
    if (res.success) {
      setStatusMessage(isAr ? 'تمت استعادة النسخة لمسودة العمل بنجاح. راجع التعديلات بالمعاينة ثم اضغط نشر.' : 'Restored to working draft successfully. Review in preview before publishing.');
    } else {
      setStatusMessage(res.error || (isAr ? 'فشلت عملية الاسترجاع' : 'Restoration failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isAr ? 'سجل المراجعات السابقة (Revision History)' : 'Revision History & Rollback'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'عرض كافة النسخ المنشورة وإمكانية استرجاع أي لقطة تاريخية للمسودة.' : 'View published snapshots and restore any version back to draft.'}
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

        {statusMessage && (
          <div className="my-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* List of Revisions */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {revisions.map((rev) => (
            <div
              key={rev.id}
              className={`p-4 rounded-xl border transition-all ${
                rev.isActive 
                  ? 'bg-slate-800/80 border-emerald-500/60 shadow-sm shadow-emerald-500/5' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-white">
                    #{rev.revisionNumber}
                  </span>
                  {rev.isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Check className="w-3 h-3" /> {isAr ? 'النسخة المعروضة حاليًا للجمهور (Active)' : 'Currently Live'}
                    </span>
                  )}
                </div>

                {!rev.isActive && (
                  <button
                    type="button"
                    onClick={() => handleRestore(rev.id)}
                    disabled={restoringId === rev.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors border border-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isAr ? 'استعادة للمسودة' : 'Restore to Draft'}</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{rev.notes || (isAr ? 'بدون ملاحظات' : 'No notes')}</span>
              </p>

              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {new Date(rev.publishedAt).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {rev.publishedBy}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
