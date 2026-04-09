import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/cards/KnockoutMatchCard';
import BracketIcon from '../../components/icons/BracketIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal, InfoModal } from '../../components/modals/CustomModals';

interface KnockoutScreenProps {}

const STAGES = [
  { key: 'round32', name: 'Round of 32' },
  { key: 'round16', name: 'Round of 16' },
  { key: 'quarter', name: 'Quarter Final' },
  { key: 'semi', name: 'Semi Final' },
  { key: 'final', name: 'Final' },
];

const ACTIVE_KNOCKOUT_STAGES = ['ROUND32', 'ROUND16', 'QUARTER', 'SEMI', 'FINAL'];

const STAGE_VALUES: Record<string, number> = {
  PRE_GROUP_STAGE: 0,
  GROUP_CYCLE_1: 1,
  GROUP_CYCLE_2: 2,
  GROUP_CYCLE_3: 3,
  PRE_ROUND32: 4,
  ROUND32: 5,
  PRE_ROUND16: 6,
  ROUND16: 7,
  PRE_QUARTER: 8,
  QUARTER: 9,
  SEMI: 10,
  FINAL: 11,
};

const STAGE_KEY_TO_VALUE: Record<string, number> = {
  round32: 5,
  round16: 7,
  quarter: 9,
  semi: 10,
  final: 11,
};

