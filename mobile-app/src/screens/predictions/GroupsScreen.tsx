import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupPrediction, apiService, GroupsResponse } from '../../services/api';
import GroupCard from '../../components/cards/GroupCard';
import { useTournament } from '../../contexts/TournamentContext';
import { useAuth } from '../../contexts/AuthContext';
import { FineConfirmationModal, UnsavedChangesModal, ErrorModal, ValidationModal } from '../../components/modals/CustomModals';
import { useToast } from '../../components/toast/Toast';

export default function GroupsScreen() {
  const { showToast } = useToast();
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [validationModal, setValidationModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [groups, setGroups] = useState<GroupPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [incompleteGroups, setIncompleteGroups] = useState<number[]>([]);
  const [groupsScore, setGroupsScore] = useState<number | null>(null);
  const [groupsPenalty, setGroupsPenalty] = useState<number>(0);
  const [showNetScore, setShowNetScore] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<number, {
    first_place: number | null;
    second_place: number | null;
    third_place: number | null;
    fourth_place: number | null;
  }>>(new Map());
  const [fineModalVisible, setFineModalVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<any>(null);

  // Get tournament context data
  const { currentStage, finePerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();

  const isPreTournament = currentStage === 'PRE_GROUP_STAGE';
  const isGroupEditable =
    currentStage === 'PRE_GROUP_STAGE' ||
    currentStage === 'GROUP_CYCLE_1' ||
    currentStage === 'GROUP_CYCLE_2';
  const isActiveGroupCycle =
    currentStage === 'GROUP_CYCLE_1' ||
    currentStage === 'GROUP_CYCLE_2';

  // Get current user ID
  const { getCurrentUserId } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  // Intercept back navigation when there are unsaved changes (not in PRE_GROUP_STAGE)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isFocused || isPreTournament || pendingChanges.size === 0) return;
      e.preventDefault();
      setPendingNavAction(e.data.action);
      setExitModalVisible(true);
    });
    return unsubscribe;
  }, [navigation, isPreTournament, pendingChanges.size, isFocused]);

  // Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!isPreTournament && pendingChanges.size > 0) {
          setPendingNavAction(null);
          setExitModalVisible(true);
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isPreTournament, pendingChanges.size])
  );

  const calculateGroupChanges = () => {
    let totalChanges = 0;

    pendingChanges.forEach((positions, groupId) => {
      const group = groups.find(g => g.group_id === groupId);
      if (!group) return;

      // Count ONLY positions 1-3 (position 4 has no point impact)
      if (positions.first_place !== null &&
          positions.first_place !== group.first_place) totalChanges++;
      if (positions.second_place !== null &&
          positions.second_place !== group.second_place) totalChanges++;
      if (positions.third_place !== null &&
          positions.third_place !== group.third_place) totalChanges++;
      // fourth_place intentionally excluded
    });

    return totalChanges;
  };

  const fetchGroups = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
        setLoading(false);
        return;
      }
      
      const data: GroupsResponse = await apiService.getGroupPredictions(userId);
      
      // Sort teams for groups with all 4 positions filled
      const sortedGroups = data.groups.map(group => {
        const allPositionsFilled = 
          group.first_place !== null && 
          group.second_place !== null && 
          group.third_place !== null && 
          group.fourth_place !== null;
        
        // Sort teams ONLY if all 4 positions are filled
        if (allPositionsFilled) {
          const sortedTeams = [...group.teams].sort((a, b) => {
            // Find position for each team
            let posA = 5; // default (not predicted)
            let posB = 5;
            
            if (a.id === group.first_place) posA = 1;
            else if (a.id === group.second_place) posA = 2;
            else if (a.id === group.third_place) posA = 3;
            else if (a.id === group.fourth_place) posA = 4;
            
            if (b.id === group.first_place) posB = 1;
            else if (b.id === group.second_place) posB = 2;
            else if (b.id === group.third_place) posB = 3;
            else if (b.id === group.fourth_place) posB = 4;
            
            return posA - posB;
          });
          
          return { ...group, teams: sortedTeams };
        }
        
        // Keep original order if not all filled
        return group;
      });
      
      setGroups(sortedGroups);
      setGroupsScore(data.groups_score);
      setGroupsPenalty(data.groups_penalty ?? 0);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setErrorModal({ title: 'Error', message: 'Could not load groups. Please check your connection.', goBack: true });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // Clear pending changes and incomplete highlights on manual refresh
    setPendingChanges(new Map());
    setIncompleteGroups([]);
    fetchGroups();
  };

  const autoSaveGroup = async (
    groupId: number,
    positions: { first_place: number | null; second_place: number | null; third_place: number | null; fourth_place: number | null }
  ) => {
    if (!isPreTournament) return;
    const { first_place, second_place, third_place, fourth_place } = positions;
    if (first_place === null || second_place === null || third_place === null || fourth_place === null) return;

    const userId = getCurrentUserId();
    if (!userId) return;

    setAutoSaving(true);
    try {
      await apiService.updateBatchGroupPredictions(userId, [{
        group_id: groupId,
        first_place,
        second_place,
        third_place,
        fourth_place,
      }]);

      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(groupId);
        return next;
      });

      setGroups(prevGroups => {
        return prevGroups.map(group => {
          if (group.group_id === groupId) {
            const sortedTeams = [...group.teams].sort((a, b) => {
              let posA = 5, posB = 5;
              if (a.id === first_place) posA = 1;
              else if (a.id === second_place) posA = 2;
              else if (a.id === third_place) posA = 3;
              else if (a.id === fourth_place) posA = 4;
              if (b.id === first_place) posB = 1;
              else if (b.id === second_place) posB = 2;
              else if (b.id === third_place) posB = 3;
              else if (b.id === fourth_place) posB = 4;
              return posA - posB;
            });
            return {
              ...group,
              teams: sortedTeams,
              first_place,
              second_place,
              third_place,
              fourth_place,
            };
          }
          return group;
        });
      });

      await AsyncStorage.setItem('earlyStageUpdated', JSON.stringify({
        stage: 'groups',
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error auto-saving group:', error);
      showToast('Could not save, please try again', 'error');
    } finally {
      setAutoSaving(false);
    }
  };

  const performSave = async () => {
    // Only process groups with pending changes
    const completeGroups: Array<{
      group_id: number;
      first_place: number;
      second_place: number;
      third_place: number;
      fourth_place: number;
    }> = [];
    
    const incompleteGroupIds: number[] = [];

    // Iterate only over pending changes
    pendingChanges.forEach((positions, groupId) => {
      const positionsArray = [
        positions.first_place,
        positions.second_place,
        positions.third_place,
        positions.fourth_place,
      ];
      
      const filledCount = positionsArray.filter(p => p !== null).length;
      
      if (filledCount === 4) {
        // Complete prediction - all 4 positions filled
        completeGroups.push({
          group_id: groupId,
          first_place: positions.first_place!,
          second_place: positions.second_place!,
          third_place: positions.third_place!,
          fourth_place: positions.fourth_place!,
        });
      } else if (filledCount === 3) {
        // 3 positions filled - auto-complete the 4th before saving
        const group = groups.find(g => g.group_id === groupId);
        if (group) {
          // Find the unselected team
          const selectedTeamIds = [
            positions.first_place,
            positions.second_place,
            positions.third_place,
            positions.fourth_place,
          ].filter(id => id !== null) as number[];
          
          const unselectedTeam = group.teams.find(
            team => !selectedTeamIds.includes(team.id)
          );
          
          if (unselectedTeam) {
            // Auto-complete the missing position
            const completedPositions = { ...positions };
            if (completedPositions.first_place === null) {
              completedPositions.first_place = unselectedTeam.id;
            } else if (completedPositions.second_place === null) {
              completedPositions.second_place = unselectedTeam.id;
            } else if (completedPositions.third_place === null) {
              completedPositions.third_place = unselectedTeam.id;
            } else if (completedPositions.fourth_place === null) {
              completedPositions.fourth_place = unselectedTeam.id;
            }
            
            completeGroups.push({
              group_id: groupId,
              first_place: completedPositions.first_place!,
              second_place: completedPositions.second_place!,
              third_place: completedPositions.third_place!,
              fourth_place: completedPositions.fourth_place!,
            });
          }
        }
      } else if (filledCount > 0 && filledCount < 3) {
        // Less than 3 positions filled - incomplete prediction
        incompleteGroupIds.push(groupId);
      }
      // filledCount === 0 means empty - ignore
    });

    // If there are incomplete groups, show alert and highlight them
    if (incompleteGroupIds.length > 0) {
      setIncompleteGroups(incompleteGroupIds);
      const groupNames = incompleteGroupIds
        .map(id => {
          const group = groups.find(g => g.group_id === id);
          return group ? `Group ${group.group_name}` : '';
        })
        .filter(name => name !== '')
        .join(', ');
      
      setValidationModal({
        title: 'Incomplete Predictions',
        message: `Please complete at least 3 positions for: ${groupNames}`,
      });
      
      // Keep highlights until user completes them or saves successfully
    }

    // If no complete groups to save, return
    if (completeGroups.length === 0) {
      if (incompleteGroupIds.length === 0) {
        showToast('No predictions to save', 'info');
      }
      return;
    }

    // Save complete groups
    setSaving(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated' });
        return;
      }
      
      const result = await apiService.updateBatchGroupPredictions(userId, completeGroups);
      console.log('Save result:', result);
      
      // Clear pending changes ONLY for saved groups (not incomplete ones!)
      setPendingChanges(prevChanges => {
        const newChanges = new Map(prevChanges);
        completeGroups.forEach(g => newChanges.delete(g.group_id));
        return newChanges;
      });
      
      // Clear incomplete highlights ONLY for groups that became complete and were saved
      setIncompleteGroups(prev => 
        prev.filter(id => !completeGroups.some(g => g.group_id === id))
      );
      
      // Update groups state with saved predictions and sort teams ONLY if all 4 positions are filled
      setGroups(prevGroups => {
        return prevGroups.map(group => {
          const savedGroup = completeGroups.find(g => g.group_id === group.group_id);
          if (savedGroup) {
            // Check if all 4 positions are filled
            const allPositionsFilled = 
              savedGroup.first_place !== null && 
              savedGroup.second_place !== null && 
              savedGroup.third_place !== null && 
              savedGroup.fourth_place !== null;
            
            // Sort teams ONLY if all 4 positions are filled
            const sortedTeams = allPositionsFilled ? [...group.teams].sort((a, b) => {
              // Find position for each team
              let posA = 5; // default (not predicted)
              let posB = 5;
              
              if (a.id === savedGroup.first_place) posA = 1;
              else if (a.id === savedGroup.second_place) posA = 2;
              else if (a.id === savedGroup.third_place) posA = 3;
              else if (a.id === savedGroup.fourth_place) posA = 4;
              
              if (b.id === savedGroup.first_place) posB = 1;
              else if (b.id === savedGroup.second_place) posB = 2;
              else if (b.id === savedGroup.third_place) posB = 3;
              else if (b.id === savedGroup.fourth_place) posB = 4;
              
              return posA - posB;
            }) : group.teams; // Keep original order if not all filled
            
            return {
              ...group,
              id: group.id || Date.now(), // Assign temp ID if null
              teams: sortedTeams, // Sorted teams (only if all filled)
              first_place: savedGroup.first_place,
              second_place: savedGroup.second_place,
              third_place: savedGroup.third_place,
              fourth_place: savedGroup.fourth_place,
            };
          }
          return group;
        });
      });
      
      // Mark that groups stage was updated - this will trigger refresh in knockout screens
      await AsyncStorage.setItem('earlyStageUpdated', JSON.stringify({
        stage: 'groups',
        timestamp: Date.now()
      }));
      console.log('✅ Groups stage updated - marked for knockout refresh');
      
      // No success alert - silent save
    } catch (error) {
      console.error('Error saving predictions:', error);
      setErrorModal({ title: 'Error', message: 'Could not save predictions. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isGroupEditable) return;
    const numberOfChanges = calculateGroupChanges();
    if (numberOfChanges === 0) {
      showToast('No predictions to save', 'info');
      return;
    }
    setFineModalVisible(true);
  };

  const handleTeamPress = (groupId: number, teamId: number) => {
    if (!isGroupEditable) return;
    setPendingChanges(prevChanges => {
      const newChanges = new Map(prevChanges);
      
      // Get current group data
      const group = groups.find(g => g.group_id === groupId);
      if (!group) return newChanges;
      
      // Get current positions (from pending changes or original data)
      const currentPending = newChanges.get(groupId);
      
      // Always work with a complete positions object
      // If there's no pending change yet, copy all current values from group
      let positions;
      if (currentPending) {
        positions = { ...currentPending };
      } else {
        // First edit to this group - copy all original positions
        positions = {
          first_place: group.first_place,
          second_place: group.second_place,
          third_place: group.third_place,
          fourth_place: group.fourth_place,
        };
      }

      console.log(`Group ${groupId}, Team ${teamId} - Current positions:`, positions);

      // Check if team is already selected
      let wasRemoved = false;
      if (positions.first_place === teamId) {
        console.log('Removing from first_place');
        positions.first_place = null;
        wasRemoved = true;
      } else if (positions.second_place === teamId) {
        console.log('Removing from second_place');
        positions.second_place = null;
        wasRemoved = true;
      } else if (positions.third_place === teamId) {
        console.log('Removing from third_place');
        positions.third_place = null;
        wasRemoved = true;
      } else if (positions.fourth_place === teamId) {
        console.log('Removing from fourth_place');
        positions.fourth_place = null;
        wasRemoved = true;
      }

      // If team was removed, save to pending changes
      if (wasRemoved) {
        newChanges.set(groupId, positions);
        return newChanges;
      }

      // Team is not selected - assign to best available position
      if (positions.first_place === null) {
        positions.first_place = teamId;
      } else if (positions.second_place === null) {
        positions.second_place = teamId;
      } else if (positions.third_place === null) {
        positions.third_place = teamId;
      } else if (positions.fourth_place === null) {
        positions.fourth_place = teamId;
      }

      // Save to pending changes
      newChanges.set(groupId, positions);

      if (isPreTournament) {
        const allFilled =
          positions.first_place !== null &&
          positions.second_place !== null &&
          positions.third_place !== null &&
          positions.fourth_place !== null;
        if (allFilled) {
          autoSaveGroup(groupId, positions);
        }
      }

      return newChanges;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading groups...</Text>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title ?? 'Error'}
          message={errorModal?.message ?? ''}
          onClose={() => setErrorModal(null)}
          {...(errorModal?.goBack && {
            onGoBack: () => {
              setErrorModal(null);
              navigation.goBack();
            },
            goBackLabel: 'Go Back',
          })}
        />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cloud-offline-outline" size={56} color="#f87171" />
        <Text style={styles.emptyText}>Could not load groups</Text>
        <Text style={styles.emptySubtext}>Please check your connection and try again</Text>
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

  const numberOfChanges = calculateGroupChanges();
  const hasChanges = numberOfChanges > 0;
  const showSaveButton = isActiveGroupCycle;
  const hasAnyGroupResult = groups.some(
    g => g.result !== null && g.result !== undefined
  );
  const showPoints = hasAnyGroupResult && groupsScore !== null;
  const showNetScoreToggle = hasAnyGroupResult;

  const netTotal = showNetScore && groupsScore !== null
    ? (groupsScore ?? 0) - groupsPenalty
    : null;
  const getPointsPillStyle = () => {
    if (!showNetScore || netTotal === null) {
      return styles.pointsContainer;
    }
    if (netTotal > 0) return styles.pointsContainer;
    if (netTotal === 0) return styles.pointsContainerZero;
    return styles.pointsContainerNegative;
  };
  const displayPoints = showNetScore && netTotal !== null
    ? netTotal
    : (groupsScore ?? 0);

  return (
    <View style={styles.container}>
      {(showSaveButton || showPoints) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showSaveButton && (
              <TouchableOpacity
                style={[styles.saveButton, (!hasChanges || saving || autoSaving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!hasChanges || saving || autoSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {(saving || autoSaving) ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerRightRow}>
              {numberOfChanges > 0 && (
                <View style={styles.changesCounter}>
                  <Ionicons name="create-outline" size={13} color="#f97316" />
                  <Text style={styles.changesCounterText}>{numberOfChanges} total changes</Text>
                </View>
              )}
              {showNetScoreToggle && (
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
              )}
              {showPoints && (
                <View style={[styles.pointsContainer, getPointsPillStyle()]}>
                  <Text style={styles.totalPoints}>{displayPoints} pts</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
      <FlatList
        data={groups}
        renderItem={({ item }) => {
          // Merge pending changes with original data
          const pendingChange = pendingChanges.get(item.group_id);
          const displayGroup = pendingChange ? {
            ...item,
            first_place: pendingChange.first_place,
            second_place: pendingChange.second_place,
            third_place: pendingChange.third_place,
            fourth_place: pendingChange.fourth_place,
            // Keep original points, result, and is_editable from server
          } : item;

          return (
            <GroupCard 
              group={displayGroup} 
              onTeamPress={handleTeamPress}
              isIncomplete={incompleteGroups.includes(item.group_id)}
              hasPendingChanges={!!pendingChange}
              showNetScore={showNetScore}
            />
          );
        }}
        keyExtractor={(item) => item.group_id.toString()}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        numColumns={1}
        contentContainerStyle={styles.listContainer}
      />

      <FineConfirmationModal
        visible={fineModalVisible}
        finePoints={calculateGroupChanges() * (finePerChange ?? 0)}
        onConfirm={() => {
          setFineModalVisible(false);
          performSave();
        }}
        onCancel={() => setFineModalVisible(false)}
      />

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
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
        {...(errorModal?.goBack && {
          onGoBack: () => {
            setErrorModal(null);
            navigation.goBack();
          },
          goBackLabel: 'Go Back',
        })}
      />
      <ValidationModal
        visible={!!validationModal}
        title={validationModal?.title ?? ''}
        message={validationModal?.message ?? ''}
        onClose={() => setValidationModal(null)}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  changesCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
    marginBottom: 6,
  },
  changesCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  netScoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  netScoreToggleActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  netScoreToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  netScoreToggleTextActive: {
    color: '#16a34a',
  },
  pointsContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 4,
  },
  pointsContainerZero: {
    backgroundColor: '#f59e0b',
  },
  pointsContainerNegative: {
    backgroundColor: '#ef4444',
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
  autoSaveText: {
    fontSize: 14,
    color: '#6b7280',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
