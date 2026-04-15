import React, { useState, useRef } from 'react';
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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ScrollView as RNScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiService } from '../../services/api';

export interface SocialUsernameScreenProps {
  provider: 'google' | 'apple';
  google_id?: string;
  apple_id?: string;
  email?: string;
  prefillName?: string;
  onSuccess: () => void;
  onBack: () => void;
  id_token?: string;
  identity_token?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

async function storeAuthData(token: string, userData: any) {
  await SecureStore.setItemAsync('auth_token', token);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(userData));
}

export default function SocialUsernameScreen({
  provider,
  prefillName,
  email,
  onSuccess,
  onBack,
  id_token,
  identity_token,
}: SocialUsernameScreenProps) {
  const [name, setName] = useState(prefillName ?? '');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const scrollViewRef = useRef<RNScrollView>(null);

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const validate = (): string | null => {
    const n = name.trim();
    const u = username.trim();
    if (!n || !u) {
      return 'Please fill in all fields';
    }
    if (n.length < 2 || n.length > 14) {
      return 'Name must be between 2 and 14 characters';
    }
    if (u.length < 3 || u.length > 14) {
      return 'Username must be between 3 and 14 characters';
    }
    if (!USERNAME_REGEX.test(u)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  };

  const handleContinue = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorModal({ title: 'Invalid Input', message: validationError });
      return;
    }

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (provider === 'google') {
      if (!id_token?.trim()) {
        setErrorModal({
          title: 'Error',
          message: 'Missing sign-in token. Please go back and try again.',
        });
        return;
      }
    } else {
      if (!identity_token?.trim()) {
        setErrorModal({
          title: 'Error',
          message: 'Missing sign-in token. Please go back and try again.',
        });
        return;
      }
    }

    try {
      setIsLoading(true);

      if (provider === 'google') {
        const result = await apiService.loginWithGoogle({
          id_token: id_token!,
          username: trimmedUsername,
          name: trimmedName,
        });
        if (!result.needs_registration && result.access_token && result.user_id) {
          apiService.setAccessToken(result.access_token);
          const userData = await apiService.getCurrentUser();
          await storeAuthData(result.access_token, userData);
          onSuccess();
        } else {
          setErrorModal({
            title: 'Sign-up Failed',
            message: 'Could not complete sign-up. Please try again.',
          });
        }
      } else {
        const result = await apiService.loginWithApple({
          identity_token: identity_token!,
          username: trimmedUsername,
          name: trimmedName,
          email,
        });
        if (!result.needs_registration && result.access_token && result.user_id) {
          apiService.setAccessToken(result.access_token);
          const userData = await apiService.getCurrentUser();
          await storeAuthData(result.access_token, userData);
          onSuccess();
        } else {
          setErrorModal({
            title: 'Sign-up Failed',
            message: 'Could not complete sign-up. Please try again.',
          });
        }
      }
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err instanceof Error) {
        const httpStatus = (err as Error & { httpStatus?: number }).httpStatus;
        if (httpStatus === 409) {
          msg = 'This email is already registered. Sign in with your existing account.';
        } else if (
          err.message.includes('400') ||
          err.message.toLowerCase().includes('exist') ||
          err.message.toLowerCase().includes('taken') ||
          err.message.toLowerCase().includes('already')
        ) {
          if (err.message.toLowerCase().includes('email')) {
            msg = 'This email is already registered. Please use a different one.';
          } else {
            msg = 'This username is already taken. Please choose a different one.';
          }
        } else if (
          err.message.includes('Network') ||
          err.message.includes('fetch') ||
          err.message.includes('connect')
        ) {
          msg = 'Cannot connect to server. Please check your connection.';
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: 'Sign-up Failed', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onBack}
              disabled={isLoading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color="#16a34a" />
            </TouchableOpacity>
          </View>

          <Text style={styles.screenTitle} maxFontSizeMultiplier={1.2}>
            Almost there!
          </Text>
          <Text style={styles.screenSubtitle} maxFontSizeMultiplier={1.2}>
            Choose a username to complete your sign-up
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'name' && styles.inputFocused,
                ]}
                value={name}
                onChangeText={setName}
                onFocus={() => {
                  setFocusedInput('name');
                  scrollToInput(0);
                }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter full name"
                placeholderTextColor="#64748b"
                textContentType="name"
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
                onChangeText={setUsername}
                onFocus={() => {
                  setFocusedInput('username');
                  scrollToInput(80);
                }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter username (3–14 chars)"
                placeholderTextColor="#64748b"
                textContentType="username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={14}
                maxFontSizeMultiplier={1.2}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Please wait...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!errorModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setErrorModal(null)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 22,
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
