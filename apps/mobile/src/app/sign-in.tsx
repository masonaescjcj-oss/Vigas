import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyButton } from '@/components/buttons';
import { Icon, LogoMark } from '@/components/icons';
import { IconButton } from '@/components/pressable';
import { Segmented } from '@/components/segmented';
import { Label, Span, T } from '@/components/text';
import { apiConfigured, errorMessage } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { colors, GUTTER, withAlpha } from '@/theme';

type Mode = 'signin' | 'signup';

const MODES = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
] as const;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const signup = mode === 'signup';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword = password.length >= (signup ? 8 : 1);
  const canSubmit = validEmail && validPassword && !busy;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    if (!canSubmit) {
      setError(!validEmail ? 'Enter a valid email address.' : signup ? 'Use at least 8 characters for your password.' : 'Enter your password.');
      haptics.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (signup) await signUp(email.trim(), password, name.trim());
      else await signIn(email.trim(), password);
      haptics.success();
      toast(signup ? 'Welcome to Vigas' : 'Signed in', 'success');
      close();
    } catch (e) {
      haptics.error();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(380)} style={styles.brand}>
            <LogoMark size={30} />
            <T f="serif" size={40} lh={1.05} ls={-0.02} accessibilityRole="header">
              {signup ? 'Join ' : 'Welcome to '}
              <Span f="serifItalic" color={colors.sand}>
                Vigas.
              </Span>
            </T>
            <T size={15} color={colors.ink2}>
              One account for API keys, credits, Vigas Chat and the Arena — on the web and on Android.
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

          <Segmented
            options={MODES}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            style={styles.modes}
            height={40}
            fontSize={14}
            accessibilityLabel="Sign in or create an account"
          />

          <Animated.View layout={LinearTransition.duration(220)} style={styles.form}>
            {signup ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <Field
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </Animated.View>
            ) : null}
            <Field
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={signup ? 'At least 8 characters' : 'Your password'}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={signup ? 'new-password' : 'current-password'}
              textContentType={signup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
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

            {error ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.error} accessibilityLiveRegion="polite">
                <Icon name="info" size={16} color={colors.red} />
                <T size={14} color={colors.ink} style={styles.flex}>
                  {error}
                </T>
              </Animated.View>
            ) : null}

            <KeyButton
              label={signup ? 'Create account' : 'Sign in'}
              height={52}
              fontSize={16}
              loading={busy}
              onPress={() => void submit()}
              style={styles.submit}
            />
            <T size={12} color={colors.ink3} align="center">
              {signup ? 'Your first $5 of top-ups are fee-free.' : 'Forgot your password? Reset it on vigas.ai.'}
            </T>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  trailing?: ReactNode;
  ref?: Ref<TextInputInstance>;
}

function Field({ label, trailing, style, ref, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 },
  content: { paddingHorizontal: GUTTER, paddingTop: 8 },
  brand: { gap: 12 },
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
  modes: { marginTop: 24 },
  form: { marginTop: 20, gap: 16 },
  field: { gap: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    paddingLeft: 16,
    paddingRight: 8,
  },
  inputFocused: { borderColor: colors.orange },
  input: { flex: 1, minWidth: 0, height: 52, color: colors.ink, fontFamily: 'Inter_400Regular', fontSize: 16 },
  show: { minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  error: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.red, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.red, 0.3),
  },
  submit: { marginTop: 4 },
});
