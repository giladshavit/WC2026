import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';

interface StageInfo {
  stage: string;
  stage_value: number;
  penalty: number;
}

const ALL_STAGES = [
  { name: 'PRE_GROUP_STAGE', label: 'Pre Group Stage', value: 0, penalty: 0 },
  { name: 'GROUP_CYCLE_1', label: 'Group Cycle 1', value: 1, penalty: 1 },
  { name: 'GROUP_CYCLE_2', label: 'Group Cycle 2', value: 2, penalty: 2 },
  { name: 'GROUP_CYCLE_3', label: 'Group Cycle 3', value: 3, penalty: 3 },
  { name: 'PRE_ROUND32', label: 'Pre Round of 32', value: 4, penalty: 4 },
  { name: 'ROUND32', label: 'Round of 32', value: 5, penalty: 5 },
  { name: 'PRE_ROUND16', label: 'Pre Round of 16', value: 6, penalty: 6 },
  { name: 'ROUND16', label: 'Round of 16', value: 7, penalty: 7 },
  { name: 'PRE_QUARTER', label: 'Pre Quarter Final', value: 8, penalty: 8 },
  { name: 'QUARTER', label: 'Quarter Final', value: 9, penalty: 9 },
  { name: 'SEMI', label: 'Semi Final', value: 10, penalty: 10 },
  { name: 'FINAL', label: 'Final', value: 11, penalty: 11 },
];

export default function AdminStageScreen() {
  const [currentStage, setCurrentStage] = useState<StageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCurrentStage();
  }, []);

  const fetchCurrentStage = async () => {
    try {
      const data = await apiService.getCurrentStage();
      setCurrentStage(data);
    } catch (error) {
      console.error('Error fetching current stage:', error);
      Alert.alert('Error', `Could not load stage: ${error}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCurrentStage();
  };

  const handleAdvanceStage = () => {
    Alert.alert(
      'Advance Stage',
      'Are you sure you want to advance to the next tournament stage?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Advance',
          style: 'default',
          onPress: async () => {
            setUpdating(true);
            try {
              const result = await apiService.advanceStage();
              Alert.alert('Success', `Stage advanced to ${result.stage}`);
              fetchCurrentStage();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not advance stage');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleSelectStage = (stageName: string) => {
    Alert.alert(
      'Change Stage',
      `Are you sure you want to change the stage to ${stageName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Change',
          style: 'default',
          onPress: async () => {
            setUpdating(true);
            try {
              const result = await apiService.updateStage(stageName);
              Alert.alert('Success', `Stage updated to ${result.stage}`);
              fetchCurrentStage();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not update stage');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleResetStage = () => {
    Alert.alert(
      'Reset Stage',
      '⚠️ WARNING: This will reset the tournament stage to the beginning and make all predictions editable!\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const result = await apiService.resetStage();
              Alert.alert('Success', `Stage reset to ${result.stage}`);
              fetchCurrentStage();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not reset stage');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const getCurrentStageIndex = () => {
    if (!currentStage) return -1;
    return ALL_STAGES.findIndex(s => s.name === currentStage.stage);
  };

  const canAdvance = () => {
    const currentIndex = getCurrentStageIndex();
    return currentIndex >= 0 && currentIndex < ALL_STAGES.length - 1;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading stage info...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentIndex = getCurrentStageIndex();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Current Stage Card */}
        <View style={styles.currentStageCard}>
          <Text style={styles.sectionTitle}>Current Stage</Text>
          {currentStage ? (
            <View>
              <Text style={styles.currentStageName}>{currentStage.stage}</Text>
              <Text style={styles.currentStageLabel}>
                {ALL_STAGES.find(s => s.name === currentStage.stage)?.label || currentStage.stage}
              </Text>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Stage Value:</Text>
                  <Text style={styles.infoValue}>{currentStage.stage_value}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Penalty:</Text>
                  <Text style={styles.infoValue}>{currentStage.penalty} pts</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>No stage information available</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.advanceButton, (!canAdvance() || updating) && styles.buttonDisabled]}
            onPress={handleAdvanceStage}
            disabled={!canAdvance() || updating}
          >
            <Text style={styles.actionButtonText}>
              {updating ? 'Updating...' : '➡️ Advance to Next Stage'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton, updating && styles.buttonDisabled]}
            onPress={handleResetStage}
            disabled={updating}
          >
            <Text style={styles.actionButtonText}>
              {updating ? 'Resetting...' : '🔄 Reset to Beginning'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* All Stages List */}
        <View style={styles.stagesCard}>
          <Text style={styles.sectionTitle}>All Stages</Text>
          <Text style={styles.sectionSubtitle}>Tap a stage to change to it</Text>
          {ALL_STAGES.map((stage, index) => {
            const isCurrent = currentIndex === index;
            const isPast = currentIndex > index;
            const isFuture = currentIndex < index;

            return (
              <TouchableOpacity
                key={stage.name}
                style={[
                  styles.stageItem,
                  isCurrent && styles.stageItemCurrent,
                  isPast && styles.stageItemPast,
                  isFuture && styles.stageItemFuture,
                ]}
                onPress={() => handleSelectStage(stage.name)}
                disabled={isCurrent || updating}
              >
                <View style={styles.stageItemContent}>
                  <View style={styles.stageItemLeft}>
                    {isCurrent && <Text style={styles.currentIndicator}>●</Text>}
                    {isPast && <Text style={styles.pastIndicator}>✓</Text>}
                    {isFuture && <Text style={styles.futureIndicator}>○</Text>}
                    <View>
                      <Text style={[styles.stageItemName, isCurrent && styles.stageItemNameCurrent]}>
                        {stage.label}
                      </Text>
                      <Text style={styles.stageItemValue}>
                        Value: {stage.value} | Penalty: {stage.penalty} pts
                      </Text>
                    </View>
                  </View>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  scrollContent: {
    padding: 16,
  },
  currentStageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  currentStageName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4,
  },
  currentStageLabel: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontStyle: 'italic',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  advanceButton: {
    backgroundColor: '#2563eb',
  },
  resetButton: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  stagesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  stageItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stageItemCurrent: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  stageItemPast: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  stageItemFuture: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.7,
  },
  stageItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currentIndicator: {
    fontSize: 20,
    color: '#dc2626',
    marginRight: 12,
  },
  pastIndicator: {
    fontSize: 20,
    color: '#22c55e',
    marginRight: 12,
  },
  futureIndicator: {
    fontSize: 20,
    color: '#94a3b8',
    marginRight: 12,
  },
  stageItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  stageItemNameCurrent: {
    color: '#dc2626',
  },
  stageItemValue: {
    fontSize: 12,
    color: '#64748b',
  },
  currentBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
