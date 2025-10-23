import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/api';

export default function JoinLeagueScreen() {
  const navigation = useNavigation();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinLeague = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    const code = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      Alert.alert('Error', 'Invite code must be exactly 8 uppercase letters and numbers');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.joinLeague(code);
      
      Alert.alert(
        'Success!',
        `You have successfully joined "${result.league_name}"!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error joining league:', error);
      
      let errorMessage = 'Failed to join league';
      if (error.message) {
        if (error.message.includes('404')) {
          errorMessage = 'Invalid or inactive invite code';
        } else if (error.message.includes('400')) {
          errorMessage = 'You are already a member of this league';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Convert to uppercase and limit to 8 characters
    const upperText = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setInviteCode(upperText);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Join League</Text>
            <Text style={styles.subtitle}>
              Enter the 8-character invite code to join a league
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite Code</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={handleCodeChange}
                placeholder="ABCD1234"
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                keyboardType="default"
              />
              <Text style={styles.characterCount}>
                {inviteCode.length}/8 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (!inviteCode || inviteCode.length !== 8 || loading) && styles.joinButtonDisabled
              ]}
              onPress={handleJoinLeague}
              disabled={!inviteCode || inviteCode.length !== 8 || loading}
            >
              <Text style={styles.joinButtonText}>
                {loading ? 'Joining...' : 'Join League'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>How to get an invite code?</Text>
            <Text style={styles.helpText}>
              • Ask a friend who created a league for their invite code{'\n'}
              • The code is 8 characters long (letters and numbers){'\n'}
              • Make sure to enter it exactly as provided
            </Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    color: '#333',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 2,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
