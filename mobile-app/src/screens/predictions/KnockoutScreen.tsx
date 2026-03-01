import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, Pressable, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/KnockoutMatchCard';
import BracketIcon from '../../components/icons/BracketIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';

interface KnockoutScreenProps {}

const STAGES = [
  { key: 'round32', name: 'Round of 32' },
  { key: 'round16', name: 'Round of 16' },
  { key: 'quarter', name: 'Quarter Final' },
  { key: 'semi', name: 'Semi Final' },
  { key: 'final', name: 'Final' },
];

const computeIsStageVisible = (
  stageKey: string,
  predsByStage: Record<string, KnockoutPrediction[]>,
  origWinners: Record<number, number>
): boolean => {
  const stageIndex = STAGES.findIndex(s => s.key === stageKey);
  if (stageIndex === 0) return true;
  for (let i = 0; i < stageIndex; i++) {
    const matches = predsByStage[STAGES[i].key] || [];
    const fullyKnown = matches.filter(m =>
      m.team1_name && m.team1_name !== 'TBD' && m.team1_name.trim() !== '' &&
      m.team2_name && m.team2_name !== 'TBD' && m.team2_name.trim() !== ''
    );
    if (fullyKnown.length === 0) return false;
    if (!fullyKnown.every(m => origWinners[m.id] !== undefined)) return false;
  }
  return true;
};

