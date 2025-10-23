import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { GroupPrediction, apiService, GroupsResponse } from '../../services/api';
import GroupCard from '../../components/GroupCard';
import { useTournament } from '../../contexts/TournamentContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<GroupPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [incompleteGroups, setIncompleteGroups] = useState<number[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<number, {
    first_place: number | null;
    second_place: number | null;
    third_place: number | null;
    fourth_place: number | null;
  }>>(new Map());

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();

  // Calculate number of changes in groups (positions 1-3 only)
  const calculateGroupChanges = () => {
    let totalChanges = 0;
    
    pendingChanges.forEach((positions, groupId) => {
      const group = groups.find(g => g.group_id === groupId);
      if (!group) return;
      
      // Get original positions (1-3 only)
      const originalPositions = {
        first_place: group.first_place,
        second_place: group.second_place,
        third_place: group.third_place,
      };
      
      // Count changes in positions 1-3
      if (positions.first_place !== null && positions.first_place !== originalPositions.first_place) {
        totalChanges++;
      }
      if (positions.second_place !== null && positions.second_place !== originalPositions.second_place) {
        totalChanges++;
      }
      if (positions.third_place !== null && positions.third_place !== originalPositions.third_place) {
        totalChanges++;
      }
    });
    
    return totalChanges;
  };

  const fetchGroups = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      const data: GroupsResponse = await apiService.getGroupPredictions(userId);
      setGroups(data.groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', 'Could not load groups. Please check that the server is running.');
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
        // Complete prediction
        completeGroups.push({
          group_id: groupId,
          first_place: positions.first_place!,
          second_place: positions.second_place!,
          third_place: positions.third_place!,
          fourth_place: positions.fourth_place!,
        });
      } else if (filledCount > 0 && filledCount < 4) {
        // Incomplete prediction
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
      
      Alert.alert(
        'Incomplete Predictions',
        `Please complete all 4 positions for: ${groupNames}`,
        [{ text: 'OK' }]
      );
      
      // Keep highlights until user completes them or saves successfully
    }

    // If no complete groups to save, return
    if (completeGroups.length === 0) {
      if (incompleteGroupIds.length === 0) {
        Alert.alert('No Changes', 'No predictions to save');
      }
      return;
    }

    // Save complete groups
    setSaving(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
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
      
      // Update groups state with saved predictions and sort teams
      setGroups(prevGroups => {
        return prevGroups.map(group => {
          const savedGroup = completeGroups.find(g => g.group_id === group.group_id);
          if (savedGroup) {
            // Sort teams according to predictions
            const sortedTeams = [...group.teams].sort((a, b) => {
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
            });
            
            return {
              ...group,
              id: group.id || Date.now(), // Assign temp ID if null
              teams: sortedTeams, // Sorted teams
              first_place: savedGroup.first_place,
              second_place: savedGroup.second_place,
              third_place: savedGroup.third_place,
              fourth_place: savedGroup.fourth_place,
            };
          }
          return group;
        });
      });
      
      // No success alert - silent save
    } catch (error) {
      console.error('Error saving predictions:', error);
      Alert.alert('Error', 'Could not save predictions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const numberOfChanges = calculateGroupChanges();
    
    if (numberOfChanges === 0) {
      Alert.alert('No Changes', 'No predictions to save');
      return;
    }

    // Use the generic penalty confirmation hook
    showPenaltyConfirmation(performSave, numberOfChanges);
  };

  const handleTeamPress = (groupId: number, teamId: number) => {
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

        // Check if 3 teams are selected - auto-assign the 4th with delay
        const selectedCount = [
          positions.first_place,
          positions.second_place,
          positions.third_place,
          positions.fourth_place,
        ].filter(p => p !== null).length;

        if (selectedCount === 3) {
          // Find the unselected team
          const unselectedTeam = group.teams.find(
            team =>
              team.id !== positions.first_place &&
              team.id !== positions.second_place &&
              team.id !== positions.third_place &&
              team.id !== positions.fourth_place
          );

          if (unselectedTeam) {
            // Delay the auto-assignment of the 4th team by 150ms
            setTimeout(() => {
              setPendingChanges(prevChanges => {
                const updatedChanges = new Map(prevChanges);
                const currentPositions = updatedChanges.get(groupId);
                
                if (!currentPositions) return updatedChanges;

                // Assign to the remaining empty position
                const newPositions = { ...currentPositions };
                if (newPositions.first_place === null) {
                  newPositions.first_place = unselectedTeam.id;
                } else if (newPositions.second_place === null) {
                  newPositions.second_place = unselectedTeam.id;
                } else if (newPositions.third_place === null) {
                  newPositions.third_place = unselectedTeam.id;
                } else if (newPositions.fourth_place === null) {
                  newPositions.fourth_place = unselectedTeam.id;
                }

                updatedChanges.set(groupId, newPositions);
                return updatedChanges;
              });
            }, 150);
          }
        }

        return newChanges;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No groups available</Text>
        <Text style={styles.emptySubtext}>Check that the server is running and groups are created</Text>
      </View>
    );
  }

  // Check if there are any complete pending changes to save
  const hasChanges = Array.from(pendingChanges.values()).some(positions => {
    const positionsArray = [positions.first_place, positions.second_place, positions.third_place, positions.fourth_place];
    return positionsArray.filter(p => p !== null).length === 4;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {hasChanges && (
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
          } : item;

          return (
            <GroupCard 
              group={displayGroup} 
              onTeamPress={handleTeamPress}
              isIncomplete={incompleteGroups.includes(item.group_id)}
            />
          );
        }}
        keyExtractor={(item) => item.group_id.toString()}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
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
    backgroundColor: '#f7fafc',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
});
