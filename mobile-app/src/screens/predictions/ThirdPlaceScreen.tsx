import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ThirdPlaceStatsModal from '../../components/ThirdPlaceStatsModal';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, Image, Dimensions, BackHandler } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThirdPlaceTeam, apiService } from '../../services/api';
import { useTournament } from '../../contexts/TournamentContext';
import { useAuth } from '../../contexts/AuthContext';
import { PenaltyConfirmationModal, UnsavedChangesModal, MaximumReachedModal } from '../../components/CustomModals';

interface ThirdPlaceScreenProps {}

export default function ThirdPlaceScreen({}: ThirdPlaceScreenProps) {
  const [teams, setTeams] = useState<ThirdPlaceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(new Set());
  const [changedGroups, setChangedGroups] = useState<string[]>([]);
  const [thirdPlaceResult, setThirdPlaceResult] = useState<any>(null);
  const [thirdPlaceScore, setThirdPlaceScore] = useState<number | null>(null);
  const [isEditable, setIsEditable] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [counterHeight, setCounterHeight] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [penaltyModalVisible, setPenaltyModalVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<any>(null);
  const [maxReachedModalVisible, setMaxReachedModalVisible] = useState(false);

  const hasStartedEditing = useRef(false);

  const insets = useSafeAreaInsets();

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();

  const isPreTournament = currentStage === 'PRE_GROUP_STAGE';
  const isThirdPlaceManualSave =
    currentStage === 'GROUP_CYCLE_1' ||
    currentStage === 'GROUP_CYCLE_2';
  const isThirdPlaceLocked =
    !isPreTournament &&
    !isThirdPlaceManualSave;
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  // Calculate number of changes in third place prediction (symmetric difference)
  const calculateThirdPlaceChanges = useMemo(() => {
    const currentlySelected = Array.from(selectedTeams);
    const originallySelected = teams
      .filter(team => team.is_selected)
      .map(team => team.id);

    // Count teams that differ between current and original selection (symmetric difference)
    const added = currentlySelected.filter(id => !originallySelected.includes(id));
    const removed = originallySelected.filter(id => !currentlySelected.includes(id));

    // Return max of added/removed (each swap = 1 change: remove old + add new)
    return Math.max(added.length, removed.length);
  }, [selectedTeams, teams]);

  const originallySelectedCount = teams.filter(t => t.is_selected).length;
  const hasUnsavedChanges = isThirdPlaceManualSave && (
    calculateThirdPlaceChanges > 0 ||
    selectedTeams.size !== originallySelectedCount
  );

  // Calculate dynamic height based on actual measured heights
  const getCardHeight = () => {
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate reserved space from actual measurements
    const tabBarHeight = 60; // Approximate tab bar height
    const reservedSpace = 
      insets.top + // Safe area top
      headerHeight + // Header with "Predictions" title
      counterHeight + // "Selected: X/8" counter
      tabBarHeight + // Bottom tab bar
      150; // Additional padding
    
    const availableHeight = screenHeight - reservedSpace;
    
    // Account for margins between rows (3 gaps between 4 rows)
    const marginsBetweenRows = 3 * 8; // 3 gaps * 8px each = 24px
    
    // Calculate height per card
    const cardHeight = (availableHeight - marginsBetweenRows) / 4;
    
    return Math.max(cardHeight, 80); // Minimum height of 80px
  };

  const fetchData = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      const data = await apiService.getThirdPlacePredictionsData(userId);
      
      // Check if API returned an error
      if (data.error) {
        console.log('Third place API error:', data.error);
        // If user hasn't completed group predictions, show empty state
        setTeams([]);
        setSelectedTeams(new Set());
        setChangedGroups([]);
        return;
      }
      
      // Handle case where eligible_teams might be undefined or empty
      const eligibleTeams = data.eligible_teams || [];
      setTeams(eligibleTeams);
      
      // Initialize selected teams from existing prediction
      const selectedSet = new Set<number>();
      eligibleTeams.forEach(team => {
        if (team.is_selected) {
          selectedSet.add(team.id);
        }
      });
      setSelectedTeams(selectedSet);
      
      // Initialize changed groups from prediction data
      setChangedGroups(data.prediction?.changed_groups || []);
      
      // Store result data if exists
      setThirdPlaceResult(data.result || null);
      
      // Store is_editable status
      setIsEditable(data.prediction?.is_editable ?? true);
      
      // Store third place score
      setThirdPlaceScore(data.third_place_score);
    } catch (error) {
      console.error('Error fetching third place data:', error);
      Alert.alert('Error', 'Could not load third place teams. Please check that the server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const autoSave = async (teamIds: number[]) => {
    if (!isPreTournament) return;
    if (teamIds.length !== 8) return;

    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      await apiService.updateThirdPlacePrediction(userId, teamIds);
      await AsyncStorage.setItem('earlyStageUpdated', JSON.stringify({
        stage: 'third_place',
        timestamp: Date.now()
      }));
      // Refresh data silently
      await fetchData();
    } catch (error) {
      console.error('Error auto-saving third place:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isFocused || !hasUnsavedChanges) return;
      e.preventDefault();
      setPendingNavAction(e.data.action);
      setExitModalVisible(true);
    });
    return unsubscribe;
  }, [navigation, hasUnsavedChanges, isFocused]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (!hasUnsavedChanges) return false;
        setPendingNavAction(null);
        setExitModalVisible(true);
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [hasUnsavedChanges])
  );

  // Refresh data when screen comes into focus - only if we haven't started editing this session
  useFocusEffect(
    React.useCallback(() => {
      if (!hasStartedEditing.current) {
        fetchData();
      }
      return () => {
        // Reset the editing flag when leaving the screen entirely
        // (not just tab switching — only when truly unmounting)
      };
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTeamPress = (teamId: number) => {
    if (!isEditable || isThirdPlaceLocked) return;

    hasStartedEditing.current = true;

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    let newSelectedSet: Set<number> | null = null;

    setSelectedTeams(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(teamId)) {
        newSelected.delete(teamId);
      } else {
        if (newSelected.size < 8) {
          newSelected.add(teamId);
        } else {
          setMaxReachedModalVisible(true);
          return prev;
        }
      }
      newSelectedSet = newSelected;
      return newSelected;
    });

    // After state update, trigger auto-save if pre-tournament and 8 selected
    setTimeout(() => {
      if (isPreTournament && newSelectedSet && newSelectedSet.size === 8) {
        autoSave(Array.from(newSelectedSet));
      }
    }, 0);

    setChangedGroups(prev => prev.filter(g => g !== team.group_name));
  };

  const performSave = async () => {
    if (selectedTeams.size !== 8) {
      Alert.alert('Incomplete Selection', 'Please select exactly 8 teams to advance.');
      return;
    }

    setSaving(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      const advancingTeamIds = Array.from(selectedTeams);
      const result = await apiService.updateThirdPlacePrediction(userId, advancingTeamIds);
      console.log('Save result:', result);
      
      // Mark that third place stage was updated - this will trigger refresh in knockout screens
      await AsyncStorage.setItem('earlyStageUpdated', JSON.stringify({
        stage: 'third_place',
        timestamp: Date.now()
      }));
      console.log('✅ Third place stage updated - marked for knockout refresh');
      
      Alert.alert('Success', 'Third place prediction saved successfully!');
      
      // Refresh data to get updated prediction info
      await fetchData();
    } catch (error) {
      console.error('Error saving third place prediction:', error);
      Alert.alert('Error', 'Could not save prediction. Please try again.');
    } finally {
      setSaving(false);
      hasStartedEditing.current = false;
    }
  };

  const handleSave = async () => {
    if (calculateThirdPlaceChanges === 0) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }
    setPenaltyModalVisible(true);
  };

  const renderTeam = ({ item }: { item: ThirdPlaceTeam }) => {
    const isSelected = selectedTeams.has(item.id);
    const isChanged = changedGroups.includes(item.group_name);
    
    // Check if there's a result and if this team's group is correct
    const hasResult = thirdPlaceResult !== null;

    const actuallyAdvanced = hasResult && thirdPlaceResult?.result_groups?.includes(item.group_name);
    const userPicked = isSelected;
    const isCorrect = hasResult && userPicked ? actuallyAdvanced : null;
    
    let cardStyle: any = styles.teamCard;
    if (hasResult) {
      if (userPicked && actuallyAdvanced) {
        // Correct pick: green background + dark green border
        cardStyle = [styles.teamCard, styles.teamCardCorrectPick];
      } else if (!userPicked && actuallyAdvanced) {
        // Missed: dark green border only, no background
        cardStyle = [styles.teamCard, styles.teamCardMissed];
      } else if (userPicked && !actuallyAdvanced) {
        // Wrong pick: red background
        cardStyle = [styles.teamCard, styles.teamCardIncorrect];
      }
      // else: plain white card
    } else if (isChanged && isSelected) {
      cardStyle = [styles.teamCard, styles.teamCardSelected, styles.teamCardChanged];
    } else if (isChanged) {
      cardStyle = [styles.teamCard, styles.teamCardChanged];
    } else if (isSelected) {
      cardStyle = [styles.teamCard, styles.teamCardSelected];
    }
    
    return (
      <TouchableOpacity
        style={[cardStyle, { height: getCardHeight() }]}
        onPress={() => handleTeamPress(item.id)}
        activeOpacity={(isThirdPlaceLocked || !isEditable) ? 1 : 0.7}
        disabled={isThirdPlaceLocked || !isEditable}
      >
        {/* Flag in center */}
        {item.flag_url && (
          <Image source={{ uri: item.flag_url }} style={styles.teamFlag} />
        )}
        
        {/* Team name below flag */}
        <Text 
          style={styles.teamName}
          numberOfLines={2}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.7}
        >
          {item.name}
        </Text>
        
        {/* Group name at bottom */}
        <Text style={styles.groupName}>Group {item.group_name}</Text>
        
        {/* Selection indicators - only show if no result */}
        {isSelected && !hasResult && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#48bb78" />
          </View>
        )}
        {isChanged && !hasResult && (
          <View style={styles.changedIndicator}>
            <Text style={styles.changedText}>!</Text>
          </View>
        )}
        {/* Show correctness indicator if there's a result and team is selected */}
        {hasResult && userPicked && isCorrect !== null && (
          <View style={styles.correctnessIndicator}>
            <Ionicons
              name={isCorrect ? "checkmark-circle" : "close-circle"}
              size={24}
              color={isCorrect ? "#48bb78" : "#f56565"}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading third place teams...</Text>
      </View>
    );
  }

  // Show message if no teams available (user hasn't completed group predictions)
  if (teams.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Please complete your group predictions first</Text>
        <Text style={styles.subtitle}>You need to predict all 12 groups before you can select 3rd place teams</Text>
      </View>
    );
  }

  // Calculate number of correct predictions if there are results
  const hasResult = thirdPlaceResult !== null;
  let correctCount = 0;
  if (hasResult && thirdPlaceResult.result_groups) {
    // Count how many selected teams have groups that appear in result_groups
    teams.forEach(team => {
      if (selectedTeams.has(team.id) && thirdPlaceResult.result_groups.includes(team.group_name)) {
        correctCount++;
      }
    });
  }

  return (
    <View style={styles.container}>
      <View 
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.headerTop}>
          {/* Left: Save button or empty spacer */}
          <View style={styles.headerLeft}>
            {isThirdPlaceManualSave && (
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (calculateThirdPlaceChanges === 0 || saving || selectedTeams.size !== 8) && styles.saveButtonDisabled
                ]}
                onPress={handleSave}
                disabled={calculateThirdPlaceChanges === 0 || saving || selectedTeams.size !== 8}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Center: Counter badge - absolutely positioned */}
          <View style={styles.counterBadgeWrapper} pointerEvents="none" onLayout={(event) => setCounterHeight(event.nativeEvent.layout.height)}>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {hasResult ? `Correct: ${correctCount}/8` : `Selected: ${selectedTeams.size}/8`}
              </Text>
            </View>
          </View>

          {/* Right: Stats button + Score */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowStats(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.statsButton}
            >
              <Ionicons name="stats-chart" size={22} color="#ffffff" />
            </TouchableOpacity>
            {thirdPlaceScore !== null && (
              <View style={styles.totalScoreContainer}>
                <Text style={styles.totalScore}>{thirdPlaceScore} pts</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <FlatList
        data={teams}
        renderItem={renderTeam}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />

      <ThirdPlaceStatsModal
        visible={showStats}
        onClose={() => setShowStats(false)}
      />

      {/* Penalty Confirmation Modal */}
      <PenaltyConfirmationModal
        visible={penaltyModalVisible}
        penaltyPoints={calculateThirdPlaceChanges * (penaltyPerChange ?? 0)}
        onConfirm={() => {
          setPenaltyModalVisible(false);
          performSave();
        }}
        onCancel={() => setPenaltyModalVisible(false)}
      />

      {/* Unsaved Changes Exit Modal */}
      <UnsavedChangesModal
        visible={exitModalVisible}
        onDiscard={() => {
          setExitModalVisible(false);
          if (pendingNavAction) {
            navigation.dispatch(pendingNavAction);
          } else {
            navigation.goBack();
          }
        }}
        onStay={() => {
          setExitModalVisible(false);
          setPendingNavAction(null);
        }}
      />

      <MaximumReachedModal
        visible={maxReachedModalVisible}
        onClose={() => setMaxReachedModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f0fdf4',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  headerLeft: {
    minWidth: 100,
    alignItems: 'flex-start',
  },
  headerRight: {
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  counterBadgeWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  counterBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalScoreContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsButton: {
    backgroundColor: '#0284c7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  listContainer: {
    padding: 8,
  },
  teamCard: {
    flex: 1,
    margin: 4,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    // height will be set dynamically in renderTeam
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamCardSelected: {
    borderColor: '#48bb78',
    backgroundColor: '#f0fff4',
  },
  teamCardCorrectPick: {
    backgroundColor: '#f0fff4',
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  teamCardChanged: {
    borderColor: '#f6ad55',
  },
  teamCardIncorrect: {
    backgroundColor: '#fee2e2', // Light red background for incorrect predictions
  },
  teamCardMissed: {
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  teamFlag: {
    width: 40,
    height: 28,
    borderRadius: 4,
    marginTop: 12, // Fixed distance from top
    marginBottom: 8, // Reduced distance between flag and team name
  },
  teamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
    marginBottom: 8, // Increased distance between team name and group name
  },
  groupName: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 6, // Further reduced distance from bottom
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  changedIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f6ad55',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  correctnessIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});