import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService } from '../services/api';
import * as Clipboard from 'expo-clipboard';

export default function CreateLeagueScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<any>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  const handleCreateLeague = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'League name is required');
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert('Error', 'League name must be at least 3 characters long');
      return;
    }
    if (name.trim().length > 100) {
      Alert.alert('Error', 'League name must be less than 100 characters');
      return;
    }
    if (description && description.length > 500) {
      Alert.alert('Error', 'Description must be less than 500 characters');
      return;
    }

    setLoading(true);
    try {
      const newLeague = await apiService.createLeague({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setCreatedLeague(newLeague);
    } catch (error: any) {
      const msg = error?.message ?? '';
      let userMessage = 'Something went wrong. Please try again.';
      if (msg.includes('400')) userMessage = 'Invalid league details. Please check and try again.';
      else if (msg.includes('409')) userMessage = 'A league with this name already exists.';
      else if (msg.includes('401') || msg.includes('403')) userMessage = 'You must be logged in to create a league.';
      Alert.alert('Could not create league', userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (createdLeague?.invite_code) {
      await Clipboard.setStringAsync(createdLeague.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
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
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          </View>
          <Text style={styles.successTitle}>League Created!</Text>
          <Text style={styles.successSubtitle}>
            Your league{' '}
            <Text style={styles.leagueNameHighlight}>{createdLeague.name}</Text>
            {' '}has been created successfully.
          </Text>

          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
            <View style={styles.inviteCodeBox}>
              <Text
                style={styles.inviteCode}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {createdLeague.invite_code}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyInviteCode}
                activeOpacity={0.8}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.shareText}>
            Share this code with friends to invite them to your league!
          </Text>

          <View style={styles.successButtons}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#16a34a" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
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
              <Text style={styles.label}>League Name *</Text>
              <TextInput
                style={[styles.input, nameFocused && styles.inputFocused]}
                value={name}
                onChangeText={setName}
                placeholder="Enter league name"
                placeholderTextColor="#9ca3af"
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <Text style={styles.characterCount}>{name.length}/100</Text>
            </View>

            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, descFocused && styles.inputFocused]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter league description"
                placeholderTextColor="#9ca3af"
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
              />
              <Text style={styles.characterCount}>{description.length}/500</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateLeague}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create League'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: '#16a34a',
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#16a34a',
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
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#bbf7d0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  leagueNameHighlight: {
    fontWeight: '700',
    color: '#16a34a',
  },
  inviteCodeContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#16a34a',
    width: '100%',
  },
  inviteCode: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 6,
    color: '#16a34a',
    fontFamily: 'monospace',
    flex: 1,
  },
  copyButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  copyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  shareText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  doneButton: {
    backgroundColor: '#16a34a',
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
    borderColor: '#16a34a',
  },
  shareButtonText: {
    color: '#16a34a',
    fontSize: 16,
    fontWeight: '600',
  },
});