const STAGE_ORDER = ['round32', 'round16', 'quarter', 'semi', 'final'];

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
  const isPreTournament = currentStage === 'PRE_GROUP_STAGE';
  const isPostGroupStage = currentStage != null &&
    currentStage !== 'PRE_GROUP_STAGE' &&
    !['GROUP_CYCLE_1', 'GROUP_CYCLE_2', 'GROUP_CYCLE_3'].includes(currentStage);

  const isStageKeyEditable = useCallback((stageKey: string): boolean => {
    if (!currentStage) return false;
    const stageUpper = currentStage.toUpperCase();

    if (ACTIVE_KNOCKOUT_STAGES.includes(stageUpper)) return false;

    const currentValue = STAGE_VALUES[stageUpper] ?? 0;
    const predStageValue = STAGE_KEY_TO_VALUE[stageKey] ?? 0;

    return predStageValue > currentValue;
  }, [currentStage]);

  const { showToast } = useToast();
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [hasEverPredictedFinal, setHasEverPredictedFinal] = useState(false);
  const [showBracketCompleteModal, setShowBracketCompleteModal] = useState(false);
  const [showBracketModal, setShowBracketModal] = useState(false);
  const [showLegendModal, setShowLegendModal] = useState(false);

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
  const [knockoutPenalty, setKnockoutPenalty] = useState<number>(0);
  const [showNetScore, setShowNetScore] = useState(false);
  const [unlockedStages, setUnlockedStages] = useState<Set<string>>(new Set(['round32']));
  const unlockedStagesRef = useRef<Set<string>>(new Set(['round32']));
  const predictionsByStageRef = useRef<Record<string, KnockoutPrediction[]>>({ round32: [], round16: [], quarter: [], semi: [], final: [] });
  const originalWinnersRef = useRef<{ [predictionId: number]: number }>({});
  const [touchedPredictions, setTouchedPredictions] = useState<Set<number>>(new Set());

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  const pendingScrollYRef = useRef<number | null>(null);
  const stageSectionYRef = useRef<Record<string, number>>({});
  const hasAutoScrolledRef = useRef(false);
  /** Full-screen fetch generation; invalidated when a partial refresh starts. */
  const fetchAllGenRef = useRef(0);
  /** Partial refresh (after PUT) generation; invalidated when a full fetch starts. */
  const fetchStagesGenRef = useRef(0);
  const handleTeamPressRef = useRef<(prediction: KnockoutPrediction, teamId: number) => Promise<void>>(async () => {});

  const getRelevantStageKey = useCallback((): string => {
    const stageUpper = (currentStage || '').toUpperCase();
    if (['PRE_ROUND32', 'ROUND32'].includes(stageUpper)) return 'round32';
    if (['PRE_ROUND16', 'ROUND16'].includes(stageUpper)) return 'round16';
    if (['PRE_QUARTER', 'QUARTER'].includes(stageUpper)) return 'quarter';
    if (stageUpper === 'SEMI') return 'semi';
    if (stageUpper === 'FINAL') return 'final';
    return 'round32';
  }, [currentStage]);

  // Snap scroll back immediately after commit (before paint) so re-layout doesn't flash a wrong offset
  useLayoutEffect(() => {
    if (pendingScrollYRef.current === null) return;
    const y = pendingScrollYRef.current;
    pendingScrollYRef.current = null;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
  });

  const fetchAllStages = useCallback(async (isRefresh = false) => {
    const myAllGen = ++fetchAllGenRef.current;
    // Invalidate in-flight fetchStagesFrom — full snapshot will replace partial updates
    fetchStagesGenRef.current++;

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
        setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
        setLoading(false);
        return;
      }

      // Single request for all stages
      const data = await apiService.getAllKnockoutPredictions(userId);

      // Discard stale responses — a newer full fetch or partial refresh has superseded this one
      if (myAllGen !== fetchAllGenRef.current) return;

      const newPredictionsByStage: Record<string, KnockoutPrediction[]> = {
        round32: data.stages.round32 || [],
        round16: data.stages.round16 || [],
        quarter: data.stages.quarter || [],
        semi: data.stages.semi || [],
        final: data.stages.final || [],
      };
      const originalMap: { [predictionId: number]: number } = {};

      STAGES.forEach(({ key }) => {
        (newPredictionsByStage[key] || []).forEach((p: KnockoutPrediction) => {
          if (p.winner_team_id) originalMap[p.id] = p.winner_team_id;
        });
      });

      // Compute which stages are newly unlocked (to scroll to the first new one)
      const prevUnlocked = new Set(unlockedStagesRef.current);
      const nextUnlocked = new Set(prevUnlocked);
      STAGES.forEach(({ key }) => {
        if (computeIsStageVisible(key, newPredictionsByStage, originalMap)) {
          nextUnlocked.add(key);
        }
      });
      const newlyUnlockedStage = STAGES.find(
        ({ key }) => nextUnlocked.has(key) && !prevUnlocked.has(key)
      );

      predictionsByStageRef.current = newPredictionsByStage;
      originalWinnersRef.current = originalMap;
      setPredictionsByStage(newPredictionsByStage);
      setOriginalWinners(originalMap);

      const finalPredictions = newPredictionsByStage['final'] || [];
      const finalHasPrediction = finalPredictions.some(p => originalMap[p.id] !== undefined);
      if (finalHasPrediction) {
        setHasEverPredictedFinal(prev => (prev ? prev : true));
      }

      setKnockoutScore(data.knockout_score ?? null);
      setKnockoutPenalty(data.knockout_penalty ?? 0);

      const bracketUpdatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
      const bracketUpdatedMatches = JSON.parse(bracketUpdatedMatchesStr);
      if (bracketUpdatedMatches.length > 0) {
        const allMatchIds = STAGES.flatMap(s => (newPredictionsByStage[s.key] || []).map((p: KnockoutPrediction) => p.template_match_id));
        const remainingUpdates = bracketUpdatedMatches.filter(
          (u: any) => !allMatchIds.includes(u.matchId)
        );
        await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(remainingUpdates));
      }

      if (newlyUnlockedStage) {
        unlockedStagesRef.current = nextUnlocked;
        setUnlockedStages(nextUnlocked);
      } else {
        unlockedStagesRef.current = nextUnlocked;
        setUnlockedStages(nextUnlocked);
      }

    } catch (error) {
      console.error('Error fetching knockout predictions:', error);
      setErrorModal({
        title: 'Error',
        message: 'Could not load predictions. Please check your connection.',
        goBack: true,
      });
    } finally {
      if (myAllGen === fetchAllGenRef.current) {
        setLoading(false);
        if (!hasAutoScrolledRef.current) {
          hasAutoScrolledRef.current = true;
          setTimeout(() => {
            const targetKey = getRelevantStageKey();
            const targetY = stageSectionYRef.current[targetKey];
            if (targetY !== undefined && targetY > 0) {
              scrollViewRef.current?.scrollTo({ y: targetY, animated: false });
            }
          }, 100);
        }
      }
    }
  }, [getCurrentUserId, getRelevantStageKey]);

  // After a PUT, refetch only the changed stage and all later stages (cascade may have cleared winners)
  const fetchStagesFrom = useCallback(async (fromStageKey: string) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    const myStagesGen = ++fetchStagesGenRef.current;
    // Invalidate in-flight fetchAllStages — user action must win over background full load
    fetchAllGenRef.current++;

    const fromIndex = STAGE_ORDER.indexOf(fromStageKey);
    if (fromIndex === -1) return;

    const stagesToFetch = STAGE_ORDER.slice(fromIndex);

    try {
      const results = await Promise.all(
        stagesToFetch.map(key => apiService.getKnockoutPredictions(userId, key))
      );

      // Discard stale responses (newer partial or full fetch started)
      if (myStagesGen !== fetchStagesGenRef.current) return;

      const freshPredictionsByStage: Record<string, KnockoutPrediction[]> = { ...predictionsByStageRef.current };
      const freshOriginalWinners: { [predictionId: number]: number } = { ...originalWinnersRef.current };

      stagesToFetch.forEach((key, i) => {
        const preds = results[i].predictions || [];
        freshPredictionsByStage[key] = preds;
        preds.forEach((p: KnockoutPrediction) => {
          if (p.winner_team_id) {
            freshOriginalWinners[p.id] = p.winner_team_id;
          } else {
            delete freshOriginalWinners[p.id];
          }
        });
      });

      // Compute unlock BEFORE updating state
      const prevUnlocked = new Set(unlockedStagesRef.current);
      const nextUnlocked = new Set(prevUnlocked);
      STAGES.forEach(({ key }) => {
        if (computeIsStageVisible(key, freshPredictionsByStage, freshOriginalWinners)) {
          nextUnlocked.add(key);
        }
      });
      const newlyUnlockedStage = STAGES.find(
        ({ key }) => nextUnlocked.has(key) && !prevUnlocked.has(key)
      );

      const lastResult = results[results.length - 1];
      if (lastResult?.knockout_score !== undefined) {
        setKnockoutScore(lastResult.knockout_score ?? null);
        setKnockoutPenalty(lastResult.knockout_penalty ?? 0);
      }

      if (newlyUnlockedStage) {
        // Simply reveal the new stage in place — no scroll needed, user is already there
        predictionsByStageRef.current = freshPredictionsByStage;
        originalWinnersRef.current = freshOriginalWinners;
        setPredictionsByStage(freshPredictionsByStage);
        setOriginalWinners(freshOriginalWinners);
        unlockedStagesRef.current = nextUnlocked;
        setUnlockedStages(nextUnlocked);
      } else {
        predictionsByStageRef.current = freshPredictionsByStage;
        originalWinnersRef.current = freshOriginalWinners;
        setPredictionsByStage(freshPredictionsByStage);
        setOriginalWinners(freshOriginalWinners);
        unlockedStagesRef.current = nextUnlocked;
        setUnlockedStages(nextUnlocked);
      }

    } catch (error) {
      console.error('Error refreshing stages after update:', error);
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
    // Once we're at PRE_ROUND32 or later, show all stages regardless of predictions
    if (isPostGroupStage) return true;
    return unlockedStages.has(stageKey);
  }, [unlockedStages, isPostGroupStage]);

  // Returns true for the stage immediately after the last visible stage
  // This stage is shown as an empty (no teams) preview section
  const isNextPreviewStage = useCallback((stageKey: string): boolean => {
    if (isPostGroupStage) return false;
    const stageIndex = STAGES.findIndex(s => s.key === stageKey);
    if (stageIndex === 0) return false;
    const prevKey = STAGES[stageIndex - 1].key;
    // Show as preview if previous stage is visible (regardless of completion)
    return unlockedStages.has(prevKey) && !unlockedStages.has(stageKey);
  }, [unlockedStages, isPostGroupStage]);

  const handleTeamPress = async (
    prediction: KnockoutPrediction,
    teamId: number
  ) => {
    if (!prediction.is_editable) {
      setShowBracketModal(true);
      return;
    }

    if (isPreTournament) {
      const winnerTeamNumber = teamId === prediction.team1_id ? 1 : 2;
      const winnerTeamName = teamId === prediction.team1_id
        ? (prediction.team1_name ?? '')
        : (prediction.team2_name ?? '');

      try {
        const winnerTeamId = winnerTeamNumber === 1 ? prediction.team1_id : prediction.team2_id;

        // Optimistic UI: mark winner immediately (keep ref in sync so merges never drop it)
        if (winnerTeamId) {
          originalWinnersRef.current = { ...originalWinnersRef.current, [prediction.id]: winnerTeamId };
          setOriginalWinners(prev => ({ ...prev, [prediction.id]: winnerTeamId }));
        }

        await apiService.updateKnockoutPrediction(
          prediction.id,
          winnerTeamNumber,
          winnerTeamName,
          false
        );

        // Fetch only LATER stages (cascade effects) — current stage already updated optimistically
        const changedStageIndex = STAGE_ORDER.indexOf(prediction.stage);
        if (changedStageIndex < STAGE_ORDER.length - 1) {
          await fetchStagesFrom(STAGE_ORDER[changedStageIndex + 1]);
        }
        // If it's the final stage, no later stages exist — optimistic update is sufficient

        if (prediction.stage === 'final') {
          setShowBracketCompleteModal(true);
        }

      } catch (error) {
        // Revert optimistic update on failure
        setOriginalWinners(prev => {
          const reverted = { ...prev };
          delete reverted[prediction.id];
          return reverted;
        });
        const ow = { ...originalWinnersRef.current };
        delete ow[prediction.id];
        originalWinnersRef.current = ow;
        console.error('Error updating knockout prediction:', error);
        setErrorModal({
          title: 'Could not save',
          message: 'Failed to save your prediction. Please check your connection and try again.',
        });
      }
    } else {
      setShowBracketModal(true);
    }
  };

  // Always keep ref up to date
  handleTeamPressRef.current = handleTeamPress;

  const renderMatch = useCallback((prediction: KnockoutPrediction, stageKey: string) => {
    return (
      <KnockoutMatchCard
        key={prediction.id}
        prediction={prediction}
        onTeamPress={(teamId) => handleTeamPressRef.current(prediction, teamId)}
        originalWinner={originalWinners[prediction.id]}
        isTouched={touchedPredictions.has(prediction.id)}
        isPreTournament={isPreTournament}
        isLocked={!prediction.is_editable}
        showNetScore={showNetScore}
      />
    );
  }, [originalWinners, touchedPredictions, isPreTournament, showNetScore]);

  const hasAnyResult = Object.values(predictionsByStage).flat().some(
    p => p.is_correct !== null && p.is_correct !== undefined
  );
  const showPoints = hasAnyResult && knockoutScore !== null;

  const netTotal = showNetScore && knockoutScore !== null
    ? (knockoutScore ?? 0) - knockoutPenalty
    : null;
  const getPointsPillStyle = () => {
    if (!showNetScore || netTotal === null) return {};
    if (netTotal > 0) return {};
    if (netTotal === 0) return styles.pointsContainerZero;
    return styles.pointsContainerNegative;
  };
  const displayPoints = showNetScore && netTotal !== null
    ? netTotal
    : (knockoutScore ?? 0);

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

  const renderStageSection = (stageKey: string, stageName: string) => {
    const visible = isStageVisible(stageKey);
    const preview = isNextPreviewStage(stageKey);

    if (!visible && !preview) {
      return null;
    }

    const predictions = predictionsByStage[stageKey] || [];
    const isFirst = stageKey === 'round32';

    return (
      <View
        key={stageKey}
        style={styles.sectionWrapper}
        collapsable={false}
        onLayout={(e) => {
          stageSectionYRef.current[stageKey] = e.nativeEvent.layout.y;
        }}
      >
        {renderSectionHeader(stageName, isFirst, !visible)}
        {!visible ? (
          <View style={styles.lockedPlaceholder}>
            <View style={styles.lockedIconBadge}>
              <Ionicons name="lock-closed" size={16} color="#64748b" />
            </View>
            <Text style={styles.lockedPlaceholderTitle}>Predict all matches above</Text>
            <Text style={styles.lockedPlaceholderSubtitle}>
              Complete the current round to unlock the next stage
            </Text>
          </View>
        ) : (
          predictions.map(p => renderMatch(p, stageKey))
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading knockout predictions...</Text>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title ?? 'Error'}
          message={errorModal?.message ?? ''}
          onClose={() => setErrorModal(null)}
          {...(errorModal?.goBack && {
            onGoBack: () => { setErrorModal(null); navigation.goBack(); },
            goBackLabel: 'Go Back',
          })}
        />
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
              <BracketIcon size={16} color="#ffffff" />
              <Text style={styles.bracketButtonText}>Bracket</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            {isPostGroupStage && (
              <TouchableOpacity
                onPress={() => setShowLegendModal(true)}
                style={{ padding: 4 }}
              >
                <Ionicons name="information-circle-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
            )}
            {showPoints && (
              <>
                <TouchableOpacity
                  style={[styles.netScoreToggle, showNetScore && styles.netScoreToggleActive, { marginRight: 4 }]}
                  onPress={() => setShowNetScore(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={14}
                    color={showNetScore ? '#16a34a' : '#64748b'}
                  />
                  <Text style={[styles.netScoreToggleText, showNetScore && styles.netScoreToggleTextActive]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    Net
                  </Text>
                </TouchableOpacity>
                <View style={[styles.pointsContainer, getPointsPillStyle()]}>
                  <Text style={styles.totalPoints}>{displayPoints} pts</Text>
                </View>
              </>
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

      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
        {...(errorModal?.goBack && {
          onGoBack: () => { setErrorModal(null); navigation.goBack(); },
          goBackLabel: 'Go Back',
        })}
      />

      <Modal
        visible={showBracketModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBracketModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBracketModal(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            <BracketIcon size={44} color="#0284c7" />
            <Text style={styles.modalTitle}>Edit via Bracket</Text>
            <Text style={styles.modalSubtitle}>
              Changes to your bracket during this stage require using the Bracket screen.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowBracketModal(false);
                navigation.navigate('Bracket' as never);
              }}
            >
              <Text style={styles.modalButtonText}>Go to Bracket</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowBracketModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showBracketCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBracketCompleteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBracketCompleteModal(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            <BracketIcon size={48} color="#16a34a" />
            <Text style={styles.modalTitle}>Bracket Complete!</Text>
            <Text style={styles.modalSubtitle}>
              Your full tournament bracket is ready. Want to view it?
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowBracketCompleteModal(false);
                navigation.navigate('Bracket' as never);
              }}
            >
              <Text style={styles.modalButtonText}>View Bracket</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowBracketCompleteModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Later</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Legend Modal */}
      <Modal visible={showLegendModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLegendModal(false)}
        >
          <TouchableOpacity style={[styles.modalCard, { backgroundColor: '#1e293b' }]} activeOpacity={1} onPress={() => {}}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: '#f1f5f9', marginTop: 0 }]}>Card Legend</Text>
              <TouchableOpacity onPress={() => setShowLegendModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Invalid */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, width: '100%' }}>
              <Ionicons name="warning-outline" size={22} color="#ef4444" />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: '#cbd5e1' }}>
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>Invalid — </Text>
                your predicted winner has been eliminated. 0 points potential
              </Text>
            </View>

            {/* Unreachable */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, width: '100%' }}>
              <Ionicons name="alert-circle-outline" size={22} color="#ca8a04" />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: '#cbd5e1' }}>
                <Text style={{ color: '#ca8a04', fontWeight: '700' }}>Unreachable — </Text>
                your predicted winner is expected in a different match at this stage. Partial points potential
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  netScoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    backgroundColor: '#152a45',
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  netScoreToggleActive: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: '#16a34a',
  },
  netScoreToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  netScoreToggleTextActive: {
    color: '#16a34a',
  },
  pointsContainerZero: {
    backgroundColor: '#f59e0b',
  },
  pointsContainerNegative: {
    backgroundColor: '#ef4444',
  },
  bracketButton: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bracketButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#0f172a',
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
    borderColor: '#2d4a6e',
    borderStyle: 'dashed',
    backgroundColor: '#152a45',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  lockedIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  lockedPlaceholderTitle: {
    fontSize: 14,
    color: '#94a3b8',
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
    backgroundColor: '#1e293b',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#94a3b8',
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
