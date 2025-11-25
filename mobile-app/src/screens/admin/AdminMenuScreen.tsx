import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AdminStackParamList } from '../../navigation/AdminNavigator';
import { apiService } from '../../services/api';

type NavigationProp = StackNavigationProp<AdminStackParamList, 'AdminMenu'>;

const adminOptions: Array<{
  title: string;
  emoji: string;
  navigateTo: keyof AdminStackParamList;
  description: string;
}> = [
  {
    title: 'Match Results',
    emoji: '⚽',
    navigateTo: 'AdminMatches',
    description: 'Update match results and status',
  },
  {
    title: 'Group Results',
    emoji: '🏆',
    navigateTo: 'AdminGroups',
    description: 'Update group stage standings',
  },
  {
    title: 'Third Place',
    emoji: '🥉',
    navigateTo: 'AdminThirdPlace',
    description: 'Update third place qualifiers',
  },
  {
    title: 'Knockout Results',
    emoji: '🎯',
    navigateTo: 'AdminKnockout',
    description: 'Update knockout matches with extra time & penalties',
  },
  {
    title: 'Stage Management',
    emoji: '📅',
    navigateTo: 'AdminStage',
    description: 'Manage tournament stage',
  },
];

export default function AdminMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAllResults = () => {
    Alert.alert(
      '⚠️ Delete All Results',
      'This will permanently delete ALL results:\n\n' +
      '• All match results\n' +
      '• All group stage results\n' +
      '• All third place results\n' +
      '• All knockout stage results\n' +
      '• Reset all user scores to zero\n' +
      '• Reset all prediction points to zero\n' +
      '• Reset all match statuses to scheduled\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiService.deleteAllResults();
              Alert.alert(
                '✅ Success',
                'All results have been deleted successfully.',
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              Alert.alert(
                '❌ Error',
                error.message || 'Failed to delete all results',
                [{ text: 'OK' }]
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.heading}>Admin Panel</Text>
          <Text style={styles.subheading}>Manage tournament results and settings</Text>
        </View>

        <View style={styles.optionsContainer}>
          {adminOptions.map((option) => (
            <TouchableOpacity
              key={option.title}
              style={styles.optionCard}
              onPress={() => navigation.navigate(option.navigateTo)}
              activeOpacity={0.85}
            >
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{option.emoji}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{option.title}</Text>
                <Text style={styles.description}>{option.description}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
          onPress={handleDeleteAllResults}
          disabled={deleting}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>
            {deleting ? 'Deleting...' : '🗑️ Delete All Results'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '400',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
  },
  arrow: {
    fontSize: 24,
    color: '#94a3b8',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

