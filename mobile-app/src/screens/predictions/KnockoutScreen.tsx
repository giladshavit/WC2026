import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/KnockoutMatchCard';
import { useTournament } from '../../contexts/TournamentContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';

const Tab = createMaterialTopTabNavigator();

interface KnockoutScreenProps {}

// Type for pending changes
interface PendingChange {
  prediction_id: number;
  winner_team_number: number; // 1 or 2
  winner_team_name: string;
}

// Context to avoid passing props that cause remounts
const KnockoutContext = React.createContext<{
  pendingChanges: PendingChange[];
  onTeamPress: (predictionId: number, teamId: number, teamName: string, teamNumber: number) => void;
  onSendChanges: () => void;
  onRefreshData: () => void;
  onClearSpecificPendingChanges: (predictionIds: number[]) => void;
  onUpdateOriginalWinners: (predictions: KnockoutPrediction[]) => void;
  onTriggerRefresh: () => void;
  refreshTrigger: number;
  originalWinners: {[predictionId: number]: number};
  currentFocusedStage: string | null;
  setCurrentFocusedStage: (stage: string | null) => void;
  predictionStages: {[predictionId: number]: string};
}>({ pendingChanges: [], onTeamPress: () => {}, onSendChanges: () => {}, onRefreshData: () => {}, onClearSpecificPendingChanges: () => {}, onUpdateOriginalWinners: () => {}, onTriggerRefresh: () => {}, refreshTrigger: 0, originalWinners: {}, currentFocusedStage: null, setCurrentFocusedStage: () => {}, predictionStages: {} });

