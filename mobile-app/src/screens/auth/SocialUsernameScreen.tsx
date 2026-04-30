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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { AppEventsLogger } from 'react-native-fbsdk-next';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { IS_RTL } from '../../utils/rtl';

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

export default function SocialUsernameScreen({
  provider,
  prefillName,
  email,
  onSuccess,
  onBack,
  id_token,
  identity_token,
}: SocialUsernameScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(prefillName ?? '');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { setUser } = useAuth();

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const validate = (): string | null => {
    const n = name.trim();
    const u = username.trim();
    if (!n || !u) {
      return t('auth.fillAllFields');
    }
    if (n.length < 2 || n.length > 14) {
      return t('auth.nameLength');
    }
    if (u.length < 3 || u.length > 14) {
      return t('auth.usernameLength');
    }
    if (!USERNAME_REGEX.test(u)) {
      return t('auth.usernameChars');
    }
    return null;
  };

  const handleContinue = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorModal({ title: t('auth.invalidInput'), message: validationError });
      return;
    }

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (provider === 'google') {
      if (!id_token?.trim()) {
        setErrorModal({
          title: t('auth.errorTitle'),
          message: t('auth.missingToken'),
        });
        return;
      }
    } else {
      if (!identity_token?.trim()) {
        setErrorModal({
          title: t('auth.errorTitle'),
          message: t('auth.missingToken'),
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
          await SecureStore.setItemAsync('auth_token', result.access_token);
          await SecureStore.setItemAsync('auth_user', JSON.stringify(userData));
          setUser(userData);
          AppEventsLogger.logEvent('registration_completed');
          onSuccess();
        } else {
          setErrorModal({
            title: t('auth.signUpFailed'),
            message: t('auth.signUpCouldNotComplete'),
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
          await SecureStore.setItemAsync('auth_token', result.access_token);
          await SecureStore.setItemAsync('auth_user', JSON.stringify(userData));
          setUser(userData);
          AppEventsLogger.logEvent('registration_completed');
          onSuccess();
        } else {
          setErrorModal({
            title: t('auth.signUpFailed'),
            message: t('auth.signUpCouldNotComplete'),
          });
        }
      }
    } catch (err) {
      let msg = t('auth.genericError');
      if (err instanceof Error) {
        const httpStatus = (err as Error & { httpStatus?: number }).httpStatus;
        if (httpStatus === 409) {
          msg = t('auth.emailInUseSignIn');
        } else if (
          err.message.includes('400') ||
          err.message.toLowerCase().includes('exist') ||
          err.message.toLowerCase().includes('taken') ||
          err.message.toLowerCase().includes('already')
        ) {
          if (err.message.toLowerCase().includes('email')) {
            msg = t('auth.emailInUse');
          } else {
            msg = t('auth.usernameTaken');
          }
        } else if (
          err.message.includes('Network') ||
          err.message.includes('fetch') ||
          err.message.includes('connect')
        ) {
          msg = t('auth.cannotConnect');
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: t('auth.signUpFailed'), message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <LinearGradient colors={['#0f172a', '#1e3a2f']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
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
                  accessibilityLabel={t('common.back')}
                >
                  <Ionicons name="arrow-back" size={24} color="#16a34a" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.screenTitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>
                {t('auth.completeProfile')}
              </Text>
              <Text style={[styles.screenSubtitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>
                {t('auth.completeProfileSubtitle')}
              </Text>

              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.fullName')}</Text>
                  <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[
                      styles.input,
                      focusedInput === 'name' && styles.inputFocused,
                      { textAlign: 'auto' },
                    ]}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => {
                      setFocusedInput('name');
                      scrollToInput(0);
                    }}
                    onBlur={() => setFocusedInput(null)}
                    placeholder={IS_RTL ? '' : t('auth.enterFullName')}
                    placeholderTextColor="#64748b"
                    textContentType="name"
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isLoading}
                    maxLength={14}
                    maxFontSizeMultiplier={1.2}
                  />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.username')}</Text>
                  <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[
                      styles.input,
                      focusedInput === 'username' && styles.inputFocused,
                      { textAlign: 'auto' },
                    ]}
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => {
                      setFocusedInput('username');
                      scrollToInput(80);
                    }}
                    onBlur={() => setFocusedInput(null)}
                    placeholder={IS_RTL ? '' : t('auth.enterUsername')}
                    placeholderTextColor="#64748b"
                    textContentType="username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    maxLength={14}
                    maxFontSizeMultiplier={1.2}
                  />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleContinue}
                  disabled={isLoading}
                >
                  <Text style={[styles.buttonText, { textAlign: 'left' }]}>
                    {isLoading ? t('auth.continuing') : t('auth.continue')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>

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
    textAlign: 'auto',
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
