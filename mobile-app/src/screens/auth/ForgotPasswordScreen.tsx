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

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
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
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
      });
      return;
    }
    try {
      setIsLoading(true);
      await apiService.forgotPassword({ email: trimmed.toLowerCase() });
      setStep('reset');
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
          msg = 'Cannot connect to server. Please check your connection.';
        } else {
          msg = err.message;
        }
      }
      setErrorModal({ title: 'Error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const otp = otpCode.trim();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setErrorModal({
        title: 'Invalid Code',
        message: 'Please enter the 6-digit code from your email.',
      });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 20) {
      setErrorModal({
        title: 'Invalid Password',
        message: 'Password must be 6–20 characters.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorModal({
        title: 'Mismatch',
        message: 'Passwords do not match.',
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
          title: 'Reset Failed',
          message: 'Invalid or expired code. Please try again.',
        });
      } else {
        let msg = 'Something went wrong. Please try again.';
        if (err instanceof Error) {
          if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('connect')) {
            msg = 'Cannot connect to server. Please check your connection.';
          } else {
            msg = err.message;
          }
        }
        setErrorModal({ title: 'Error', message: msg });
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
              <Text style={styles.screenTitle} maxFontSizeMultiplier={1.2}>Forgot Password</Text>
              <Text style={styles.screenSubtitle} maxFontSizeMultiplier={1.2}>
                {`Enter your email and we'll send you a reset code`}
              </Text>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'email' && styles.inputFocused,
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => {
                    setFocusedInput('email');
                    scrollToInput(0);
                  }}
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
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Sending...' : 'Send Reset Code'}
                </Text>
              </TouchableOpacity>
              <View style={styles.switchContainer}>
                <Text style={styles.switchText} maxFontSizeMultiplier={1.2}>Remember your password? </Text>
                <TouchableOpacity onPress={onBack} disabled={isLoading}>
                  <Text style={styles.switchLink} maxFontSizeMultiplier={1.2}>Log in here</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.screenTitle} maxFontSizeMultiplier={1.2}>Enter Reset Code</Text>
              <Text style={styles.screenSubtitle} maxFontSizeMultiplier={1.2}>
                Check your email for the 6-digit code
              </Text>
              <Text style={styles.emailHint}>{email.trim().toLowerCase()}</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Reset Code</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.otpInput,
                    focusedInput === 'otp' && styles.inputFocused,
                    otpCode.length > 0 && { letterSpacing: 8 },
                  ]}
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  onFocus={() => {
                    setFocusedInput('otp');
                    scrollToInput(0);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  maxLength={6}
                  maxFontSizeMultiplier={1.2}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'newPass' && styles.inputFocused,
                  ]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onFocus={() => {
                    setFocusedInput('newPass');
                    scrollToInput(120);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={20}
                  maxFontSizeMultiplier={1.2}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'confirmPass' && styles.inputFocused,
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => {
                    setFocusedInput('confirmPass');
                    scrollToInput(200);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Confirm new password"
                  placeholderTextColor="#64748b"
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
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Text>
              </TouchableOpacity>
              <View style={styles.switchContainer}>
                <Text style={styles.switchText} maxFontSizeMultiplier={1.2}>Want to try again? </Text>
                <TouchableOpacity onPress={() => setStep('email')} disabled={isLoading}>
                  <Text style={styles.switchLink} maxFontSizeMultiplier={1.2}>Go back</Text>
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
              <Text style={styles.modalTitle}>{errorModal?.title ?? 'Error'}</Text>
              <Text style={styles.modalMessage}>{errorModal?.message ?? ''}</Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setErrorModal(null)}>
                <Text style={styles.modalButtonText}>OK</Text>
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
              <Text style={styles.modalTitle}>Password Reset!</Text>
              <Text style={styles.modalMessage}>
                Your password has been updated. Please log in.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setSuccessModal(false);
                  onBack();
                }}
              >
                <Text style={styles.modalButtonText}>Go to Login</Text>
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