// Individual stage component
const StageScreen = React.memo(({ route }: { route: any }) => {
  const { stage, stageName } = route.params || {};
  const { pendingChanges, onTeamPress, onSendChanges, onRefreshData, onClearSpecificPendingChanges, onUpdateOriginalWinners, onTriggerRefresh, refreshTrigger, originalWinners, currentFocusedStage, setCurrentFocusedStage, predictionStages } = useContext(KnockoutContext);
  // Build O(1) lookup map for this stage screen
  const pendingChangesById = React.useMemo(() => {
    const map: { [id: number]: PendingChange } = {};
    for (const change of pendingChanges) {
      map[change.prediction_id] = change;
    }
    return map;
  }, [pendingChanges]);
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchPredictions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const data = await apiService.getKnockoutPredictions(1, stage);
      setPredictions(data.predictions);
      setKnockoutScore(data.knockout_score);
      
      // Check if there are any matches updated from bracket
      const bracketUpdatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
      const bracketUpdatedMatches = JSON.parse(bracketUpdatedMatchesStr);
      const stageMatchIds = data.predictions.map(p => p.template_match_id);
      const relevantBracketUpdates = bracketUpdatedMatches.filter((update: any) => 
        stageMatchIds.includes(update.matchId)
      );
      
      if (relevantBracketUpdates.length > 0) {
        console.log(`🔄 [FETCH] Found ${relevantBracketUpdates.length} bracket updates for stage ${stage}`);
        // Clear pending changes only for the specific matches that were updated from bracket
        const updatedMatchIds = relevantBracketUpdates.map((update: any) => update.matchId);
        // Find prediction IDs that correspond to these template match IDs
        const predictionIdsToClear = data.predictions
          .filter(prediction => updatedMatchIds.includes(prediction.template_match_id))
          .map(prediction => prediction.id);
        
        console.log(`🔄 [BRACKET UPDATE] Clearing pending changes for predictions: ${predictionIdsToClear.join(', ')}`);
        onClearSpecificPendingChanges(predictionIdsToClear);
        
        // Update original winners with the latest data from server for this stage
        console.log(`🔄 [BRACKET UPDATE] Updating original winners with latest data for stage ${stage}`);
        onUpdateOriginalWinners(data.predictions);
        
        // Also refresh all other stages to get the latest data (but don't clear pending changes)
        console.log(`🔄 [BRACKET UPDATE] Triggering refresh for all stages`);
        onTriggerRefresh();
        
        // Remove these updates from AsyncStorage
        const remainingUpdates = bracketUpdatedMatches.filter((update: any) => 
          !stageMatchIds.includes(update.matchId)
        );
        await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(remainingUpdates));
      }
      
      // Don't clear pending changes when user manually refreshes
      // Only clear when we have bracket updates from other screens
      if (isRefresh) {
        console.log(`🔄 [FETCH] Manual refresh for stage ${stage} - keeping pending changes`);
      }
    } catch (error) {
      console.error(`Error fetching ${stage} predictions:`, error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Track when this stage is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log(`🎯 [FOCUS] Stage ${stage} is now focused`);
      setCurrentFocusedStage(stage);
      
      return () => {
        console.log(`🎯 [UNFOCUS] Stage ${stage} is no longer focused`);
        setCurrentFocusedStage(null);
      };
    }, [stage, setCurrentFocusedStage])
  );

  // Fetch data when component mounts
  useEffect(() => {
    fetchPredictions();
  }, [stage]);

  // Listen for refresh requests from parent (only for focused stage)
  useEffect(() => {
    if (refreshTrigger > 0 && currentFocusedStage === stage) {
      console.log(`🔄 [REFRESH TRIGGER] Stage: ${stage} is focused, refreshing`);
      fetchPredictions();
    } else if (refreshTrigger > 0) {
      console.log(`⏭️ [REFRESH TRIGGER] Stage: ${stage} is not focused (focused: ${currentFocusedStage}), skipping refresh`);
    }
  }, [refreshTrigger, currentFocusedStage, stage]);


  // Refresh data when screen comes into focus (but don't clear pending changes)
  useFocusEffect(
    React.useCallback(() => {
      console.log(`🔄 [FOCUS REFRESH] Stage ${stage} focused, pendingChanges: ${pendingChanges.length}`);
      // Always refresh to get the latest data from server, but preserve pending changes
      console.log(`🔄 [FOCUS REFRESH] Refreshing data for stage ${stage} (preserving pending changes)`);
      fetchPredictions();
    }, [stage])
  );

  const handleRefresh = () => {
    fetchPredictions(true);
  };

  const handleTeamPress = (teamId: number) => {
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
        onTeamPress={handleTeamPress}
        pendingWinner={pendingWinner}
        originalWinner={originalWinner}
      />
    );
  }, [handleTeamPress, pendingChangesById, originalWinners]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading {stageName}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.stageContainer}>
      <FlatList
        ref={flatListRef}
        data={predictions}
        renderItem={renderMatch}
        keyExtractor={(item) => `prediction-${item.id}`}
        contentContainerStyle={[styles.listContainer, pendingChanges.length > 0 && styles.listWithButton]}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={10}
        extraData={pendingChangesById}
        scrollEventThrottle={16}
      />
      {pendingChanges.length > 0 && (
        <View style={styles.pendingChangesContainer}>
          <Text style={styles.pendingChangesText}>
            {pendingChanges.length} שינויים ממתינים
          </Text>
          <TouchableOpacity 
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={onSendChanges}
            disabled={sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? 'שולח...' : 'שלח שינויים'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

export default function KnockoutScreen({}: KnockoutScreenProps) {
  const navigation = useNavigation();
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [sending, setSending] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [originalWinners, setOriginalWinners] = useState<{[predictionId: number]: number}>({});
  const [currentFocusedStage, setCurrentFocusedStage] = useState<string | null>(null);
  const [predictionStages, setPredictionStages] = useState<{[predictionId: number]: string}>({});
  const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
  const userId = 1; // Hardcoded for now

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();

  // Helper function to convert stage name to tab name
  const getTabNameFromStage = (stage: string): string | null => {
    switch (stage) {
      case 'round32':
        return 'Round32';
      case 'round16':
        return 'Round16';
      case 'quarter':
        return 'Quarter';
      case 'semi':
        return 'Semi';
      case 'final':
        return 'Final';
      default:
        return null;
    }
  };

  // O(1) lookup map for pending changes
  const pendingChangesById = React.useMemo(() => {
    const map: { [id: number]: PendingChange } = {};
    for (const change of pendingChanges) {
      map[change.prediction_id] = change;
    }
    return map;
  }, [pendingChanges]);

  const handleTeamPress = React.useCallback((predictionId: number, teamId: number, teamName: string, teamNumber: number) => {
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
      const currentStage = currentFocusedStage;
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
                  // ממיר את שם השלב לשם הטאב
                  const tabName = getTabNameFromStage(existingChangeStage);
                  if (tabName) {
                    // נווט אל טאב ה-Knockout ואל המסך הפנימי המתאים
                    (navigation as any).navigate('Knockout', { screen: tabName });
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
  }, [originalWinners, pendingChanges, currentFocusedStage]);


  const performSendChanges = React.useCallback(async () => {
    if (pendingChanges.length === 0) return;

    setSending(true);
    
    try {
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
          
          // Trigger refresh of all stage screens
          console.log(`🔄 [SEND CHANGES] Triggering refresh for all stages`);
          setRefreshTrigger(prev => prev + 1);
          
          // Reload original winners after successful save to get the real team IDs
          setTimeout(async () => {
            try {
              const response = await apiService.getKnockoutPredictions(userId);
              const originalMap: {[predictionId: number]: number} = {};
              
              response.predictions.forEach((prediction: KnockoutPrediction) => {
                if (prediction.winner_team_id) {
                  originalMap[prediction.id] = prediction.winner_team_id;
                }
              });
              
              setOriginalWinners(originalMap);
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
  }, [pendingChanges, userId]);

  const handleSendChanges = React.useCallback(async () => {
    const numberOfChanges = pendingChanges.length;
    
    if (numberOfChanges === 0) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }

    // Use the generic penalty confirmation hook
    showPenaltyConfirmation(performSendChanges, numberOfChanges);
  }, [pendingChanges.length, showPenaltyConfirmation, performSendChanges]);

  const handleRefreshData = React.useCallback(() => {
    console.log(`🔄 [REFRESH DATA] Clearing pending changes and triggering refresh`);
    setPendingChanges([]);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleClearSpecificPendingChanges = React.useCallback((predictionIds: number[]) => {
    console.log(`🔄 [CLEAR SPECIFIC] Clearing pending changes for predictions: ${predictionIds.join(', ')}`);
    setPendingChanges(prev => prev.filter(change => !predictionIds.includes(change.prediction_id)));
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleUpdateOriginalWinners = React.useCallback((predictions: KnockoutPrediction[]) => {
    console.log(`🔄 [UPDATE ORIGINAL WINNERS] Updating original winners with ${predictions.length} predictions`);
    const newOriginalWinners: {[predictionId: number]: number} = {};
    
    predictions.forEach(prediction => {
      if (prediction.winner_team_id) {
        newOriginalWinners[prediction.id] = prediction.winner_team_id;
      }
    });
    
    // Update only the specific predictions that were updated, not all of them
    setOriginalWinners(prev => ({ ...prev, ...newOriginalWinners }));
    console.log('Updated original winners:', newOriginalWinners);
  }, []);

  const handleTriggerRefresh = React.useCallback(() => {
    console.log(`🔄 [TRIGGER REFRESH] Triggering refresh for all stages`);
    setRefreshTrigger(prev => prev + 1);
  }, []);


  // Load original winners and prediction stages from server on component mount
  useEffect(() => {
    const loadOriginalWinners = async () => {
      try {
        // For now, we'll use the existing API to get knockout predictions
        // and extract the original winners and stages
        const response = await apiService.getKnockoutPredictions(userId);
        const originalMap: {[predictionId: number]: number} = {};
        const stagesMap: {[predictionId: number]: string} = {};
        
        response.predictions.forEach((prediction: KnockoutPrediction) => {
          if (prediction.winner_team_id) {
            originalMap[prediction.id] = prediction.winner_team_id;
          }
          // נשתמש ב-stage מהתגובה
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
  }, [userId]);

  return (
    <KnockoutContext.Provider value={{ pendingChanges, onTeamPress: handleTeamPress, onSendChanges: handleSendChanges, onRefreshData: handleRefreshData, onClearSpecificPendingChanges: handleClearSpecificPendingChanges, onUpdateOriginalWinners: handleUpdateOriginalWinners, onTriggerRefresh: handleTriggerRefresh, refreshTrigger, originalWinners, currentFocusedStage, setCurrentFocusedStage, predictionStages }}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Knockout Predictions</Text>
          {knockoutScore !== null && (
            <View style={styles.pointsContainer}>
              <Text style={styles.totalPoints}>{knockoutScore} pts</Text>
            </View>
          )}
        </View>
      </View>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIndicatorStyle: styles.tabIndicator,
          tabBarActiveTintColor: '#667eea',
          tabBarInactiveTintColor: '#718096',
        }}
      >
        <Tab.Screen 
          name="Round32" 
          component={StageScreen}
          initialParams={{ stage: 'round32', stageName: 'Round of 32' }}
          options={{ tabBarLabel: 'Round 32' }}
        />
        <Tab.Screen 
          name="Round16" 
          component={StageScreen}
          initialParams={{ stage: 'round16', stageName: 'Round of 16' }}
          options={{ tabBarLabel: 'Round 16' }}
        />
        <Tab.Screen 
          name="Quarter" 
          component={StageScreen}
          initialParams={{ stage: 'quarter', stageName: 'Quarter Final' }}
          options={{ tabBarLabel: 'Quarter' }}
        />
        <Tab.Screen 
          name="Semi" 
          component={StageScreen}
          initialParams={{ stage: 'semi', stageName: 'Semi Final' }}
          options={{ tabBarLabel: 'Semi' }}
        />
        <Tab.Screen 
          name="Final" 
          component={StageScreen}
          initialParams={{ stage: 'final', stageName: 'Final' }}
          options={{ tabBarLabel: 'Final' }}
        />
      </Tab.Navigator>
    </KnockoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  pointsContainer: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  totalPoints: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabIndicator: {
    backgroundColor: '#667eea',
    height: 3,
  },
  stageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    paddingBottom: 80, // Space for the fixed button
  },
  pendingChangesContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f0fdf4',
    padding: 12,
    margin: 0,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10b981',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pendingChangesText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

