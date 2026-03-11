import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService } from '../../services/api';
import { ErrorModal } from '../../components/modals/CustomModals';
import { useToast } from '../../components/toast/Toast';

const CONFETTI = [
  { color: '#2563eb', style: { top: -4, left: -4 } },
  { color: '#f59e0b', style: { top: -4, right: -4 } },
  { color: '#3b82f6', style: { bottom: -4, left: -4 } },
  { color: '#ef4444', style: { bottom: -4, right: -4 } },
];

export default function JoinLeagueScreen() {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [joinedLeague, setJoinedLeague] = useState<{ league_name: string } | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const handleJoinLeague = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      setErrorModal({
        title: 'Error',
        message: 'Invite code must be exactly 8 uppercase letters and numbers',
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: suppress global error toast if apiService has one
      const result = await apiService.joinLeague(code);
      setJoinedLeague(result);
    } catch (error: any) {
      const msg = error?.message ?? '';
      let userMessage = 'Something went wrong. Please try again.';
      if (msg.includes('404')) userMessage = 'Invalid or inactive invite code.';
      else if (msg.includes('400') || msg.toLowerCase().includes('already')) userMessage = 'You are already a member of this league.';
      else if (msg.includes('401') || msg.includes('403')) userMessage = 'You must be logged in to join a league.';
      setErrorModal({ title: 'Could not join league', message: userMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
  };

  const isReady = inviteCode.length === 8 && !loading;

  if (joinedLeague) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            {CONFETTI.map((c, i) => (
              <View
                key={i}
                style={[styles.confettiDot, { backgroundColor: c.color }, c.style]}
              />
            ))}
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>Joined Successfully!</Text>
          <Text style={styles.successSubtitle}>
            Welcome to{' '}
            <Text style={{ fontWeight: '700', color: '#1d4ed8' }}>
              {joinedLeague.league_name}
            </Text>
            !
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => (navigation as any).navigate('LeaguesMain', {
              showToast: 'Joined league successfully!'
            })}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Let's Go!</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner card */}
          <View style={styles.bannerCard}>
            <Ionicons name="people-circle-outline" size={52} color="#93c5fd" />
            <Text style={styles.bannerTitle}>Enter your invite code</Text>
            <Text style={styles.bannerSubtitle}>
              Get the 8-character code from your league creator
            </Text>
          </View>

          {/* Code input */}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, codeFocused && styles.inputFocused]}
              value={inviteCode}
              onChangeText={handleCodeChange}
              placeholder="ABCD1234"
              placeholderTextColor="#cbd5e1"
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              keyboardType="default"
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
            />
            {/* Dot progress */}
            <View style={styles.dotsRow}>
              {Array(8).fill(0).map((_, i) => (
                <View
                  key={i}
                  style={i < inviteCode.length ? styles.dotFilled : styles.dotEmpty}
                />
              ))}
            </View>
          </View>

          {/* Join button */}
          <TouchableOpacity
            style={[styles.joinButton, !isReady && styles.joinButtonDisabled]}
            onPress={handleJoinLeague}
            disabled={!isReady}
            activeOpacity={0.8}
          >
            {!isReady && !loading && (
              <Ionicons name="lock-closed" size={16} color="#ffffff" />
            )}
            <Text style={styles.joinButtonText}>
              {loading ? 'Joining...' : 'Join League'}
            </Text>
            {isReady && (
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
      />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  // Banner
  bannerCard: {
    backgroundColor: 'rgba(51,65,85,0.6)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  // Input
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0f2744',
    borderWidth: 2,
    borderColor: '#2d4a6e',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 22,
    fontSize: 32,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 6,
  },
  inputFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#0d1f3c',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  dotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    margin: 3,
  },
  dotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e2e8f0',
    margin: 3,
  },
  // Button
  joinButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(51,65,85,0.6)',
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  doneButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 14,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
