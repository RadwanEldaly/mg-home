// ============================================================================
// MG HOME CMS — Single Admin Login Modal with Mandatory MFA (v2.3.0)
// File: admin/src/components/auth/LoginModal.tsx
// ============================================================================

import React, { useState } from 'react';
import { useCMS, type MFAEnrollmentData } from '../../context/CMSContext';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, Loader2, QrCode, ArrowLeft, ArrowRight } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login, isAuthenticated, activeLanguage } = useCMS();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'credentials' | 'mfa' | 'enrollment'>('credentials');
  const [enrollmentData, setEnrollmentData] = useState<MFAEnrollmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAr = activeLanguage === 'ar';

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const codeToSubmit = (step === 'mfa' || step === 'enrollment') ? totpCode : undefined;
      const result = await login(email, password, codeToSubmit);

      if (result.success) {
        // Authenticated successfully with AAL2 session
      } else if (result.requiresMFA) {
        setStep('mfa');
      } else if (result.requiresMFAEnrollment && result.enrollment) {
        setEnrollmentData(result.enrollment);
        setStep('enrollment');
      } else {
        setError(result.error || (isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid administrative credentials'));
      }
    } catch (err: any) {
      setError(err.message || (isAr ? 'حدث خطأ أثناء المصادقة' : 'An error occurred during authentication'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setTotpCode('');
    setError(null);
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
            {step === 'credentials' && (isAr ? 'تسجيل دخول الإدارة المحمي بالمصادقة الثنائية (AAL2)' : 'Single Admin Authentication (AAL2 Enforced)')}
            {step === 'mfa' && (isAr ? 'أدخل رمز التحقق الثنائي (TOTP)' : 'Enter 6-Digit Verification Code')}
            {step === 'enrollment' && (isAr ? 'إعداد المصادقة الثنائية لأول مرة' : 'Setup Two-Factor Authentication')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'credentials' && (
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
          )}

          {step === 'mfa' && (
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

          {step === 'enrollment' && enrollmentData && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <p className="text-xs text-slate-300 mb-2 font-medium">
                  {isAr ? 'امسح رمز الاستجابة السريعة (QR) عبر تطبيق المصادقة:' : 'Scan this QR code with Google Authenticator:'}
                </p>
                {enrollmentData.qrCode ? (
                  <img 
                    src={enrollmentData.qrCode} 
                    alt="MFA QR Code" 
                    className="w-40 h-40 mx-auto rounded-lg bg-white p-2"
                  />
                ) : (
                  <div className="w-40 h-40 mx-auto bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                    <QrCode className="w-8 h-8" />
                  </div>
                )}
                {enrollmentData.secret && (
                  <div className="mt-2 text-[11px] font-mono text-slate-400 break-all select-all">
                    {isAr ? 'أو أدخل المفتاح يدويًا: ' : 'Manual Key: '}
                    <span className="text-sky-400 font-bold">{enrollmentData.secret}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isAr ? 'أدخل الرمز الناتج من التطبيق للتأكيد:' : 'Enter code from authenticator to confirm:'}
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
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>
              {step === 'credentials' && (isAr ? 'متابعة التحقق' : 'Continue to Studio')}
              {step === 'mfa' && (isAr ? 'تأكيد الرمز والدخول (AAL2)' : 'Verify Token & Enter')}
              {step === 'enrollment' && (isAr ? 'تفعيل المصادقة والدخول' : 'Activate MFA & Enter')}
            </span>
          </button>

          {step !== 'credentials' && (
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="w-full py-1.5 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{isAr ? 'العودة لبيانات الدخول' : 'Back to login'}</span>
            </button>
          )}
        </form>

        <p className="text-[10px] text-slate-500 text-center mt-4">
          MG HOME Production Security Architecture — v2.3.0
        </p>
      </div>
    </div>
  );
};
