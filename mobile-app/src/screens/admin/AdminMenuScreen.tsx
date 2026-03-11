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
    title: 'Bonus Results',
    emoji: '🎯',
    navigateTo: 'AdminBonus',
    description: 'Enter correct answers and grade bonus predictions',
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
  const [creatingRandom, setCreatingRandom] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [generatingUsers, setGeneratingUsers] = useState(false);
  const [generatingDrawUsers, setGeneratingDrawUsers] = useState(false);

  const handleCreateRandomResults = (updateExisting: boolean) => {
    const action = updateExisting ? 'update' : 'create';
    Alert.alert(
      `🎲 ${updateExisting ? 'Update' : 'Create'} Random Group + 3rd Results`,
      `This will:\n` +
      `1. ${updateExisting ? 'Update' : 'Create'} random results for all groups (randomly shuffle teams 1-4)\n` +
      `2. ${updateExisting ? 'Update' : 'Create'} random third place qualifying results from 3rd place teams\n` +
      `3. Build Round of 32 bracket from the results\n\n` +
      `${updateExisting ? 'Existing results will be updated.' : 'Groups with existing results will be skipped unless you use the update button.'}\n\n` +
      `Continue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: updateExisting ? 'Update' : 'Create',
          style: 'default',
          onPress: async () => {
            setCreatingRandom(true);
            try {
              const result = await apiService.createRandomGroupAndThirdPlaceResults(updateExisting);
              
              let message = `✅ Success!\n\n`;
              message += `Groups:\n`;
              message += `  - Created: ${result.groups.created}\n`;
              message += `  - Updated: ${result.groups.updated}\n`;
              message += `  - Skipped: ${result.groups.skipped}\n`;
              message += `  - Errors: ${result.groups.errors}\n`;
              message += `  - Total: ${result.groups.total}\n\n`;
              message += `Third Place:\n`;
              message += `  - ${result.third_place.created ? 'Created' : 'Updated'}\n`;
              message += `  - Teams assigned: ${result.third_place.teams_assigned}\n\n`;
              message += `Round of 32 Bracket:\n`;
              if (result.bracket && result.bracket.built) {
                if (result.bracket.summary) {
                  message += `  - ✅ Built successfully\n`;
                  message += `  - Matches created: ${result.bracket.summary.matches_created || 0}\n`;
                  message += `  - Matches updated: ${result.bracket.summary.matches_updated || 0}\n`;
                  message += `  - Results created: ${result.bracket.summary.results_created || 0}\n`;
                  message += `  - Results updated: ${result.bracket.summary.results_updated || 0}`;
                } else {
                  message += `  - ✅ Built successfully`;
                }
              } else if (result.bracket && result.bracket.error) {
                message += `  - ⚠️ Warning: ${result.bracket.error}`;
              } else {
                message += `  - ⚠️ Not built`;
              }
              
              Alert.alert('Success', message);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not create random results');
            } finally {
              setCreatingRandom(false);
            }
          },
        },
      ]
    );
  };

  const handleRebuildRound32 = () => {
    Alert.alert(
      'Rebuild Round of 32 Bracket',
      'This will:\n' +
      '• Rebuild Round of 32 bracket from group and third place results\n' +
      '• Update Round of 32 prediction statuses\n' +
      '• Update prediction statuses for all subsequent knockout stages\n' +
      '• Update validity for all predictions (red/green indicators)\n\n' +
      'Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Rebuild',
          style: 'default',
          onPress: async () => {
            setRebuilding(true);
            try {
              const result = await apiService.rebuildRound32Bracket();
              let message = '✅ Round of 32 bracket rebuilt successfully!\n\n';
              if (result.bracket_summary) {
                message += `Bracket Summary:\n`;
                message += `  - Matches created: ${result.bracket_summary.matches_created || 0}\n`;
                message += `  - Matches updated: ${result.bracket_summary.matches_updated || 0}\n`;
                message += `  - Results created: ${result.bracket_summary.results_created || 0}\n`;
                message += `  - Results updated: ${result.bracket_summary.results_updated || 0}\n\n`;
              }
              message += 'Updates:\n';
              message += `  - Round 32 statuses: ${result.round32_statuses_updated ? '✅' : '❌'}\n`;
              message += `  - Subsequent statuses: ${result.subsequent_statuses_updated ? '✅' : '❌'}\n`;
              message += `  - Validity: ${result.validity_updated ? '✅' : '❌'}`;
              Alert.alert('Success', message);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not rebuild Round 32 bracket');
            } finally {
              setRebuilding(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateTestUsers = () => {
    Alert.alert(
      '👥 Generate Test Users',
      'Creates 50 fake users and fills all their predictions randomly.\n\n' +
      '• Match scores use weighted distribution (0 goals = 25%, 1 = 20%, etc.)\n' +
      '• Groups, third place, and knockout cascade automatically\n\n' +
      '⚠️ Use only in development!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'default',
          onPress: async () => {
            setGeneratingUsers(true);
            try {
              const result = await apiService.generateTestUsers(50);
              Alert.alert(
                '✅ Done!',
                `👤 Users created: ${result.created}\n` +
                `🎯 Predictions filled: ${result.predictions_filled}\n` +
                `❌ Errors: ${result.errors}`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not generate test users');
            } finally {
              setGeneratingUsers(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateDrawUsers = () => {
    Alert.alert(
      '🎯 Generate Draw Users',
      'Creates 50 fake users with draw-only match predictions.\n\n' +
      '• All match predictions are draws (0-0, 1-1, 2-2, 3-3)\n' +
      '• Groups, third place, and knockout cascade automatically\n\n' +
      '⚠️ Use only in development!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'default',
          onPress: async () => {
            setGeneratingDrawUsers(true);
            try {
              const result = await apiService.generateTestUsersDraws(50);
              Alert.alert(
                '✅ Done!',
                `👤 Users created: ${result.created}\n` +
                `🎯 Predictions filled: ${result.predictions_filled}\n` +
                `❌ Errors: ${result.errors}`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not generate draw test users');
            } finally {
              setGeneratingDrawUsers(false);
            }
          },
        },
      ]
    );
  };

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

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={[styles.quickActionButton, styles.generateTestUsersButton, (generatingUsers || generatingDrawUsers || deleting || creatingRandom || rebuilding) && styles.buttonDisabled]}
            onPress={handleGenerateTestUsers}
            disabled={generatingUsers || generatingDrawUsers || deleting || creatingRandom || rebuilding}
            activeOpacity={0.7}
          >
            <Text style={styles.quickActionButtonText}>
              {generatingUsers ? 'Generating...' : '👥 Generate 50 Test Users'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.generateDrawUsersButton, (generatingDrawUsers || generatingUsers || deleting || creatingRandom || rebuilding) && styles.buttonDisabled]}
            onPress={handleGenerateDrawUsers}
            disabled={generatingDrawUsers || generatingUsers || deleting || creatingRandom || rebuilding}
            activeOpacity={0.7}
          >
            <Text style={styles.quickActionButtonText}>
              {generatingDrawUsers ? 'Generating...' : '🎯 Generate 50 Draw Users'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.createRandomButton, (creatingRandom || deleting || rebuilding || generatingUsers || generatingDrawUsers) && styles.buttonDisabled]}
            onPress={() => handleCreateRandomResults(false)}
            disabled={creatingRandom || deleting || rebuilding || generatingUsers || generatingDrawUsers}
            activeOpacity={0.7}
          >
            <Text style={styles.quickActionButtonText}>
              {creatingRandom ? 'Creating...' : '🎲 Create Random Group + 3rd Results'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.rebuildButton, (rebuilding || deleting || creatingRandom || generatingUsers || generatingDrawUsers) && styles.buttonDisabled]}
            onPress={handleRebuildRound32}
            disabled={rebuilding || deleting || creatingRandom || generatingUsers || generatingDrawUsers}
            activeOpacity={0.7}
          >
            <Text style={styles.quickActionButtonText}>
              {rebuilding ? 'Rebuilding...' : '🔄 Rebuild Round 32 Bracket'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, (deleting || generatingUsers || generatingDrawUsers) && styles.deleteButtonDisabled]}
          onPress={handleDeleteAllResults}
          disabled={deleting || generatingUsers || generatingDrawUsers}
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
    marginBottom: 24,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 12,
  },
  quickActionButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateTestUsersButton: {
    backgroundColor: '#0d9488',
  },
  generateDrawUsersButton: {
    backgroundColor: '#0891b2',
  },
  createRandomButton: {
    backgroundColor: '#9333ea',
  },
  rebuildButton: {
    backgroundColor: '#2563eb',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  quickActionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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

