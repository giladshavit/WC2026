import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Share,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService } from '../../services/api';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal } from '../../components/modals/CustomModals';

export default function CreateLeagueScreen() {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scoreMode, setScoreMode] = useState<'multi' | 'classic'>('multi');
  const [loading, setLoading] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<any>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const handleCreateLeague = async () => {
    setNameError(null);
    if (!name.trim()) {
      setNameError('League name is required');
      return;
    }
    if (name.trim().length < 3) {
      setNameError('League name must be at least 3 characters');
      return;
    }
    if (name.trim().length > 100) {
      setNameError('League name must be less than 100 characters');
      return;
    }
    if (description && description.length > 500) {
      setNameError('Description must be less than 500 characters');
      return;
    }

    setLoading(true);
    try {
      const newLeague = await apiService.createLeague({
        name: name.trim(),
        description: description.trim() || undefined,
        score_mode: scoreMode,
      });
      setCreatedLeague(newLeague);
    } catch (error: any) {
      const msg = error?.message ?? '';
      let userMessage = 'Something went wrong. Please try again.';
      if (msg.includes('400')) userMessage = 'Invalid league details. Please check and try again.';
      else if (msg.includes('409')) userMessage = 'A league with this name already exists.';
      else if (msg.includes('401') || msg.includes('403')) userMessage = 'You must be logged in to create a league.';
      setErrorModal({ title: 'Could not create league', message: userMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (createdLeague?.invite_code) {
      await Clipboard.setStringAsync(createdLeague.invite_code);
      showToast('Code copied!', 'success');
    }
  };

  const handleShare = async () => {
    if (createdLeague?.invite_code) {
      await Share.share({
        message: `Join my Predicto league! Code: ${createdLeague.invite_code}`,
      });
    }
  };

  if (createdLeague) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>League Created!</Text>
          <Text style={styles.successSubtitle}>
            Your league{' '}
            <Text style={styles.leagueNameHighlight}>{createdLeague.name}</Text>
            {' '}has been created successfully.
          </Text>

          <View style={styles.inviteCodeSection}>
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
              <View style={styles.inviteCodeBox}>
                <TouchableOpacity
                  style={styles.copyIconInBox}
                  onPress={handleCopyInviteCode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="copy-outline" size={20} color="#93c5fd" />
                </TouchableOpacity>
                <View style={styles.inviteCodeTextCenter}>
                  <Text
                    style={styles.inviteCodeText}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.5}
                  >
                    {createdLeague.invite_code}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.shareText}>
            Share this code with friends to invite them to your league!
          </Text>

          <View style={styles.successButtons}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                (navigation as any).navigate('LeaguesMain', {
                  showToast: 'League created successfully!',
                  refreshLeagues: true,
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#1d4ed8" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.2}>League Name *</Text>
              <TextInput
                style={[styles.input, nameFocused && styles.inputFocused]}
                value={name}
                onChangeText={(t) => { setName(t); setNameError(null); }}
                placeholder="Enter league name"
                placeholderTextColor="#64748b"
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <View style={styles.inputFooterRow}>
                <Text style={[styles.fieldError, !nameError && styles.fieldErrorHidden]}>
                  {nameError ?? ' '}
                </Text>
                <Text style={styles.characterCount}>{name.length}/100</Text>
              </View>
            </View>

            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.label} maxFontSizeMultiplier={1.2}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, descFocused && styles.inputFocused]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter league description"
                placeholderTextColor="#64748b"
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
              />
              <Text style={styles.characterCount}>{description.length}/500</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.2}>Default View Mode</Text>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    scoreMode === 'multi'
                      ? { backgroundColor: 'rgba(251,191,36,0.18)', borderColor: '#f59e0b' }
                      : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                  ]}
                  onPress={() => setScoreMode('multi')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trophy-outline" size={14} color={scoreMode === 'multi' ? '#f59e0b' : '#64748b'} />
                  <Text
                    style={[styles.modeBtnText, scoreMode === 'multi' ? { color: '#f59e0b', fontWeight: '700' } : {}]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Multi Mode
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    scoreMode === 'classic'
                      ? { backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8' }
                      : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                  ]}
                  onPress={() => setScoreMode('classic')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="football-outline" size={14} color={scoreMode === 'classic' ? '#38bdf8' : '#64748b'} />
                  <Text
                    style={[styles.modeBtnText, scoreMode === 'classic' ? { color: '#38bdf8', fontWeight: '700' } : {}]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Classic Mode
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 8, marginHorizontal: 4, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#38bdf8', flexShrink: 0, marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: '#94a3b8', flexShrink: 1 }} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                    <Text style={{ color: '#38bdf8', fontWeight: '700' }}>Classic</Text>
                    {' — Matches + Bonus'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: '#94a3b8', flexShrink: 1 }} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                    <Text style={{ color: '#f59e0b', fontWeight: '700' }}>Multi</Text>
                    {' — All predictions'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled, { marginTop: 8 }]}
              onPress={handleCreateLeague}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.createButtonText} maxFontSizeMultiplier={1.2}>
                {loading ? 'Creating...' : 'Create League'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title}
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  formCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#2d4a6e',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#0f2744',
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f1f5f9',
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: '#2563eb',
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success screen
  successContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  leagueNameHighlight: {
    fontWeight: '700',
    color: '#93c5fd',
  },
  inviteCodeSection: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    marginVertical: 24,
  },
  inviteCodeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  inviteCodeBox: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#475569',
    width: '100%',
    minHeight: 100,
    position: 'relative',
  },
  copyIconInBox: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'transparent',
    padding: 4,
    borderRadius: 20,
  },
  inviteCodeTextCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  inviteCodeText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    width: '100%',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  shareText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  doneButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
  },
  shareButtonText: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '600',
  },
  inputFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 4,
  },
  fieldErrorHidden: {
    color: 'transparent',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    backgroundColor: '#0f2744',
  },
  modeBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
});