export default function KnockoutScreen({}: KnockoutScreenProps) {
  const navigation = useNavigation();
  const { getCurrentUserId } = useAuth();
  const { currentStage } = useTournament();
  const isEditable = currentStage === 'PRE_GROUP_STAGE';
  const isPreTournament = currentStage === 'PRE_GROUP_STAGE';

  const [showBracketPrompt, setShowBracketPrompt] = useState(false);
  const [showReadOnlyPrompt, setShowReadOnlyPrompt] = useState(false);
  const [hasEverPredictedFinal, setHasEverPredictedFinal] = useState(false);

  const [predictionsByStage, setPredictionsByStage] = useState<Record<string, KnockoutPrediction[]>>({
    round32: [],
    round16: [],
    quarter: [],
    semi: [],
    final: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [originalWinners, setOriginalWinners] = useState<{ [predictionId: number]: number }>({});
  const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
  const [unlockedStages, setUnlockedStages] = useState<Set<string>>(new Set(['round32']));
  const [touchedPredictions, setTouchedPredictions] = useState<Set<number>>(new Set());

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  const pendingScrollYRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingScrollYRef.current !== null && pendingScrollYRef.current > 0) {
      const y = pendingScrollYRef.current;
      pendingScrollYRef.current = null;
      scrollViewRef.current?.scrollTo({ y, animated: false });
    }
  });

  const fetchAllStages = useCallback(async (isRefresh = false) => {
    try {
      const earlyStageUpdateStr = await AsyncStorage.getItem('earlyStageUpdated');
      const shouldAutoRefresh = earlyStageUpdateStr !== null;

      if (shouldAutoRefresh && !isRefresh) {
        const updateData = JSON.parse(earlyStageUpdateStr);
        console.log(`🔄 Early stage (${updateData.stage}) was updated - auto-refreshing knockout`);
        await AsyncStorage.removeItem('earlyStageUpdated');
      }

      if (!isRefresh && !shouldAutoRefresh) {
        setLoading(true);
      }

      const userId = getCurrentUserId();
      if (!userId) {
        return;
      }

      const results = await Promise.all(
        STAGES.map(({ key }) => apiService.getKnockoutPredictions(userId, key))
      );

      const newPredictionsByStage: Record<string, KnockoutPrediction[]> = {};
      const originalMap: { [predictionId: number]: number } = {};

      STAGES.forEach(({ key }, index) => {
        newPredictionsByStage[key] = results[index].predictions || [];
        (results[index].predictions || []).forEach((p: KnockoutPrediction) => {
          if (p.winner_team_id) originalMap[p.id] = p.winner_team_id;
        });
      });

      setPredictionsByStage(newPredictionsByStage);
      setOriginalWinners(originalMap);

      const finalPredictions = newPredictionsByStage['final'] || [];
      const finalHasPrediction = finalPredictions.some(p => originalMap[p.id] !== undefined);
      if (finalHasPrediction) {
        setHasEverPredictedFinal(prev => (prev ? prev : true));
      }

      setUnlockedStages(prev => {
        const next = new Set(prev);
        STAGES.forEach(({ key }) => {
          if (computeIsStageVisible(key, newPredictionsByStage, originalMap)) {
            next.add(key);
          }
        });
        return next;
      });

      const lastResult = results[results.length - 1];
      setKnockoutScore(lastResult?.knockout_score ?? null);

      const bracketUpdatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
      const bracketUpdatedMatches = JSON.parse(bracketUpdatedMatchesStr);
      if (bracketUpdatedMatches.length > 0) {
        const allMatchIds = STAGES.flatMap(s => (newPredictionsByStage[s.key] || []).map((p: KnockoutPrediction) => p.template_match_id));
        const remainingUpdates = bracketUpdatedMatches.filter(
          (u: any) => !allMatchIds.includes(u.matchId)
        );
        await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(remainingUpdates));
      }
    } catch (error) {
      console.error('Error fetching knockout predictions:', error);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId]);

  useEffect(() => {
    fetchAllStages();
  }, [fetchAllStages]);

  useFocusEffect(
    React.useCallback(() => {
      const checkAndRefresh = async () => {
        try {
          const earlyStageUpdateStr = await AsyncStorage.getItem('earlyStageUpdated');
          if (earlyStageUpdateStr !== null) {
            await fetchAllStages(true);
          }
        } catch (error) {
          console.error('Error checking early stage update:', error);
        }
      };
      checkAndRefresh();
    }, [fetchAllStages])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllStages(true).finally(() => setRefreshing(false));
  }, [fetchAllStages]);

  const isStageComplete = useCallback((stageKey: string): boolean => {
    const matches = predictionsByStage[stageKey] || [];
    const fullyKnownMatches = matches.filter(m => {
      const t1Known = m.team1_name && m.team1_name !== 'TBD' && m.team1_name.trim() !== '';
      const t2Known = m.team2_name && m.team2_name !== 'TBD' && m.team2_name.trim() !== '';
      return t1Known && t2Known;
    });
    if (fullyKnownMatches.length === 0) return false;
    return fullyKnownMatches.every(m => originalWinners[m.id] !== undefined);
  }, [predictionsByStage, originalWinners]);

  const isStageVisible = useCallback((stageKey: string): boolean => {
    return unlockedStages.has(stageKey);
  }, [unlockedStages]);

  const isNextLockedStage = useCallback((stageKey: string): boolean => {
    const stageIndex = STAGES.findIndex(s => s.key === stageKey);
    if (stageIndex === 0) return false;
    const prevKey = STAGES[stageIndex - 1].key;
    return unlockedStages.has(prevKey) && !isStageComplete(prevKey);
  }, [unlockedStages, isStageComplete]);

  const handleTeamPress = useCallback(async (
    prediction: KnockoutPrediction,
    teamId: number
  ) => {
    if (!isEditable) {
      setShowReadOnlyPrompt(true);
      return;
    }
    const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
    if (teamId === prediction.team1_id && isTBD(prediction.team1_name)) return;
    if (teamId === prediction.team2_id && isTBD(prediction.team2_name)) return;

    const teamNumber = prediction.team1_id === teamId ? 1 : 2;
    const teamName = teamNumber === 1 ? prediction.team1_name : prediction.team2_name;
    if (!teamName) return;

    if (originalWinners[prediction.id] === teamId) return;

    setOriginalWinners(prev => ({ ...prev, [prediction.id]: teamId }));

    try {
      const userId = getCurrentUserId();
      if (!userId) return;

      // Check if this is the first final prediction — BEFORE fetch changes state
      const isFirstFinalPrediction =
        prediction.stage === 'final' && !hasEverPredictedFinal;

      await apiService.updateBatchKnockoutPredictions(userId, [{
        prediction_id: prediction.id,
        winner_team_number: teamNumber,
        winner_team_name: teamName,
      }]);

      const savedScrollY = scrollPositionRef.current;
      pendingScrollYRef.current = savedScrollY;
      await fetchAllStages(true);

      setTouchedPredictions(prev => {
        if (prev.has(prediction.id)) return prev;
        const next = new Set(prev);
        next.add(prediction.id);
        return next;
      });

      // Show prompt after fetch, using the pre-fetch flag
      if (isFirstFinalPrediction) {
        setShowBracketPrompt(true);
      }
    } catch (error) {
      console.error('Error saving knockout prediction:', error);
      setOriginalWinners(prev => {
        const reverted = { ...prev };
        delete reverted[prediction.id];
        return reverted;
      });
    }
  }, [isEditable, originalWinners, getCurrentUserId, fetchAllStages, hasEverPredictedFinal]);

  const renderMatch = useCallback((prediction: KnockoutPrediction) => (
    <KnockoutMatchCard
      key={prediction.id}
      prediction={prediction}
      onTeamPress={(teamId) => handleTeamPress(prediction, teamId)}
      originalWinner={originalWinners[prediction.id]}
      isTouched={touchedPredictions.has(prediction.id)}
      isPreTournament={isPreTournament}
    />
  ), [originalWinners, handleTeamPress, touchedPredictions, isPreTournament]);

  const hasAnyResult = Object.values(predictionsByStage).flat().some(
    p => p.is_correct !== null && p.is_correct !== undefined
  );
  const showPoints = hasAnyResult && knockoutScore !== null;

  const renderSectionHeader = (stageName: string, isFirst: boolean = false, isLocked: boolean = false) => (
    <View style={[
      styles.sectionHeader,
      { marginTop: isFirst ? 0 : 20, marginBottom: 12 },
    ]}>
      <View style={[styles.sectionHeaderPill, isLocked && styles.sectionHeaderPillLocked]}>
        <Text style={styles.sectionHeaderText}>{stageName}</Text>
      </View>
    </View>
  );

  const renderLockedPlaceholder = (stageName: string) => (
    <View key={`locked-${stageName}`}>
      {renderSectionHeader(stageName, false, true)}
      <View style={styles.lockedPlaceholder}>
        <View style={styles.lockedIconBadge}>
          <Ionicons name="lock-closed" size={16} color="#64748b" />
        </View>
        <Text style={styles.lockedPlaceholderTitle}>Predict all matches above</Text>
        <Text style={styles.lockedPlaceholderSubtitle}>
          Complete the current round to unlock the next stage
        </Text>
      </View>
    </View>
  );

  const renderStageSection = (stageKey: string, stageName: string) => {
    if (!isStageVisible(stageKey) && !isNextLockedStage(stageKey)) {
      return null;
    }

    if (!isStageVisible(stageKey) && isNextLockedStage(stageKey)) {
      return renderLockedPlaceholder(stageName);
    }

    const predictions = predictionsByStage[stageKey] || [];
    const isFirst = stageKey === 'round32';
    return (
      <View style={styles.sectionWrapper} key={stageKey}>
        {renderSectionHeader(stageName, isFirst)}
        {predictions.map(p => renderMatch(p))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading knockout predictions...</Text>
      </View>
    );
  }

  const showHeader = true;

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.bracketButton}
              onPress={() => navigation.navigate('Bracket' as never)}
            >
              <View style={styles.bracketButtonIcon}>
                <BracketIcon size={18} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            {showPoints && (
              <View style={styles.pointsContainer}>
                <Text style={styles.totalPoints}>{knockoutScore} pts</Text>
              </View>
            )}
          </View>
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollPositionRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16a34a']} />
        }
      >
        {STAGES.map(({ key, name }) => renderStageSection(key, name))}
      </ScrollView>

      <Modal visible={showBracketPrompt} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBracketPrompt(false)}
        >
          <View style={styles.modalCard}>
            <BracketIcon size={48} color="#16a34a" />
            <Text style={styles.modalTitle}>Bracket Complete!</Text>
            <Text style={styles.modalSubtitle}>
              Your full tournament bracket is ready. Want to view it?
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => {
              setShowBracketPrompt(false);
              navigation.navigate('Bracket' as never);
            }}>
              <Text style={styles.modalButtonText}>View Bracket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowBracketPrompt(false)}>
              <Text style={styles.modalButtonSecondaryText}>Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showReadOnlyPrompt} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowReadOnlyPrompt(false)}
        >
          <View style={styles.modalCard}>
            <BracketIcon size={48} color="#64748b" />
            <Text style={styles.modalTitle}>Edit via Bracket</Text>
            <Text style={styles.modalSubtitle}>
              To edit your knockout predictions, use the Bracket screen where you can manage the full tournament path.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => {
              setShowReadOnlyPrompt(false);
              navigation.navigate('Bracket' as never);
            }}>
              <Text style={styles.modalButtonText}>Open Bracket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowReadOnlyPrompt(false)}>
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0fdf4',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bracketButton: {
    backgroundColor: '#7c3aed',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  bracketButtonIcon: {
    marginLeft: 6,
  },
  pointsContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 0,
  },
  sectionHeader: {
    alignItems: 'center',
  },
  sectionHeaderPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
  },
  sectionHeaderPillLocked: {
    backgroundColor: '#94a3b8',
  },
  sectionHeaderText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionWrapper: {
    marginBottom: 8,
  },
  lockedPlaceholder: {
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  lockedIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  lockedPlaceholderTitle: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedPlaceholderSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#718096',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalButtonSecondary: {
    paddingVertical: 10,
  },
  modalButtonSecondaryText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
