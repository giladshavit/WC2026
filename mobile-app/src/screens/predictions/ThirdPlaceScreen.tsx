import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ThirdPlaceStatsModal from '../../components/stats/ThirdPlaceStatsModal';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Dimensions, BackHandler, Modal, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThirdPlaceTeam, apiService } from '../../services/api';
import { useTournament } from '../../contexts/TournamentContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/toast/Toast';
import { FineConfirmationModal, UnsavedChangesModal, MaximumReachedModal, ErrorModal, ValidationModal } from '../../components/modals/CustomModals';

interface ThirdPlaceScreenProps {
  onFirstTimeComplete?: () => void;
}

export default function ThirdPlaceScreen({ onFirstTimeComplete }: ThirdPlaceScreenProps) {
  const [teams, setTeams] = useState<ThirdPlaceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(new Set());
  const [changedGroups, setChangedGroups] = useState<string[]>([]);
  const [thirdPlaceResult, setThirdPlaceResult] = useState<any>(null);
  const [thirdPlaceScore, setThirdPlaceScore] = useState<number | null>(null);
  const [thirdPlacePenalty, setThirdPlacePenalty] = useState<number>(0);
  const [showNetScore, setShowNetScore] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [fineModalVisible, setFineModalVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<any>(null);
  const [maxReachedModalVisible, setMaxReachedModalVisible] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const { showToast } = useToast();
  const hasStartedEditing = useRef(false);

  const insets = useSafeAreaInsets();

  // Get tournament context data
  const { currentStage, finePerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();

  const isPreTournament = currentStage === 'PRE_GROUP_STAGE';
  const isThirdPlaceEditable =
    currentStage === 'GROUP_CYCLE_1' ||
    currentStage === 'GROUP_CYCLE_2';
  const isThirdPlaceManualSave =
    currentStage === 'GROUP_CYCLE_1' ||
    currentStage === 'GROUP_CYCLE_2';
  const isThirdPlaceLocked = !isThirdPlaceEditable && !isPreTournament;
  
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
  const hasChanges =
    selectedTeams.size === 8 &&
    (calculateThirdPlaceChanges > 0 || selectedTeams.size !== originallySelectedCount);
  const hasUnsavedChanges = isThirdPlaceManualSave && hasChanges;
  const showSaveButton = isThirdPlaceEditable;
  const showPoints =
    thirdPlaceScore !== null &&
    thirdPlaceResult !== null;

  // Calculate dynamic height based on actual measured heights
  const getCardHeight = () => {
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate reserved space from actual measurements
    const tabBarHeight = 60; // Approximate tab bar height
    const reservedSpace = 
      insets.top + // Safe area top
      headerHeight + // Header with "Predictions" title
      tabBarHeight + // Bottom tab bar
      150; // Additional padding
    
    const availableHeight = screenHeight - reservedSpace;
    
    // Account for margins between rows (3 gaps between 4 rows)
    const marginsBetweenRows = 3 * 8; // 3 gaps * 8px each = 24px
    
    // Calculate height per card
    const cardHeight = (availableHeight - marginsBetweenRows) / 4;
    
    return Math.max(cardHeight, 80); // Minimum height of 80px
  };

  const fetchData = async (): Promise<{ selectedCount: number }> => {
    let freshSelectedCount = 0;
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
        setLoading(false);
        return { selectedCount: 0 };
      }
      setLoadError(false);
      
      const data = await apiService.getThirdPlacePredictionsData(userId);
      
      // Check if API returned an error
      if (data.error) {
        console.log('Third place API error:', data.error);
        // If user hasn't completed group predictions, show empty state
        setTeams([]);
        setSelectedTeams(new Set());
        setChangedGroups([]);
        return { selectedCount: 0 };
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
      freshSelectedCount = selectedSet.size;
      
      // Initialize changed groups from prediction data
      setChangedGroups(data.prediction?.changed_groups || []);
      
      // Store result data if exists
      setThirdPlaceResult(data.result || null);
      
      // Store is_editable status
      setIsEditable(data.prediction?.is_editable ?? true);
      
      // Store third place score and penalty
      setThirdPlaceScore(data.third_place_score);
      setThirdPlacePenalty(data.third_place_penalty ?? 0);
    } catch (error) {
      console.error('Error fetching third place data:', error);
      setLoadError(true);
      setErrorModal({ title: 'Error', message: 'Could not load third place teams. Please check your connection.', goBack: true });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return { selectedCount: freshSelectedCount };
  };

  const checkAllThirdPlaceComplete = (teamList: ThirdPlaceTeam[]) => {
    const filled = teamList.filter(t => t.is_selected);
    return filled.length >= 8;
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
      const { selectedCount } = await fetchData();
      
      if (onFirstTimeComplete && selectedCount >= 8) {
        const userId = getCurrentUserId();
        if (userId) {
          const storageKey = `thirdplace_first_complete_${userId}`;
          const alreadyDone = await AsyncStorage.getItem(storageKey);
          if (!alreadyDone) {
            await AsyncStorage.setItem(storageKey, 'true');
            setTimeout(() => onFirstTimeComplete(), 400);
            return;
          }
        }
      }
      
      if (selectedCount >= 8) {
        setShowCompletionModal(true);
      }
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
    if (!isThirdPlaceEditable && !isPreTournament) return;
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
      showToast('Please select exactly 8 teams', 'error');
      return;
    }

    setSaving(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated' });
        setSaving(false);
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
      
      showToast('Prediction saved!', 'success');
      
      const { selectedCount } = await fetchData();
      
      // Check first-time completion
      if (onFirstTimeComplete && selectedCount >= 8) {
        const userId = getCurrentUserId();
        if (userId) {
          const storageKey = `thirdplace_first_complete_${userId}`;
          const alreadyDone = await AsyncStorage.getItem(storageKey);
          if (!alreadyDone) {
            await AsyncStorage.setItem(storageKey, 'true');
            setTimeout(() => onFirstTimeComplete(), 400);
            return; // skip the completionModal — navigation replaces it
          }
        }
      }
      
      if (selectedCount >= 8) {
        setShowCompletionModal(true);
      }
    } catch (error) {
      console.error('Error saving third place prediction:', error);
      setErrorModal({ title: 'Error', message: 'Could not save prediction. Please try again.' });
    } finally {
      setSaving(false);
      hasStartedEditing.current = false;
    }
  };

  const handleSave = async () => {
    if (!isThirdPlaceEditable) return;
    if (calculateThirdPlaceChanges === 0) {
      showToast('No changes to save', 'info');
      return;
    }
    setFineModalVisible(true);
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
          <View style={styles.teamFlagWrapper}>
            <Image source={{ uri: item.flag_url }} style={styles.teamFlag} />
          </View>
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

  // Show message if no teams available (user hasn't completed group predictions)
  if (teams.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons
          name={loadError ? "cloud-offline-outline" : "football-outline"}
          size={56}
          color={loadError ? "#f87171" : "#86efac"}
        />
        <Text style={styles.emptyStateTitle}>
          {loadError ? 'Could not load data' : 'Complete Group Stage First'}
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {loadError
            ? 'Please check your connection and try again'
            : 'Predict all 12 groups before selecting 3rd place teams'}
        </Text>
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

  // Calculate number of correct predictions if there are results
  const hasResult = thirdPlaceResult !== null;
  let correctCount = 0;

  const netScore = showNetScore ? (thirdPlaceScore ?? 0) - thirdPlacePenalty : null;
  const getPointsPillStyle = () => {
    if (!showNetScore || netScore === null) return {};
    if (netScore > 0) return {};
    if (netScore === 0) return styles.pointsContainerZero;
    return styles.pointsContainerNegative;
  };
  const displayPoints = showNetScore && netScore !== null ? netScore : (thirdPlaceScore ?? 0);
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
          {/* LEFT: Stats button (icon-only circle) */}
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setShowStats(true)}
              style={styles.statsButton}
              activeOpacity={0.75}
            >
              <Ionicons name="stats-chart" size={16} color="#38bdf8" />
            </TouchableOpacity>
          </View>

          {/* CENTER: Counter badge */}
          <View style={styles.headerCenter}>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {hasResult ? `Correct: ${correctCount}/8` : `Selected: ${selectedTeams.size}/8`}
              </Text>
            </View>
          </View>

          {/* RIGHT: Net Score toggle + Points pill, or Save button, or empty */}
          <View style={styles.headerRight}>
            {showPoints ? (
              <>
                <TouchableOpacity
                  style={[styles.netScoreToggle, showNetScore && styles.netScoreToggleActive]}
                  onPress={() => setShowNetScore(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={14}
                    color={showNetScore ? '#16a34a' : '#64748b'}
                  />
                  <Text style={[styles.netScoreToggleText, showNetScore && styles.netScoreToggleTextActive]}>
                    Net Score
                  </Text>
                </TouchableOpacity>
                <View style={[styles.pointsContainer, getPointsPillStyle()]}>
                  <Text style={styles.totalPoints}>{displayPoints} pts</Text>
                </View>
              </>
            ) : showSaveButton ? (
              <TouchableOpacity
                style={[styles.saveButton, (saving || selectedTeams.size !== 8 || !hasChanges) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || selectedTeams.size !== 8 || !hasChanges}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ minWidth: 36 }} />
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

      {/* Fine Confirmation Modal */}
      <FineConfirmationModal
        visible={fineModalVisible}
        finePoints={calculateThirdPlaceChanges * (finePerChange ?? 0)}
        onConfirm={() => {
          setFineModalVisible(false);
          performSave();
        }}
        onCancel={() => setFineModalVisible(false)}
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

      {/* Third Place Completion Modal */}
      <Modal visible={showCompletionModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCompletionModal(false)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={styles.completionCard}>
              <Text style={styles.completionTitle}>All 8 Groups Done!</Text>
              <Text style={styles.completionSubtitle}>
                You've selected your third-place team from every group.
                Ready to predict the knockout stage?
              </Text>
              <View style={styles.completionButtons}>
                <TouchableOpacity
                  style={styles.completionStayButton}
                  onPress={() => setShowCompletionModal(false)}
                >
                  <Text style={styles.completionStayText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    Stay Here
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completionKnockoutButton}
                  onPress={() => {
                    setShowCompletionModal(false);
                    navigation.navigate('Knockout' as never);
                  }}
                >
                  <Text style={styles.completionKnockoutText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    Knockout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#1e293b',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerLeft: {
    flex: 0,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterBadge: {
    backgroundColor: '#152a45',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
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
  pointsContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointsContainerZero: {
    backgroundColor: '#f59e0b',
  },
  pointsContainerNegative: {
    backgroundColor: '#ef4444',
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
  totalPoints: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(2,132,199,0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(2,132,199,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  headerRightSpacer: {
    minWidth: 90,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    padding: 8,
  },
  teamCard: {
    flex: 1,
    margin: 4,
    padding: 8,
    backgroundColor: '#1e3a5f',
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
    backgroundColor: 'rgba(72,187,120,0.1)',
  },
  teamCardCorrectPick: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  teamCardChanged: {
    borderColor: '#f6ad55',
  },
  teamCardIncorrect: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  teamCardMissed: {
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  teamFlagWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 6,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  teamFlag: {
    width: 40,
    height: 28,
    borderRadius: 4,
  },
  teamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e2e8f0',
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
    marginBottom: 8, // Increased distance between team name and group name
  },
  groupName: {
    fontSize: 12,
    color: '#94a3b8',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  completionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 10,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  completionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  completionStayButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  completionStayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  completionKnockoutButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionKnockoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
});