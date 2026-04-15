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

WebBrowser.maybeCompleteAuthSession();

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({
  onSwitchToLogin,
  onSocialRegistration,
}: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { register, loginWithGoogle, loginWithApple } = useAuth();

  const [_request, response, promptAsync] = Google.useAuthRequest({
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
            title: 'Account Exists',
            message:
              'This email is already registered. Please login with username and password.',
          });
        } else {
          setErrorModal({
            title: 'Error',
            message: 'Google sign-in failed. Please try again.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loginWithGoogle, onSocialRegistration]
  );

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleToken(response.authentication?.idToken ?? '');
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
          title: 'Account Exists',
          message:
            'This email is already registered. Please login with username and password.',
        });
      } else {
        setErrorModal({
          title: 'Error',
          message: 'Apple sign-in failed. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const validateForm = (): string | null => {
    if (!username.trim() || !password.trim() || !name.trim() || !email.trim()) {
      return 'Please fill in all fields';
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (username.length > 14) {
      return 'Username must be 14 characters or less';
    }
    if (name.length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.length > 14) {
      return 'Name must be 14 characters or less';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (password.length > 20) {
      return 'Password must be at most 20 characters';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleRegister = async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorModal({ title: 'Invalid Input', message: validationError });
      return;
    }
    try {
      setIsLoading(true);
      await register(username.trim(), password, name.trim(), email.trim().toLowerCase());
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('400') || err.message.toLowerCase().includes('exist') || err.message.toLowerCase().includes('taken') || err.message.toLowerCase().includes('already')) {
          if (err.message.toLowerCase().includes('email')) {
            msg = 'This email is already registered. Please use a different one.';
          } else {
            msg = 'This username is already taken. Please choose a different one.';
          }
        } else if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
          msg = 'Cannot connect to server. Please check your connection.';
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: 'Registration Failed', message: msg });
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
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'name' && styles.inputFocused,
                ]}
                value={name}
                onChangeText={(t) => setName(t)}
                onFocus={() => { setFocusedInput('name'); scrollToInput(0); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter full name"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={14}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'username' && styles.inputFocused,
                ]}
                value={username}
                onChangeText={(t) => setUsername(t)}
                onFocus={() => { setFocusedInput('username'); scrollToInput(80); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter username (min 3 chars)"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={14}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'email' && styles.inputFocused,
                ]}
                value={email}
                onChangeText={(t) => setEmail(t)}
                onFocus={() => { setFocusedInput('email'); scrollToInput(160); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter your email"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={100}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'password' && styles.inputFocused,
                ]}
                value={password}
                onChangeText={(t) => setPassword(t)}
                onFocus={() => { setFocusedInput('password'); scrollToInput(240); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter password (min 6 chars)"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={20}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'confirmPassword' && styles.inputFocused,
                ]}
                value={confirmPassword}
                onChangeText={(t) => setConfirmPassword(t)}
                onFocus={() => { setFocusedInput('confirmPassword'); scrollToInput(320); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter password again"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={20}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Signing up...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.socialDivider}>───── or ─────</Text>

            <TouchableOpacity
              style={[styles.socialButtonBase, styles.socialButtonGoogle]}
              onPress={() => {
                void promptAsync();
              }}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={20} color="#1f2937" />
              <Text style={styles.socialButtonTextDark}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.socialButtonBase, styles.socialButtonApple]}
                onPress={() => {
                  void handleAppleSignIn();
                }}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#ffffff" />
                <Text style={styles.socialButtonTextLight}>Continue with Apple</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.switchContainer}>
              <Text style={styles.switchText} maxFontSizeMultiplier={1.2}>Already have an account? </Text>
              <TouchableOpacity onPress={onSwitchToLogin} disabled={isLoading}>
                <Text style={styles.switchLink} maxFontSizeMultiplier={1.2}>Login here</Text>
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
              {errorModal?.title ?? 'Error'}
            </Text>
            <Text style={styles.modalMessage}>
              {errorModal?.message ?? ''}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModal(null)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
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
  },
  inputFocused: {
    borderColor: '#16a34a',
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
  },
  socialButtonApple: {
    backgroundColor: '#000000',
    marginTop: 12,
  },
  socialButtonTextDark: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
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
