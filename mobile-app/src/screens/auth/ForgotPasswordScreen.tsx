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
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ScrollView as RNScrollView } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { IS_RTL } from '../../utils/rtl';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { login } = useAuth();

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setErrorModal({
        title: t('auth.invalidEmail'),
        message: t('auth.invalidEmailMsg'),
      });
      return;
    }
    try {
      setIsLoading(true);
      await apiService.forgotPassword({ email: trimmed.toLowerCase() });
      setStep('reset');
    } catch (err) {
      let msg = t('auth.genericError');
      if (err instanceof Error) {
        if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
          msg = t('auth.cannotConnect');
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: t('auth.errorTitle'), message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const otp = otpCode.trim();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setErrorModal({
        title: t('auth.invalidCode'),
        message: t('auth.invalidCodeMsg'),
      });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 20) {
      setErrorModal({
        title: t('auth.invalidPassword'),
        message: t('auth.passwordLength'),
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorModal({
        title: t('auth.mismatch'),
        message: t('auth.passwordsMismatch'),
      });
      return;
    }
    try {
      setIsLoading(true);
      await apiService.resetPassword({
        email: email.trim().toLowerCase(),
        otp_code: otp,
        new_password: newPassword,
      });
      try {
        await login(email.trim().toLowerCase(), newPassword);
      } catch {
        setSuccessModal(true);
      }
    } catch (err) {
      const status = err && typeof err === 'object' && 'httpStatus' in err ? (err as { httpStatus?: number }).httpStatus : undefined;
      if (status === 400) {
        setErrorModal({
          title: t('auth.resetFailed'),
          message: t('auth.resetInvalidOrExpired'),
        });
      } else {
        let msg = t('auth.genericError');
        if (err instanceof Error) {
          if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
            msg = t('auth.cannotConnect');
          } else {
            msg = err.message;
          }
        }
        setErrorModal({ title: t('auth.errorTitle'), message: msg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 300,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {step === 'email' ? (
            <View style={styles.form}>
              <Text style={[styles.screenTitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.forgotPasswordTitle')}</Text>
              <Text style={[styles.screenSubtitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>
                {t('auth.forgotPasswordSubtitle')}
              </Text>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.email')}</Text>
                <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'email' && styles.inputFocused,
                    { textAlign: 'auto' },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => {
                    setFocusedInput('email');
                    scrollToInput(0);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder={IS_RTL ? '' : t('auth.enterEmail')}
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={100}
                  maxFontSizeMultiplier={1.2}
                />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, { textAlign: 'left' }]}>
                  {isLoading ? t('auth.sending') : t('auth.sendResetCode')}
                </Text>
              </TouchableOpacity>
              <View style={[styles.switchContainer, { flexDirection: IS_RTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.switchText, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.rememberPassword')} </Text>
                <TouchableOpacity onPress={onBack} disabled={isLoading}>
                  <Text style={[styles.switchLink, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.logInHere')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.screenTitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.enterResetCode')}</Text>
              <Text style={[styles.screenSubtitle, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>
                {t('auth.checkEmailCode')}
              </Text>
              <Text style={[styles.emailHint, { textAlign: 'left' }]}>{email.trim().toLowerCase()}</Text>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.resetCode')}</Text>
                <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.input,
                    styles.otpInput,
                    focusedInput === 'otp' && styles.inputFocused,
                    otpCode.length > 0 && { letterSpacing: 8 },
                    { textAlign: 'auto' },
                  ]}
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  onFocus={() => {
                    setFocusedInput('otp');
                    scrollToInput(0);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder={IS_RTL ? '' : '000000'}
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  maxLength={6}
                  maxFontSizeMultiplier={1.2}
                />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.newPassword')}</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[
                      styles.input,
                      focusedInput === 'newPass' && styles.inputFocused,
                      { textAlign: 'auto', paddingLeft: 44 },
                    ]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => {
                      setFocusedInput('newPass');
                      scrollToInput(120);
                    }}
                    onBlur={() => setFocusedInput(null)}
                    placeholder={IS_RTL ? '' : t('auth.enterNewPassword')}
                    placeholderTextColor="#64748b"
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
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { textAlign: 'left' }]}>{t('auth.confirmPassword')}</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[
                      styles.input,
                      focusedInput === 'confirmPass' && styles.inputFocused,
                      { textAlign: 'auto', paddingLeft: 44 },
                    ]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => {
                      setFocusedInput('confirmPass');
                      scrollToInput(200);
                    }}
                    onBlur={() => setFocusedInput(null)}
                    placeholder={IS_RTL ? '' : t('auth.enterConfirmPassword')}
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showConfirmPassword}
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
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, { textAlign: 'left' }]}>
                  {isLoading ? t('auth.resetting') : t('auth.resetPassword')}
                </Text>
              </TouchableOpacity>
              <View style={[styles.switchContainer, { flexDirection: IS_RTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.switchText, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.wantTryAgain')} </Text>
                <TouchableOpacity onPress={() => setStep('email')} disabled={isLoading}>
                  <Text style={[styles.switchLink, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>{t('auth.goBack')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!errorModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setErrorModal(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconWrapper}>
                <Ionicons name="alert-circle" size={36} color="#ef4444" />
              </View>
              <Text style={styles.modalTitle}>{errorModal?.title ?? t('auth.errorTitle')}</Text>
              <Text style={styles.modalMessage}>{errorModal?.message ?? ''}</Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setErrorModal(null)}>
                <Text style={styles.modalButtonText}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={successModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => {}}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              <View style={styles.successIconWrapper}>
                <Ionicons name="checkmark-circle" size={36} color="#16a34a" />
              </View>
              <Text style={styles.modalTitle}>{t('auth.passwordResetExclamation')}</Text>
              <Text style={styles.modalMessage}>
                {t('auth.passwordUpdatedLoginPrompt')}
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setSuccessModal(false);
                  onBack();
                }}
              >
                <Text style={styles.modalButtonText}>{t('auth.goToLogin')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 22,
  },
  emailHint: {
    fontSize: 14,
    color: '#16a34a',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
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
  otpInput: {
    fontSize: 28,
    textAlign: 'center',
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
  successIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(22,163,74,0.15)',
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
