'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { api, safeNext } from '@/lib/client/session';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import {
  consumeAuthNext,
  getSupabase,
  hydrateSessionFromUrl,
  saveAuthNext,
  syncSignedInHint,
} from '@/lib/client/supabase';
import { LanguageSwitch } from './language-switch';
import { SignalRings } from './obsidian-viz';
import { ThemeToggle } from './theme-toggle';
import { Icon, LogoMark } from './ui';

type AuthStep = 'signin' | 'signup' | 'forgot' | 'verify';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function RetroAuth({
  initialMode,
  lang = 'en',
}: {
  initialMode: 'signin' | 'signup';
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const id = useId();

  const [step, setStep] = useState<AuthStep>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordWeak = step === 'signup' && password.length > 0 && password.length < 6;
  const passwordHint =
    step !== 'signup' || !password
      ? ''
      : password.length < 6
        ? isFa
          ? 'حداقل ۶ کاراکتر'
          : 'At least 6 characters'
        : password.length < 10
          ? isFa
            ? 'خوب است — طولانی‌تر امن‌تر است'
            : 'Okay — longer is stronger'
          : isFa
            ? 'رمز عبور قوی'
            : 'Strong';
  const mismatch = step === 'signup' && confirmPassword.length > 0 && password !== confirmPassword;

  const resolveDest = () => {
    const queryDest = safeNext('');
    if (queryDest) return queryDest;
    return consumeAuthNext() || '/dashboard';
  };

  const finishRedirect = (dest = resolveDest()) => {
    syncSignedInHint(true);
    consumeAuthNext();
    window.location.assign(dest);
  };

  useEffect(() => {
    const dest = resolveDest();
    const supabase = getSupabase();
    let active = true;
    let navigated = false;

    const completeFromSession = async (accessToken: string | undefined) => {
      if (!active || !accessToken || navigated) return;
      navigated = true;
      syncSignedInHint(true);
      consumeAuthNext();
      if (dest.startsWith('/chat')) {
        void exchangeSupabaseSession(accessToken);
        window.location.assign(dest);
        return;
      }
      // Best-effort bridge to Postgres cookie when DATABASE_URL is configured; never block opening /dashboard.
      await exchangeSupabaseSession(accessToken).catch(() => false);
      if (!active) return;
      window.location.assign(dest);
    };

    void hydrateSessionFromUrl().then(({ session, error: oauthErr }) => {
      if (!active) return;
      if (oauthErr) {
        setError(oauthErr);
        setGoogleBusy(false);
        return;
      }
      if (session) void completeFromSession(session.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      void completeFromSession(session.access_token);
    });

    const onPageShow = () => setGoogleBusy(false);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const handleGoogle = async () => {
    if (googleBusy || busy) return;
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      const origin = window.location.origin;
      const dest = safeNext('/dashboard');
      saveAuthNext(dest);
      // Clean redirect URL without query params so Supabase redirect allow-list always matches cleanly.
      const redirectTo = dest.startsWith('/chat') ? `${origin}/chat` : `${origin}/dashboard`;
      const { data, error: oauthError } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) throw oauthError;
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : isFa
            ? 'ورود با گوگل ناموفق بود. لطفاً دوباره تلاش کنید.'
            : 'Could not start Google sign-in. Please try again.',
      );
      setGoogleBusy(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(isFa ? 'ایمیل و رمز عبور خود را وارد کنید.' : 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: authError } = await getSupabase().auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (authError) {
        if (authError.message.toLowerCase().includes('email not confirmed')) {
          await getSupabase().auth.resend({ type: 'signup', email: trimmedEmail }).catch(() => undefined);
          setStep('verify');
          setNotice(
            isFa
              ? `ایمیل شما هنوز تأیید نشده است. کد تأیید ۶ رقمی دوباره به ${trimmedEmail} ارسال شد.`
              : `Your email is not confirmed yet. We sent a fresh 6-digit code to ${trimmedEmail}.`,
          );
          setBusy(false);
          return;
        }
        // Fallback for pre-SSO Vigas Postgres accounts when signing into the dashboard/web.
        try {
          await api.login({ email: trimmedEmail, password });
          finishRedirect();
          return;
        } catch {
          throw authError;
        }
      }
      if (data.session?.access_token) {
        await exchangeSupabaseSession(data.session.access_token);
      }
      finishRedirect();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : isFa
            ? 'ورود ناموفق بود. ایمیل یا رمز عبور اشتباه است.'
            : 'Could not sign you in. Check your email and password.',
      );
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password || !confirmPassword) {
      setError(isFa ? 'همه فیلدها را پر کنید.' : 'Fill in every field.');
      return;
    }
    if (emailInvalid || passwordWeak || mismatch) {
      setError(isFa ? 'ابتدا خطاهای فرم را برطرف کنید.' : 'Fix the highlighted fields first.');
      return;
    }
    if (!acceptedTerms) {
      setError(isFa ? 'برای ادامه باید قوانین و حریم خصوصی را بپذیرید.' : 'Accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        await exchangeSupabaseSession(data.session.access_token);
        finishRedirect();
        return;
      }
      setStep('verify');
      setNotice(
        isFa
          ? `کد تأیید ۶ رقمی به ${email.trim()} ارسال شد.`
          : `We sent a 6-digit verification code to ${email.trim()}.`,
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : isFa
            ? 'ساخت حساب کاربری ناموفق بود.'
            : 'Could not create your account.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const token = otpCode.replace(/\s+/g, '');
    if (token.length < 6) {
      setError(isFa ? 'کد ۶ رقمی ارسال‌شده به ایمیل را وارد کنید.' : 'Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: otpError } = await getSupabase().auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'signup',
      });
      if (otpError) throw otpError;
      if (data.session?.access_token) {
        await exchangeSupabaseSession(data.session.access_token);
      }
      finishRedirect();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : isFa
            ? 'کد واردشده نامعتبر یا منقضی شده است.'
            : 'Invalid or expired code. Please try again.',
      );
      setBusy(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || emailInvalid) {
      setError(isFa ? 'ایمیل معتبر وارد کنید.' : 'Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/chat/reset-password`,
      });
      if (resetError) throw resetError;
      setNotice(
        isFa
          ? 'لینک بازیابی رمز عبور به ایمیل شما ارسال شد.'
          : 'Check your inbox — we sent a password reset link.',
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : isFa
            ? 'ارسال ایمیل بازیابی ناموفق بود.'
            : 'Could not send reset email.',
      );
    } finally {
      setBusy(false);
    }
  };

  const switchStep = (next: AuthStep) => {
    setStep(next);
    setError(null);
    setNotice(null);
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontFamily: isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-mono)',
    letterSpacing: isFa ? 0 : '0.02em',
    color: 'var(--vg-ink3)',
    marginBottom: 7,
  } as const;

  const inputStyle = {
    width: '100%',
    height: 46,
    borderRadius: 12,
    padding: '0 14px',
    fontSize: 15,
    background: 'var(--vg-raised)',
    border: '1px solid var(--vg-line2)',
    color: 'var(--vg-ink)',
    outline: 'none',
  } as const;

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      lang={isFa ? 'fa' : 'en'}
      className={`auth-split${isFa ? ' fa-ui' : ''}`}
    >
      {/* Desktop Obsidian Signal 2026 Brand Panel */}
      <aside className="auth-split-brand" aria-hidden="true">
        <div
          className="line-grid"
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: 'radial-gradient(circle at 50% 60%, #000, transparent 72%)',
            maskImage: 'radial-gradient(circle at 50% 60%, #000, transparent 72%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -180,
            insetInlineStart: -80,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,90,31,0.28) 0%, rgba(255,90,31,0) 68%)',
            filter: 'blur(64px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={32} />
          <span className="dsp" dir="ltr" style={{ fontSize: 26, lineHeight: 1 }}>
            vigas
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <SignalRings size={172} />
          <h2 className="dsp" style={{ fontSize: isFa ? 52 : 66, margin: '28px 0 0' }}>
            {isFa ? 'همه مدل‌های' : 'Every frontier'}
            <br />
            <span className="text-signal">{isFa ? 'پیشتاز. یک ورود.' : 'model. One login.'}</span>
          </h2>
          <div style={{ display: 'flex', gap: 36, marginTop: 32 }}>
            {[
              ['25+', isFa ? 'مدل فعال' : 'models'],
              ['0%', isFa ? 'کارمزد' : 'markup'],
              ['112ms', isFa ? 'میانه تأخیر' : 'p50 latency'],
            ].map(([val, lbl]) => (
              <div key={lbl}>
                <div className="mn" dir="ltr" style={{ fontSize: 26, fontWeight: 600 }}>
                  {val}
                </div>
                <div style={{ fontSize: 13, color: 'var(--vg-ink3)', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mn" style={{ position: 'relative', fontSize: 12, color: 'var(--vg-ink3)' }}>
          © 2026 Vigas · vigas.app
        </div>
      </aside>

      {/* Form Column */}
      <div className="auth-split-form dot-grid">
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Minimal top bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              gap: 12,
            }}
          >
            <Link
              href={isFa ? '/fa' : '/'}
              className="mn"
              style={{
                fontSize: 12,
                color: 'var(--vg-ink3)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{isFa ? '→' : '←'}</span>
              <span>vigas.app</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ThemeToggle variant="icon" lang={lang} />
              <LanguageSwitch variant="header" lang={lang} />
            </div>
          </div>

          {/* Brand mark + wordmark header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <LogoMark size={30} />
              <span className="dsp" dir="ltr" style={{ fontSize: 24, lineHeight: 1 }}>
                vigas
              </span>
            </div>

            <h1
              className="dsp"
              style={{
                margin: 0,
                fontSize: isFa ? 28 : 36,
                lineHeight: isFa ? 1.25 : 1.05,
                color: 'var(--vg-ink)',
              }}
            >
              {step === 'signin' && (isFa ? 'خوش برگشتید.' : 'Welcome back.')}
              {step === 'signup' && (isFa ? 'ساخت حساب کاربری.' : 'Create an account.')}
              {step === 'forgot' && (isFa ? 'بازیابی رمز عبور.' : 'Reset password.')}
              {step === 'verify' && (isFa ? 'تأیید ایمیل.' : 'Check your email.')}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--vg-ink2)' }}>
              {step === 'signin' &&
                (isFa
                  ? 'با یک حساب واحد وارد چت AI، کلیدهای API و کیف‌پول ویگاس شوید.'
                  : 'One account for Vigas AI Chat, API keys, credits, and your projects.')}
              {step === 'signup' &&
                (isFa
                  ? 'با یک حساب، هم به چت هوش مصنوعی و اپ‌ساز و هم به گیت‌وی API دسترسی دارید.'
                  : 'Chat with frontier AI, build apps live, and manage your API keys in one place.')}
              {step === 'forgot' &&
                (isFa
                  ? 'ایمیل خود را وارد کنید تا لینک تنظیم رمز عبور جدید برایتان ارسال شود.'
                  : 'Enter your email and we will send you a password reset link.')}
              {step === 'verify' &&
                (isFa
                  ? 'کد ۶ رقمی ارسال‌شده به ایمیل خود را وارد کنید.'
                  : 'Enter the 6-digit verification code we sent to your inbox.')}
            </p>
            {(step === 'signin' || step === 'signup') && (
              <div
                className="mn"
                style={{
                  marginTop: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'var(--vg-green-soft)',
                  border: '1px solid var(--vg-green-edge)',
                  color: 'var(--vg-green)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Icon name="spark" size={13} />
                {isFa ? '۵ دلار اعتبار هدیه هنگام ثبت‌نام' : '$5.00 welcome credit included on signup'}
              </div>
            )}
          </div>

        {/* RetroCode-style segmented pill switcher for Sign in / Create account */}
        {(step === 'signin' || step === 'signup') && (
          <div
            role="tablist"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: 'var(--vg-raised)',
              border: '1px solid var(--vg-line)',
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={step === 'signin'}
              onClick={() => switchStep('signin')}
              style={{
                height: 36,
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: 600,
                background: step === 'signin' ? 'var(--vg-surface)' : 'transparent',
                color: step === 'signin' ? 'var(--vg-ink)' : 'var(--vg-ink3)',
                boxShadow: step === 'signin' ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
                transition: 'all .15s ease',
              }}
            >
              {isFa ? 'ورود' : 'Sign in'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 'signup'}
              onClick={() => switchStep('signup')}
              style={{
                height: 36,
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: 600,
                background: step === 'signup' ? 'var(--vg-surface)' : 'transparent',
                color: step === 'signup' ? 'var(--vg-ink)' : 'var(--vg-ink3)',
                boxShadow: step === 'signup' ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
                transition: 'all .15s ease',
              }}
            >
              {isFa ? 'ثبت‌نام' : 'Create account'}
            </button>
          </div>
        )}

        {/* Main clean auth card */}
        <div
          className="card"
          style={{
            borderRadius: 20,
            padding: '24px',
            border: '1px solid var(--vg-line2)',
            background: 'var(--vg-surface)',
          }}
        >
          {notice && (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: '11px 14px',
                borderRadius: 12,
                fontSize: 13.5,
                background: 'var(--vg-green-soft)',
                border: '1px solid var(--vg-green-edge)',
                color: 'var(--vg-green)',
              }}
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: '11px 14px',
                borderRadius: 12,
                fontSize: 13.5,
                background: 'var(--vg-red-soft)',
                border: '1px solid var(--vg-red-edge)',
                color: 'var(--vg-err-ink)',
              }}
            >
              {error}
            </div>
          )}

          {step === 'signin' && (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor={`${id}-email`} style={labelStyle}>
                  {isFa ? 'ایمیل' : 'email'}
                </label>
                <input
                  id={`${id}-email`}
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <label htmlFor={`${id}-pw`} style={{ ...labelStyle, marginBottom: 0 }}>
                    {isFa ? 'رمز عبور' : 'password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchStep('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-mono)',
                      color: 'var(--vg-orange-text)',
                    }}
                  >
                    {isFa ? 'فراموشی رمز؟' : 'forgot?'}
                  </button>
                </div>
                <input
                  id={`${id}-pw`}
                  type="password"
                  dir="ltr"
                  required
                  autoComplete="current-password"
                  placeholder={isFa ? 'رمز عبور شما' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                style={{
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  cursor: busy ? 'wait' : 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  background: 'var(--vg-orange)',
                  color: '#FFFFFF',
                  opacity: busy ? 0.72 : 1,
                  boxShadow: '0 2px 0 var(--vg-orange-edge)',
                }}
              >
                {busy ? (isFa ? 'در حال ورود…' : 'Signing in…') : isFa ? 'ورود به حساب' : 'Sign in'}
              </button>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div>
                <label htmlFor={`${id}-s-email`} style={labelStyle}>
                  {isFa ? 'ایمیل' : 'email'}
                </label>
                <input
                  id={`${id}-s-email`}
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: emailInvalid ? 'var(--vg-red)' : 'var(--vg-line2)',
                  }}
                />
                {emailInvalid && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--vg-err-ink)' }}>
                    {isFa ? 'فرمت ایمیل صحیح نیست.' : 'That does not look like an email address.'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`${id}-s-pw`} style={labelStyle}>
                  {isFa ? 'رمز عبور' : 'password'}
                </label>
                <input
                  id={`${id}-s-pw`}
                  type="password"
                  dir="ltr"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={isFa ? 'حداقل ۶ کاراکتر' : 'At least 6 characters'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: passwordWeak ? 'var(--vg-red)' : 'var(--vg-line2)',
                  }}
                />
                {passwordHint && (
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 12,
                      color: passwordWeak ? 'var(--vg-err-ink)' : 'var(--vg-ink3)',
                    }}
                  >
                    {passwordHint}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`${id}-s-pw2`} style={labelStyle}>
                  {isFa ? 'تکرار رمز عبور' : 'confirm password'}
                </label>
                <input
                  id={`${id}-s-pw2`}
                  type="password"
                  dir="ltr"
                  required
                  autoComplete="new-password"
                  placeholder={isFa ? 'دوباره وارد کنید' : 'Once more'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: mismatch ? 'var(--vg-red)' : 'var(--vg-line2)',
                  }}
                />
                {mismatch && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--vg-err-ink)' }}>
                    {isFa ? 'رمزهای عبور یکسان نیستند.' : 'Passwords do not match.'}
                  </p>
                )}
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--vg-ink2)',
                  userSelect: 'none',
                  padding: '4px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--vg-orange)', flexShrink: 0 }}
                />
                <span>
                  {isFa ? (
                    <>
                      <Link href="/terms" style={{ color: 'var(--vg-ink)', textDecoration: 'underline' }}>
                        قوانین استفاده
                      </Link>{' '}
                      و{' '}
                      <Link href="/privacy" style={{ color: 'var(--vg-ink)', textDecoration: 'underline' }}>
                        حریم خصوصی
                      </Link>{' '}
                      را می‌پذیرم.
                    </>
                  ) : (
                    <>
                      I accept the{' '}
                      <Link href="/terms" style={{ color: 'var(--vg-ink)', textDecoration: 'underline' }}>
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" style={{ color: 'var(--vg-ink)', textDecoration: 'underline' }}>
                        Privacy Policy
                      </Link>
                    </>
                  )}
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                style={{
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  cursor: busy ? 'wait' : 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  background: 'var(--vg-orange)',
                  color: '#FFFFFF',
                  opacity: busy ? 0.72 : 1,
                  boxShadow: '0 2px 0 var(--vg-orange-edge)',
                }}
              >
                {busy ? (isFa ? 'در حال ساخت حساب…' : 'Creating account…') : isFa ? 'ساخت حساب کاربری' : 'Create account'}
              </button>
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor={`${id}-f-email`} style={labelStyle}>
                  {isFa ? 'ایمیل' : 'email'}
                </label>
                <input
                  id={`${id}-f-email`}
                  type="email"
                  dir="ltr"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                style={{
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  cursor: busy ? 'wait' : 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  background: 'var(--vg-orange)',
                  color: '#FFFFFF',
                }}
              >
                {busy ? (isFa ? 'در حال ارسال…' : 'Sending…') : isFa ? 'ارسال لینک بازیابی' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => switchStep('signin')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  color: 'var(--vg-ink2)',
                }}
              >
                {isFa ? 'بازگشت به ورود' : 'Back to sign in'}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor={`${id}-otp`} style={labelStyle}>
                  {isFa ? 'کد تأیید ۶ رقمی' : '6-digit code'}
                </label>
                <input
                  id={`${id}-otp`}
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.35em', fontFamily: 'var(--vg-font-mono)', fontSize: 20 }}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                style={{
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  cursor: busy ? 'wait' : 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  background: 'var(--vg-orange)',
                  color: '#FFFFFF',
                }}
              >
                {busy ? (isFa ? 'در حال بررسی…' : 'Verifying…') : isFa ? 'تأیید و ورود' : 'Verify & continue'}
              </button>
              <button
                type="button"
                onClick={() => switchStep('signin')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  color: 'var(--vg-ink2)',
                }}
              >
                {isFa ? 'بازگشت به ورود' : 'Back to sign in'}
              </button>
            </form>
          )}

          {/* Google OAuth divider & button on signin / signup */}
          {(step === 'signin' || step === 'signup') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--vg-line)' }} />
                <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                  {isFa ? 'یا' : 'or'}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--vg-line)' }} />
              </div>

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={googleBusy || busy}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  border: '1px solid var(--vg-line2)',
                  background: 'var(--vg-raised)',
                  color: 'var(--vg-ink)',
                  fontSize: 14.5,
                  fontWeight: 500,
                  cursor: googleBusy ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <GoogleMark />
                <span>
                  {googleBusy
                    ? isFa
                      ? 'در حال اتصال به گوگل…'
                      : 'Connecting to Google…'
                    : isFa
                      ? 'ادامه با حساب گوگل'
                      : 'Continue with Google'}
                </span>
              </button>
              <p style={{ margin: '10px 0 0', fontSize: 12, textAlign: 'center', color: 'var(--vg-ink3)' }}>
                {isFa
                  ? 'ورود با گوگل به منزله پذیرش قوانین و حریم خصوصی است.'
                  : 'Continuing with Google accepts the Terms of Service and Privacy Policy.'}
              </p>
            </>
          )}
        </div>

        {/* Unified SSO summary strip */}
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid var(--vg-line)',
            background: 'var(--vg-bg2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12.5,
            color: 'var(--vg-ink3)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="shield" size={14} style={{ color: 'var(--vg-green)' }} />
            {isFa ? 'یک حساب واحد برای پنل API، کیف‌پول و چت هوش مصنوعی' : 'One account for API Console, wallet credits & AI Chat'}
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}
