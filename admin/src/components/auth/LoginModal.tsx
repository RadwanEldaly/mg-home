// ============================================================================
// MG HOME CMS — Single Admin Login Modal with Mandatory MFA (v2.3.0)
// File: admin/src/components/auth/LoginModal.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS } from '../../context/CMSContext';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, Loader2 } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login, isAuthenticated, activeLanguage } = useCMS();
  const [email, setEmail] = useState('admin@mg-home.online');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAr = activeLanguage === 'ar';

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password, step === 'mfa' ? totpCode : undefined);
      if (result.success) {
        // Logged in successfully
      } else if (result.requiresMFA) {
        setStep('mfa');
      } else {
        setError(result.error || (isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
      }
    } catch {
      setError(isAr ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto mb-3 text-sky-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {isAr ? 'بوابة إدارة MG HOME CMS' : 'MG HOME CMS Portal'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'تسجيل دخول الإدارة المحمي بالمصادقة الثنائية (AAL2)' : 'Single Admin Authentication (AAL2 Enforced)'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'credentials' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isAr ? 'البريد الإلكتروني المعتمد للإدارة:' : 'Admin Email:'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                    placeholder="admin@mg-home.online"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isAr ? 'كلمة المرور:' : 'Password:'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isAr ? 'رمز المصادقة الثنائية (TOTP 6-Digits):' : 'Enter 6-digit TOTP code:'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2.5 text-center font-mono tracking-widest text-lg text-sky-400 focus:outline-hidden focus:border-sky-500"
                  placeholder="123456"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                {isAr ? 'افتح تطبيق Google Authenticator أو 1Password وأدخل الرمز الظاهر.' : 'Check your authenticator app for the 6-digit token.'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>
              {step === 'credentials' 
                ? (isAr ? 'متابعة التحقق' : 'Continue to Studio') 
                : (isAr ? 'تأكيد الرمز والدخول (AAL2)' : 'Verify Token & Enter')}
            </span>
          </button>
        </form>

        <p className="text-[10px] text-slate-500 text-center mt-4">
          MG HOME Production Security Architecture — v2.3.0
        </p>
      </div>
    </div>
  );
};
