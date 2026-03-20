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
import { useAuth } from '../../contexts/AuthContext';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { register } = useAuth();

  const scrollToInput = (yPosition: number) => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  };

  const validateForm = (): string | null => {
    if (!username.trim() || !password.trim() || !name.trim()) {
      return 'Please fill in all fields';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (username.length > 15) {
      return 'Username must be 15 characters or less';
    }
    if (name.length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.length > 15) {
      return 'Name must be 15 characters or less';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
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
      await register(username.trim(), password, name.trim());
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('400') || err.message.toLowerCase().includes('exist') || err.message.toLowerCase().includes('taken') || err.message.toLowerCase().includes('already')) {
          msg = 'This username is already taken. Please choose a different one.';
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
                maxLength={15}
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
                placeholder="Enter username (at least 3 characters)"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={15}
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
                onFocus={() => { setFocusedInput('password'); scrollToInput(160); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter password (at least 6 characters)"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
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
                onFocus={() => { setFocusedInput('confirmPassword'); scrollToInput(240); }}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter password again"
                placeholderTextColor="#64748b"
                textContentType="oneTimeCode"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
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

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={onSwitchToLogin} disabled={isLoading}>
                <Text style={styles.switchLink}>Login here</Text>
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
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
