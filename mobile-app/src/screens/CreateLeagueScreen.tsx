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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/api';
import * as Clipboard from 'expo-clipboard';

export default function CreateLeagueScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<any>(null);

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
      const leagueData = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      const newLeague = await apiService.createLeague(leagueData);
      setCreatedLeague(newLeague);
    } catch (error: any) {
      console.error('Error creating league:', error);
      Alert.alert('Error', error.message || 'Failed to create league');
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

  const handleDone = () => {
    navigation.goBack();
  };

  if (createdLeague) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>League Created!</Text>
          <Text style={styles.successSubtitle}>
            Your league "{createdLeague.name}" has been created successfully.
          </Text>

          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCode}>{createdLeague.invite_code}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyInviteCode}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.shareText}>
            Share this code with friends to invite them to your league!
          </Text>

          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Create League</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>League Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter league name"
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={styles.characterCount}>
                {name.length}/100 characters
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter league description"
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {description.length}/500 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreateLeague}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Creating...' : 'Create League'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inviteCodeContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  inviteCode: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  shareText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
