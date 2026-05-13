import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ScrollView as RNScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { IS_RTL } from '../../utils/rtl';
import Svg, { Path } from 'react-native-svg';

WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  onSocialRegistration?: (data: {
    provider: 'google' | 'apple';
    google_id?: string;
    apple_id?: string;
    email?: string;
    name?: string;
    id_token?: string;
    identity_token?: string;
  }) => void;
}

export default function LoginScreen({
  onSwitchToRegister,
  onForgotPassword,
  onSocialRegistration,
}: LoginScreenProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { login, loginWithGoogle, loginWithApple } = useAuth();

  const [_request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: '3581541137-s8l6a0emn5cm6nor6rd65lp67b69enc1.apps.googleusercontent.com',
    androidClientId: '3581541137-0oeqbcv9rrbmth9oo8h3o7777evi9afq.apps.googleusercontent.com',
  });

  const handleGoogleToken = useCallback(
    async (idToken: string) => {
      if (!idToken) {
        return;
      }
      try {
        setIsLoading(true);
        const result = await loginWithGoogle(idToken);
        if (result.needs_registration) {
          onSocialRegistration?.({
            provider: 'google',
            ...result,
            id_token: idToken,
          });
        }
      } catch (err) {
        if (err instanceof Error && (err as Error & { httpStatus?: number }).httpStatus === 409) {
          setErrorModal({
            title: t('auth.accountExists'),
            message: t('auth.accountExistsMsg'),
          });
        } else {
          setErrorModal({
            title: t('auth.errorTitle'),
            message: t('auth.googleFailed'),
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loginWithGoogle, onSocialRegistration, t]
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken ?? (response.params as any)?.id_token ?? '';
      handleGoogleToken(idToken);
    }
  }, [response, handleGoogleToken]);

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const result = await loginWithApple(
        credential.identityToken ?? '',
        credential.email ?? undefined
      );
      if (result.needs_registration) {
        const name =
          credential.fullName?.givenName && credential.fullName?.familyName
            ? `${credential.fullName.givenName} ${credential.fullName.familyName}`
            : undefined;
        onSocialRegistration?.({
          provider: 'apple',
          ...result,
          identity_token: credential.identityToken ?? '',
          name: name ?? result.name,
        });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'ERR_CANCELED') {
        return;
      }
      if (err instanceof Error && (err as Error & { httpStatus?: number }).httpStatus === 409) {
        setErrorModal({
          title: t('auth.accountExists'),
          message: t('auth.accountExistsMsg'),
        });
      } else {
        setErrorModal({
          title: t('auth.errorTitle'),
          message: t('auth.appleFailed'),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError(t('auth.fillAllFields'));
      return;
    }

    try {
      setIsLoading(true);
      await login(username.trim(), password);
    } catch (err) {
      let msg = t('auth.genericError');
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.toLowerCase().includes('invalid') || err.message.toLowerCase().includes('unauthorized')) {
          msg = t('auth.wrongCredentials');
        } else if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
          msg = t('auth.cannotConnect');
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: t('auth.loginFailed'), message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.username')}</Text>
              <View style={{ position: 'relative' }}>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'username' && styles.inputFocused,
                  { textAlign: IS_RTL ? 'right' : 'left' },
                ]}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError('');
                }}
                onFocus={() => { setFocusedInput('username'); scrollToInput(0); }}
                onBlur={() => setFocusedInput(null)}
                placeholder={t('auth.enterUsername')}
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={14}
                maxFontSizeMultiplier={1.2}
              />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.password')}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'password' && styles.inputFocused,
                    { textAlign: IS_RTL ? 'right' : 'left', paddingLeft: 44 },
                  ]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  onFocus={() => { setFocusedInput('password'); scrollToInput(80); }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor="#64748b"
                  textContentType="oneTimeCode"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={20}
                  maxFontSizeMultiplier={1.2}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.forgotLink, { alignSelf: IS_RTL ? 'flex-start' : 'flex-end' }]}
              onPress={onForgotPassword}
              disabled={isLoading}
            >
              <Text style={[styles.forgotLinkText, { textAlign: 'left' }]}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            {error ? <Text style={[styles.errorText, { textAlign: 'left' }]}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, { textAlign: 'left' }]}>
                {isLoading ? t('auth.loggingIn') : t('auth.login')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.socialDivider}>───── {t('auth.orDivider')} ─────</Text>

            <TouchableOpacity
              style={[styles.socialButtonBase, styles.socialButtonGoogle, { flexDirection: IS_RTL ? 'row-reverse' : 'row' }]}
              onPress={() => { void promptAsync(); }}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Svg width={20} height={20} viewBox="0 0 48 48">
                <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <Path fill="none" d="M0 0h48v48H0z" />
              </Svg>
              <Text style={styles.socialButtonTextDark}>{t('auth.continueWithGoogle')}</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.socialButtonBase, styles.socialButtonApple, { flexDirection: IS_RTL ? 'row-reverse' : 'row' }]}
                onPress={() => {
                  void handleAppleSignIn();
                }}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#ffffff" />
                <Text style={styles.socialButtonTextLight}>{t('auth.continueWithApple')}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={[styles.switchContainer, { flexDirection: IS_RTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.switchText, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.noAccount')} </Text>
              <TouchableOpacity onPress={onSwitchToRegister} disabled={isLoading}>
                <Text style={[styles.switchLink, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.signUpHere')}</Text>
              </TouchableOpacity>
            </View>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={!!errorModal} transparent animationType="fade">
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setErrorModal(null)}
      >
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrapper}>
              <Ionicons name="alert-circle" size={36} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>
              {errorModal?.title ?? t('auth.errorTitle')}
            </Text>
            <Text style={styles.modalMessage}>
              {errorModal?.message ?? ''}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModal(null)}
            >
              <Text style={styles.modalButtonText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 300,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#94a3b8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    color: '#ffffff',
    textAlign: 'auto',
  },
  inputFocused: {
    borderColor: '#16a34a',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotLinkText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#15803d',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  socialDivider: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 20,
    marginBottom: 20,
    fontSize: 14,
  },
  socialButtonBase: {
    height: 48,
    borderRadius: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonGoogle: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  socialButtonTextDark: {
    color: '#3c4043',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  socialButtonApple: {
    backgroundColor: '#000000',
    marginTop: 12,
  },
  socialButtonTextLight: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 24,
    gap: 4,
  },
  switchText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  switchLink: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
