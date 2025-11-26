import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/KnockoutMatchCard';
import { useTournament } from '../../contexts/TournamentContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';
import { useAuth } from '../../contexts/AuthContext';

interface KnockoutScreenProps {}

// Type for pending changes
interface PendingChange {
  prediction_id: number;
  winner_team_number: number; // 1 or 2
  winner_team_name: string;
}

// Stage configuration - ordered from lowest stage (Round of 32) to Final
const STAGES = [
  { key: 'round32', name: 'Round of 32' },
  { key: 'round16', name: 'Round of 16' },
  { key: 'quarter', name: 'Quarter Final' },
  { key: 'semi', name: 'Semi Final' },
  { key: 'final', name: 'Final' },
];

// Stage content component
interface StageContentProps {
  stageKey: string;
  stageName: string;
  pendingChanges: PendingChange[];
  pendingChangesById: { [id: number]: PendingChange };
  originalWinners: {[predictionId: number]: number};
  predictionStages: {[predictionId: number]: string};
  onTeamPress: (predictionId: number, teamId: number, teamName: string, teamNumber: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshTrigger?: number;
  onPredictionsUpdated?: (stageKey: string, predictions: KnockoutPrediction[]) => void;
}

const StageContent = React.memo(({ 
  stageKey, 
  stageName, 
  pendingChanges, 
  pendingChangesById, 
  originalWinners, 
  predictionStages,
  onTeamPress,
  onRefresh,
  refreshing,
  refreshTrigger,
  onPredictionsUpdated
}: StageContentProps) => {
  const { getCurrentUserId } = useAuth();
  const insets = useSafeAreaInsets();
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchPredictions = async (isRefresh = false) => {
    try {
      // Check if early stage (groups or third place) was updated
      const earlyStageUpdateStr = await AsyncStorage.getItem('earlyStageUpdated');
      const shouldAutoRefresh = earlyStageUpdateStr !== null;
      
      if (shouldAutoRefresh) {
        const updateData = JSON.parse(earlyStageUpdateStr);
        console.log(`🔄 [${stageKey}] Early stage (${updateData.stage}) was updated - auto-refreshing predictions`);
        // Clear the flag after checking (only once per stage)
        if (stageKey === 'round32') {
          await AsyncStorage.removeItem('earlyStageUpdated');
          console.log(`✅ [${stageKey}] Cleared early stage update flag`);
        }
      }
      
      if (!isRefresh && !shouldAutoRefresh) {
        setLoading(true);
      }
      
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      const data = await apiService.getKnockoutPredictions(userId, stageKey);
      setPredictions(data.predictions);
      
      // Notify parent component about updated predictions
      if (onPredictionsUpdated) {
        onPredictionsUpdated(stageKey, data.predictions);
      }
      
      if (shouldAutoRefresh) {
        console.log(`✅ ${stageKey} predictions refreshed after early stage update`);
      }
      
      // Check if there are any matches updated from bracket
      const bracketUpdatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
      const bracketUpdatedMatches = JSON.parse(bracketUpdatedMatchesStr);
      const stageMatchIds = data.predictions.map(p => p.template_match_id);
      const relevantBracketUpdates = bracketUpdatedMatches.filter((update: any) => 
        stageMatchIds.includes(update.matchId)
      );
      
      if (relevantBracketUpdates.length > 0) {
        console.log(`🔄 [FETCH] Found ${relevantBracketUpdates.length} bracket updates for stage ${stageKey}`);
        // Remove these updates from AsyncStorage
        const remainingUpdates = bracketUpdatedMatches.filter((update: any) => 
          !stageMatchIds.includes(update.matchId)
        );
        await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(remainingUpdates));
      }
    } catch (error) {
      console.error(`Error fetching ${stageKey} predictions:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for early stage updates when stage changes
    const checkEarlyStageUpdate = async () => {
      try {
        const earlyStageUpdateStr = await AsyncStorage.getItem('earlyStageUpdated');
        if (earlyStageUpdateStr !== null) {
          const updateData = JSON.parse(earlyStageUpdateStr);
          console.log(`🔄 [EFFECT-${stageKey}] Early stage (${updateData.stage}) update detected - will refresh`);
        }
      } catch (error) {
        console.error(`Error checking early stage update in useEffect:`, error);
      }
    };
    checkEarlyStageUpdate();
    fetchPredictions();
  }, [stageKey]);

  // Refresh when refreshTrigger changes (after save)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchPredictions();
    }
  }, [refreshTrigger]);

  // Check for early stage updates when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const checkAndRefresh = async () => {
        try {
          const earlyStageUpdateStr = await AsyncStorage.getItem('earlyStageUpdated');
          if (earlyStageUpdateStr !== null) {
            const updateData = JSON.parse(earlyStageUpdateStr);
            console.log(`🔄 [FOCUS-${stageKey}] Early stage (${updateData.stage}) updated detected - refreshing...`);
            await fetchPredictions(true);
            // Clear the flag only for round32 to allow other stages to refresh too
            if (stageKey === 'round32') {
              await AsyncStorage.removeItem('earlyStageUpdated');
              console.log(`✅ [FOCUS-${stageKey}] Cleared early stage update flag`);
            }
          } else {
            console.log(`ℹ️ [FOCUS-${stageKey}] No early stage update flag found`);
          }
        } catch (error) {
          console.error(`❌ [FOCUS-${stageKey}] Error checking early stage update:`, error);
        }
      };
      checkAndRefresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageKey])
  );

  const handleRefresh = () => {
    fetchPredictions(true);
    onRefresh();
  };

  const handleTeamPressLocal = (teamId: number) => {
    // Find the prediction for this team
    const prediction = predictions.find(p => p.team1_id === teamId || p.team2_id === teamId);
    if (!prediction) return;

    const teamNumber = prediction.team1_id === teamId ? 1 : 2;
    const teamName = teamNumber === 1 ? prediction.team1_name : prediction.team2_name;
    
    if (teamName) {
      onTeamPress(prediction.id, teamId, teamName, teamNumber);
    }
  };

  const renderMatch = React.useCallback(({ item }: { item: KnockoutPrediction }) => {
    const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
    if (isTBD(item.team1_name) && isTBD(item.team2_name)) {
      return null;
    }
    const pendingChange = pendingChangesById[item.id];
    const pendingWinner = pendingChange ? (pendingChange.winner_team_number === 1 ? item.team1_id : item.team2_id) : undefined;
    const originalWinner = originalWinners[item.id];

    return (
      <KnockoutMatchCard 
        prediction={item} 
        onTeamPress={handleTeamPressLocal}
        pendingWinner={pendingWinner}
        originalWinner={originalWinner}
      />
    );
  }, [handleTeamPressLocal, pendingChangesById, originalWinners]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading {stageName}...</Text>
      </View>
    );
  }

  const hasChanges = pendingChanges.length > 0;

  const renderHeader = () => (
    <View style={styles.stageTitleContainer}>
      <Text style={styles.stageTitle}>{stageName}</Text>
    </View>
  );

  return (
    <View style={styles.stageContainer}>
      <FlatList
        ref={flatListRef}
        data={predictions}
        renderItem={renderMatch}
        keyExtractor={(item) => `prediction-${item.id}`}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.listContainer, hasChanges && styles.listWithButton]}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={10}
        extraData={pendingChangesById}
        scrollEventThrottle={16}
        numColumns={1}
        columnWrapperStyle={undefined}
      />
    </View>
  );
});

export default function KnockoutScreen({}: KnockoutScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [sending, setSending] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [originalWinners, setOriginalWinners] = useState<{[predictionId: number]: number}>({});
  const [predictionStages, setPredictionStages] = useState<{[predictionId: number]: string}>({});
  const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stagesCompleted, setStagesCompleted] = useState<{[stageKey: string]: boolean}>({
    round32: false,
    round16: false,
    quarter: false,
    semi: false,
    final: false,
  });
  
  const pagerRef = useRef<PagerView>(null);

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();

  const currentStageKey = STAGES[currentStageIndex]?.key || 'round32';
  const currentStageName = STAGES[currentStageIndex]?.name || 'Round of 32';

  // Build O(1) lookup map for pending changes
  const pendingChangesById = React.useMemo(() => {
    const map: { [id: number]: PendingChange } = {};
    for (const change of pendingChanges) {
      map[change.prediction_id] = change;
    }
    return map;
  }, [pendingChanges]);

  // Load last page index from AsyncStorage when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const loadLastPage = async () => {
        try {
          const lastPageStr = await AsyncStorage.getItem('knockoutScreenLastPage');
          if (lastPageStr !== null) {
            const lastPage = parseInt(lastPageStr, 10);
            if (lastPage >= 0 && lastPage < STAGES.length) {
              setCurrentStageIndex(lastPage);
              // Set page after a small delay to ensure PagerView is ready
              setTimeout(() => {
                pagerRef.current?.setPage(lastPage);
              }, 100);
            }
          }
        } catch (error) {
          console.error('Error loading last page:', error);
        }
      };
      
      loadLastPage();
    }, [])
  );

  // Load knockout score
  useEffect(() => {
    const loadScore = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;
        
        const response = await apiService.getKnockoutPredictions(userId);
        setKnockoutScore(response.knockout_score);
      } catch (error) {
        console.error('Error loading knockout score:', error);
      }
    };
    
    loadScore();
  }, [getCurrentUserId, pendingChanges]);

  const handleTeamPress = (predictionId: number, teamId: number, teamName: string, teamNumber: number) => {
    const currentWinner = pendingChanges.find(change => change.prediction_id === predictionId);
    const originalWinner = originalWinners[predictionId];
    
    // אם לחצתי על הקבוצה שכבר מסומנת - אין שינוי
    if (currentWinner && currentWinner.winner_team_number === teamNumber) {
      console.log(`No change needed for prediction ${predictionId} - same team selected`);
      return;
    }
    
    // אם חזרתי לבחירה המקורית - הסר מהשינויים
    if (originalWinner && originalWinner === teamId) {
      console.log(`Reverting to original choice for prediction ${predictionId}`);
      setPendingChanges(prev => prev.filter(change => change.prediction_id !== predictionId));
      return;
    }
    
    // בדוק אם יש שינויים משלב אחר
    if (pendingChanges.length > 0) {
      const newPredictionStage = predictionStages[predictionId];
      
      // בדוק אם יש שינויים משלב אחר
      const hasChangesFromOtherStage = pendingChanges.some(change => {
        const changeStage = predictionStages[change.prediction_id];
        return changeStage !== newPredictionStage;
      });
      
      if (hasChangesFromOtherStage) {
        Alert.alert(
          'שינויים משלב אחר',
          'יש לך שינויים לא שמורים משלב אחר. האם תרצה למחוק אותם ולשמור את השינוי החדש?',
          [
            {
              text: 'חזור לשינויים הקודמים',
              style: 'cancel',
              onPress: () => {
                // לא עושים כלום - נשארים עם השינויים הקיימים
                // נחזור לשלב עם השינויים הקיימים
                const existingChangeStage = predictionStages[pendingChanges[0].prediction_id];
                if (existingChangeStage) {
                  const stageIndex = STAGES.findIndex(s => s.key === existingChangeStage);
                  if (stageIndex !== -1) {
                    setCurrentStageIndex(stageIndex);
                    pagerRef.current?.setPage(stageIndex);
                  }
                }
              }
            },
            {
              text: 'מחק שינויים קודמים',
              style: 'destructive',
              onPress: () => {
                // מוחקים את כל השינויים הקיימים ומוסיפים את החדש
                setPendingChanges([{
                  prediction_id: predictionId,
                  winner_team_number: teamNumber,
                  winner_team_name: teamName
                }]);
              }
            }
          ]
        );
        return;
      }
    }
    
    // אין שינויים קיימים - פשוט מוסיפים את השינוי החדש
    setPendingChanges(prev => {
      const filtered = prev.filter(change => change.prediction_id !== predictionId);
      return [...filtered, {
        prediction_id: predictionId,
        winner_team_number: teamNumber,
        winner_team_name: teamName
      }];
    });
  };

  const performSendChanges = React.useCallback(async () => {
    if (pendingChanges.length === 0) return;

    setSending(true);
    
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      const result = await apiService.updateBatchKnockoutPredictions(userId, pendingChanges);
      
      Alert.alert(
        'הצלחה!', 
        `נשמרו ${pendingChanges.length} שינויים בהצלחה`,
        [{ text: 'אישור', onPress: () => {
          // Only update UI after user clicks "אישור"
          // Immediately update original winners to show blue (saved) state
          const newOriginalWinners = { ...originalWinners };
          pendingChanges.forEach(change => {
            // Mark as saved by setting a special flag
            newOriginalWinners[change.prediction_id] = -1; // Special flag for "just saved"
          });
          setOriginalWinners(newOriginalWinners);
          
          // Clear pending changes immediately
          setPendingChanges([]);
          
          // Trigger refresh of current stage to show updated data
          setRefreshTrigger(prev => prev + 1);
          
          // Reload original winners after successful save to get the real team IDs
          setTimeout(async () => {
            try {
              const userId = getCurrentUserId();
              if (!userId) return;
              
              const response = await apiService.getKnockoutPredictions(userId);
              const originalMap: {[predictionId: number]: number} = {};
              
              response.predictions.forEach((prediction: KnockoutPrediction) => {
                if (prediction.winner_team_id) {
                  originalMap[prediction.id] = prediction.winner_team_id;
                }
              });
              
              setOriginalWinners(originalMap);
              setKnockoutScore(response.knockout_score);
              console.log('Reloaded original winners after save:', originalMap);
            } catch (error) {
              console.error('Error reloading original winners:', error);
            }
          }, 1000); // Wait 1 second for server to update
        }}]
      );
    } catch (error) {
      console.error('Error sending changes:', error);
      Alert.alert(
        'שגיאה', 
        'שגיאה בשליחת השינויים. נסה שוב.',
        [{ text: 'אישור' }]
      );
    } finally {
      setSending(false);
    }
  }, [pendingChanges, getCurrentUserId, originalWinners]);

  const handleSendChanges = React.useCallback(async () => {
    const numberOfChanges = pendingChanges.length;
    
    if (numberOfChanges === 0) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }

    // Use the generic penalty confirmation hook
    showPenaltyConfirmation(performSendChanges, numberOfChanges);
  }, [pendingChanges.length, showPenaltyConfirmation, performSendChanges]);

  // Load original winners and prediction stages from server on component mount
  useEffect(() => {
    const loadOriginalWinners = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;
        
        const response = await apiService.getKnockoutPredictions(userId);
        const originalMap: {[predictionId: number]: number} = {};
        const stagesMap: {[predictionId: number]: string} = {};
        
        response.predictions.forEach((prediction: KnockoutPrediction) => {
          if (prediction.winner_team_id) {
            originalMap[prediction.id] = prediction.winner_team_id;
          }
          if (prediction.stage) {
            stagesMap[prediction.id] = prediction.stage;
          }
        });
        
        setOriginalWinners(originalMap);
        setPredictionStages(stagesMap);
        setKnockoutScore(response.knockout_score);
        console.log('Loaded original winners:', originalMap);
        console.log('Loaded prediction stages:', stagesMap);
      } catch (error) {
        console.error('Error loading original winners:', error);
      }
    };
    
    loadOriginalWinners();
  }, [getCurrentUserId]);

  const goToPreviousStage = async () => {
    if (currentStageIndex > 0) {
      const newIndex = currentStageIndex - 1;
      setCurrentStageIndex(newIndex);
      pagerRef.current?.setPage(newIndex);
      // Save current page index to AsyncStorage
      try {
        await AsyncStorage.setItem('knockoutScreenLastPage', newIndex.toString());
      } catch (error) {
        console.error('Error saving knockout screen page:', error);
      }
    }
  };

  const goToNextStage = async () => {
    if (currentStageIndex < STAGES.length - 1) {
      const newIndex = currentStageIndex + 1;
      setCurrentStageIndex(newIndex);
      pagerRef.current?.setPage(newIndex);
      // Save current page index to AsyncStorage
      try {
        await AsyncStorage.setItem('knockoutScreenLastPage', newIndex.toString());
      } catch (error) {
        console.error('Error saving knockout screen page:', error);
      }
    }
  };

  const handlePageSelected = async (e: any) => {
    const newIndex = e.nativeEvent.position;
    setCurrentStageIndex(newIndex);
    // Save current page index to AsyncStorage
    try {
      await AsyncStorage.setItem('knockoutScreenLastPage', newIndex.toString());
    } catch (error) {
      console.error('Error saving knockout screen page:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };


  // Check if all predictions in a stage are completed
  const checkStageCompletion = React.useCallback((stageKey: string, predictions: KnockoutPrediction[]) => {
    // Filter predictions for this stage
    const stagePredictions = predictions.filter(p => p.stage === stageKey);
    
    // Check if all predictions have a winner (not null and not TBD)
    const allCompleted = stagePredictions.length > 0 && stagePredictions.every(prediction => {
      const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
      const team1IsTBD = isTBD(prediction.team1_name);
      const team2IsTBD = isTBD(prediction.team2_name);
      
      // If both teams are TBD, this match doesn't count
      if (team1IsTBD && team2IsTBD) {
        return true; // Skip TBD matches
      }
      
      // Check if winner is set and not TBD
      return prediction.winner_team_id !== null && prediction.winner_team_id !== undefined;
    });
    
    return allCompleted;
  }, []);

  // Handle predictions update from StageContent
  const handlePredictionsUpdated = React.useCallback((stageKey: string, predictions: KnockoutPrediction[]) => {
    const isCompleted = checkStageCompletion(stageKey, predictions);
    const wasCompleted = stagesCompleted[stageKey];
    
    // If stage is now completed and wasn't before, move to next stage
    if (isCompleted && !wasCompleted) {
      setStagesCompleted(prev => ({ ...prev, [stageKey]: true }));
      
      // Find current stage index and move to next if exists
      const currentStageIndex = STAGES.findIndex(s => s.key === stageKey);
      if (currentStageIndex !== -1 && currentStageIndex < STAGES.length - 1) {
        // Small delay to ensure UI updates smoothly
        setTimeout(() => {
          const nextIndex = currentStageIndex + 1;
          setCurrentStageIndex(nextIndex);
          pagerRef.current?.setPage(nextIndex);
        }, 300);
      }
    } else if (isCompleted) {
      // Update state even if already completed (in case of refresh)
      setStagesCompleted(prev => ({ ...prev, [stageKey]: true }));
    }
  }, [stagesCompleted, checkStageCompletion]);

  const hasChanges = pendingChanges.length > 0;

  return (
    <View style={styles.container}>
      {/* Unified header with save, navigation arrows, stage name, and points */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.saveButton, (!hasChanges || sending) && styles.saveButtonDisabled]}
            onPress={handleSendChanges}
            disabled={!hasChanges || sending}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>
              {sending ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <TouchableOpacity
            style={[styles.navButton, currentStageIndex === 0 && styles.navButtonDisabled]}
            onPress={goToPreviousStage}
            disabled={currentStageIndex === 0}
          >
            <Text style={[styles.navButtonText, currentStageIndex === 0 && styles.navButtonTextDisabled]}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight, currentStageIndex === STAGES.length - 1 && styles.navButtonDisabled]}
            onPress={goToNextStage}
            disabled={currentStageIndex === STAGES.length - 1}
          >
            <Text style={[styles.navButtonText, currentStageIndex === STAGES.length - 1 && styles.navButtonTextDisabled]}>→</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          {knockoutScore !== null && (
            <View style={styles.pointsContainer}>
              <Text style={styles.totalPoints}>{knockoutScore} pts</Text>
            </View>
          )}
        </View>
      </View>

      {/* PagerView for swipe navigation */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {STAGES.map((stage, index) => (
          <View key={stage.key} style={styles.page}>
            <StageContent
              stageKey={stage.key}
              stageName={stage.name}
              pendingChanges={pendingChanges}
              pendingChangesById={pendingChangesById}
              originalWinners={originalWinners}
              predictionStages={predictionStages}
              onTeamPress={handleTeamPress}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              refreshTrigger={refreshTrigger}
              onPredictionsUpdated={handlePredictionsUpdated}
            />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d4edda',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
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
  saveButton: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  navButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  navButtonRight: {
    marginRight: 0,
    marginLeft: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 18,
    color: '#667eea',
    fontWeight: 'bold',
  },
  navButtonTextDisabled: {
    color: '#a0aec0',
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  stageContainer: {
    flex: 1,
    backgroundColor: '#d4edda',
  },
  stageTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#d4edda',
    borderBottomWidth: 1,
    borderBottomColor: '#c3e6cb',
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d4edda',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#718096',
  },
  listContainer: {
    padding: 0,
  },
  listWithButton: {
    paddingBottom: 80, // Space for the fixed button (if needed)
  },
});
