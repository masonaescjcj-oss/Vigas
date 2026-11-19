import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { KeyButton } from '@/components/buttons';
import { Icon, LogoMark } from '@/components/icons';
import { IconButton } from '@/components/pressable';
import { Segmented } from '@/components/segmented';
import { Label, Span, T } from '@/components/text';
import { apiConfigured, errorMessage, SITE_URL, SUPABASE_URL } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { EmailVerificationRequiredError, useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { colors, GUTTER, withAlpha } from '@/theme';

type Mode = 'signin' | 'signup';
type AuthView = 'signin' | 'signup' | 'verify' | 'forgot' | 'recovery';

const MODES = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
] as const;

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp, verifyEmailOtp, resendSignUpOtp, exchangeAccessToken, requestPasswordReset, resetPasswordWithOtp } = useSession();

  const paramMode: Mode = params.mode === 'signup' ? 'signup' : 'signin';
  const [syncedParamMode, setSyncedParamMode] = useState(params.mode);
  const [view, setView] = useState<AuthView>(paramMode);

  const [verifyEmail, setVerifyEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (params.mode !== syncedParamMode) {
    setSyncedParamMode(params.mode);
    setView(paramMode);
    setError(null);
  }

  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const isSignUp = view === 'signup';
  const trimmedEmail = email.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const emailInvalid = email.length > 0 && !validEmail;
  const passwordWeak = isSignUp && password.length > 0 && password.length < 6;
  const passwordHint =
    !isSignUp || !password
      ? ''
      : password.length < 6
        ? 'At least 6 characters'
        : password.length < 10
          ? 'Okay — longer is stronger'
          : 'Strong';
  const mismatch = isSignUp && confirmPassword.length > 0 && password !== confirmPassword;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const switchMode = (next: Mode) => {
    setView(next);
    setError(null);
  };

  const handleGoogle = async () => {
    if (googleBusy || busy) return;
    if (!SUPABASE_URL) {
      setError('Google sign-in is not configured for this build.');
      return;
    }
    setError(null);
    setGoogleBusy(true);
    try {
      const redirectUri = 'vigas://sign-in';
      const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        return;
      }
      const [beforeHash, hashPart = ''] = result.url.split('#');
      const queryPart = beforeHash?.split('?')[1] ?? '';
      const hashParams = new URLSearchParams(hashPart);
      const queryParams = new URLSearchParams(queryPart);
      const errDesc =
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        queryParams.get('error_description') ||
        queryParams.get('error');
      if (errDesc) throw new Error(errDesc);
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      if (!accessToken) throw new Error('Google sign-in did not return a session token.');
      await exchangeAccessToken(accessToken);
      haptics.success();
      toast('Signed in with Google', 'success');
      close();
    } catch (e) {
      haptics.error();
      setError(errorMessage(e));
    } finally {
      setGoogleBusy(false);
    }
  };

  const submitAuth = async () => {
    setError(null);
    if (view === 'verify') {
      const code = otpCode.replace(/\s+/g, '');
      if (code.length < 6) {
        setError('Enter the 6-digit verification code from your email.');
        haptics.error();
        return;
      }
      setBusy(true);
      try {
        await verifyEmailOtp(verifyEmail, code);
        haptics.success();
        toast('Account verified', 'success');
        close();
      } catch (e) {
        haptics.error();
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (view === 'forgot') {
      if (!validEmail) {
        setError('Enter a valid email address.');
        haptics.error();
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(trimmedEmail);
        setResetEmail(trimmedEmail);
        setOtpCode('');
        setNewPassword('');
        setView('recovery');
        haptics.tap();
        toast(`Recovery code sent to ${trimmedEmail}`, 'neutral');
      } catch (e) {
        haptics.error();
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (view === 'recovery') {
      const code = otpCode.replace(/\s+/g, '');
      if (code.length < 6) {
        setError('Enter the 6-digit code from your email.');
        haptics.error();
        return;
      }
      if (newPassword.length < 6) {
        setError('Choose a password with at least 6 characters.');
        haptics.error();
        return;
      }
      setBusy(true);
      try {
        await resetPasswordWithOtp(resetEmail, code, newPassword);
        haptics.success();
        toast('Password updated', 'success');
        close();
      } catch (e) {
        haptics.error();
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!validEmail) {
      setError('Enter a valid email address.');
      haptics.error();
      return;
    }
    if (isSignUp) {
      if (password.length < 6) {
        setError('Use at least 6 characters for your password.');
        haptics.error();
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        haptics.error();
        return;
      }
      if (!acceptedTerms) {
        setError('Accept the Terms of Service and Privacy Policy to continue.');
        haptics.error();
        return;
      }
    } else if (!password) {
      setError('Enter your password.');
      haptics.error();
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) await signUp(trimmedEmail, password);
      else await signIn(trimmedEmail, password);
      haptics.success();
      toast(isSignUp ? 'Welcome to Vigas' : 'Signed in', 'success');
      close();
    } catch (e) {
      if (e instanceof EmailVerificationRequiredError) {
        setVerifyEmail(e.email);
        setOtpCode('');
        setView('verify');
        haptics.tap();
        toast(`Verification code sent to ${e.email}`, 'neutral');
      } else {
        haptics.error();
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    if (!verifyEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resendSignUpOtp(verifyEmail);
      haptics.tap();
      toast(`Fresh code sent to ${verifyEmail}`, 'neutral');
    } catch (e) {
      haptics.error();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const heading =
    view === 'verify'
      ? 'Check your email.'
      : view === 'forgot' || view === 'recovery'
        ? 'Reset password.'
        : isSignUp
          ? 'Create an account.'
          : 'Welcome back.';

  const subtitle =
    view === 'verify'
      ? `Enter the 6-digit verification code sent to ${verifyEmail} to unlock AI Chat, API keys & credits.`
      : view === 'forgot'
        ? 'Enter your email and we will send you a 6-digit recovery code.'
        : view === 'recovery'
          ? `Enter the 6-digit code sent to ${resetEmail} and choose a new password.`
          : isSignUp
            ? 'One account for Vigas AI Chat, Studio builds, API keys & prepaid credits.'
            : 'Your projects, AI chats, API keys, and credits in one place.';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
        <View style={styles.flex} />
        <View style={styles.brandBadge}>
          <LogoMark size={18} />
          <T f="monoMedium" size={12} color={colors.ink2}>
            vigas · retro
          </T>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(320)} style={styles.brand}>
            <T f="serif" size={38} lh={1.06} ls={-0.02} accessibilityRole="header">
              {heading.replace('.', '')}
              <Span f="serifItalic" color={colors.orange}>
                .
              </Span>
            </T>
            <T size={15} color={colors.ink2} lh={1.45}>
              {subtitle}
            </T>
          </Animated.View>

          {!apiConfigured ? (
            <Animated.View entering={FadeIn} style={styles.notice}>
              <Icon name="info" size={18} color={colors.sand} />
              <T size={13} color={colors.ink2} style={styles.flex}>
                No server is configured for this build. Set{' '}
                <Span f="mono" color={colors.ink}>
                  EXPO_PUBLIC_API_URL
                </Span>{' '}
                and restart to sign in.
              </T>
            </Animated.View>
          ) : null}

          {view === 'signin' || view === 'signup' ? (
            <Segmented
              options={MODES}
              value={view}
              onChange={switchMode}
              style={styles.modes}
              height={40}
              fontSize={14}
              accessibilityLabel="Sign in or create an account"
            />
          ) : null}

          <Animated.View layout={LinearTransition.duration(220)} style={styles.form}>
            {view === 'verify' ? (
              <>
                <Field
                  label="6-digit verification code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={8}
                  returnKeyType="go"
                  onSubmitEditing={() => void submitAuth()}
                  style={styles.otpInput}
                />
                {error ? <ErrorBox message={error} /> : null}
                <KeyButton
                  label="Verify & sign in"
                  height={52}
                  fontSize={16}
                  loading={busy}
                  onPress={() => void submitAuth()}
                  style={styles.submit}
                />
                <View style={styles.linkRow}>
                  <Pressable accessibilityRole="button" onPress={() => void handleResendCode()} hitSlop={10}>
                    <T size={13} color={colors.orangeText}>
                      Resend code
                    </T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setView('signin');
                      setError(null);
                    }}
                    hitSlop={10}
                  >
                    <T size={13} color={colors.ink3}>
                      Back to sign in
                    </T>
                  </Pressable>
                </View>
              </>
            ) : view === 'forgot' ? (
              <>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  onSubmitEditing={() => void submitAuth()}
                  invalid={emailInvalid}
                />
                {error ? <ErrorBox message={error} /> : null}
                <KeyButton
                  label="Send recovery code"
                  height={52}
                  fontSize={16}
                  loading={busy}
                  onPress={() => void submitAuth()}
                  style={styles.submit}
                />
                <Pressable accessibilityRole="button" onPress={() => switchMode('signin')} hitSlop={10}>
                  <T size={13} color={colors.ink3} align="center">
                    Back to sign in
                  </T>
                </Pressable>
              </>
            ) : view === 'recovery' ? (
              <>
                <Field
                  label="6-digit recovery code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={8}
                  style={styles.otpInput}
                />
                <Field
                  label="New password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={() => void submitAuth()}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={8}
                      style={styles.show}
                    >
                      <T f="sansMedium" size={13} color={colors.ink2}>
                        {showPassword ? 'Hide' : 'Show'}
                      </T>
                    </Pressable>
                  }
                />
                {error ? <ErrorBox message={error} /> : null}
                <KeyButton
                  label="Update password & sign in"
                  height={52}
                  fontSize={16}
                  loading={busy}
                  onPress={() => void submitAuth()}
                  style={styles.submit}
                />
                <Pressable accessibilityRole="button" onPress={() => switchMode('signin')} hitSlop={10}>
                  <T size={13} color={colors.ink3} align="center">
                    Back to sign in
                  </T>
                </Pressable>
              </>
            ) : (
              <>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  invalid={emailInvalid}
                  hint={emailInvalid ? 'That does not look like an email address.' : undefined}
                  hintError={emailInvalid}
                />

                <Field
                  ref={passwordRef}
                  label="Password"
                  labelRight={
                    !isSignUp ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setView('forgot');
                          setError(null);
                        }}
                        hitSlop={8}
                      >
                        <T f="mono" size={12} color={colors.orangeText}>
                          forgot?
                        </T>
                      </Pressable>
                    ) : undefined
                  }
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  returnKeyType={isSignUp ? 'next' : 'go'}
                  onSubmitEditing={() => (isSignUp ? confirmRef.current?.focus() : void submitAuth())}
                  invalid={passwordWeak}
                  hint={passwordHint || undefined}
                  hintError={passwordWeak}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={8}
                      style={styles.show}
                    >
                      <T f="sansMedium" size={13} color={colors.ink2}>
                        {showPassword ? 'Hide' : 'Show'}
                      </T>
                    </Pressable>
                  }
                />

                {isSignUp ? (
                  <>
                    <Field
                      ref={confirmRef}
                      label="Confirm password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Once more"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="go"
                      onSubmitEditing={() => void submitAuth()}
                      invalid={mismatch}
                      hint={mismatch ? 'Passwords do not match.' : undefined}
                      hintError={mismatch}
                    />

                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: acceptedTerms }}
                      onPress={() => {
                        haptics.select();
                        setAcceptedTerms((v) => !v);
                      }}
                      style={styles.termsRow}
                    >
                      <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
                        {acceptedTerms ? <Icon name="check" size={13} color={colors.onOrange} strokeWidth={2.4} /> : null}
                      </View>
                      <T size={13} color={colors.ink2} lh={1.4} style={styles.flex}>
                        I accept the{' '}
                        <Span
                          color={colors.ink}
                          style={styles.underline}
                          onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/terms`)}
                        >
                          Terms of Service
                        </Span>{' '}
                        and{' '}
                        <Span
                          color={colors.ink}
                          style={styles.underline}
                          onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)}
                        >
                          Privacy Policy
                        </Span>
                        .
                      </T>
                    </Pressable>
                  </>
                ) : null}

                {error ? <ErrorBox message={error} /> : null}

                <KeyButton
                  label={isSignUp ? 'Create account' : 'Sign in'}
                  height={52}
                  fontSize={16}
                  loading={busy}
                  onPress={() => void submitAuth()}
                  style={styles.submit}
                />

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <T f="mono" size={12} color={colors.ink3}>
                    or
                  </T>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  disabled={googleBusy || busy}
                  onPress={() => void handleGoogle()}
                  style={({ pressed }) => [
                    styles.googleBtn,
                    pressed && { backgroundColor: colors.raised },
                    (googleBusy || busy) && { opacity: 0.6 },
                  ]}
                >
                  <GoogleMark size={18} />
                  <T f="sansMedium" size={15} color={colors.ink}>
                    {googleBusy ? 'Connecting to Google…' : 'Continue with Google'}
                  </T>
                </Pressable>

                <T size={12} color={colors.ink3} align="center" lh={1.45}>
                  Continuing with Google accepts the Terms of Service and Privacy Policy.
                </T>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.error} accessibilityLiveRegion="polite">
      <Icon name="info" size={16} color={colors.red} />
      <T size={14} color={colors.ink} style={styles.flex}>
        {message}
      </T>
    </Animated.View>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  labelRight?: ReactNode;
  trailing?: ReactNode;
  hint?: string;
  hintError?: boolean;
  invalid?: boolean;
  ref?: Ref<TextInputInstance>;
}

function Field({ label, labelRight, trailing, hint, hintError, invalid, style, ref, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Label>{label}</Label>
        {labelRight}
      </View>
      <View style={[styles.inputWrap, focused && styles.inputFocused, invalid && styles.inputInvalid]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.orange}
          cursorColor={colors.orange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, style]}
          {...input}
        />
        {trailing}
      </View>
      {hint ? (
        <T size={12} color={hintError ? colors.red : colors.ink3}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingRight: GUTTER },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  content: { paddingHorizontal: GUTTER, paddingTop: 10 },
  brand: { gap: 10 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.sand, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.sand, 0.3),
  },
  modes: { marginTop: 22 },
  form: { marginTop: 18, gap: 15 },
  field: { gap: 7 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    paddingLeft: 16,
    paddingRight: 8,
  },
  inputFocused: { borderColor: colors.orange },
  inputInvalid: { borderColor: colors.red },
  input: { flex: 1, minWidth: 0, height: 50, color: colors.ink, fontFamily: 'Inter_400Regular', fontSize: 16 },
  otpInput: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 20, letterSpacing: 4, textAlign: 'center' },
  show: { minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  underline: { textDecorationLine: 'underline' },
  error: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.red, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.red, 0.3),
  },
  submit: { marginTop: 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  googleBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
});
