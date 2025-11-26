import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';

interface Team {
  id: number;
  name: string;
  flag_url?: string;
  short_name?: string;
}

interface GroupResult {
  group_id: number;
  group_name: string;
  teams: Team[];
  result?: {
    first_place: number;
    second_place: number;
    third_place: number;
    fourth_place: number;
  } | null;
}

export default function AdminGroupsScreen() {
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<{
    first: number | null;
    second: number | null;
    third: number | null;
    fourth: number | null;
  }>({
    first: null,
    second: null,
    third: null,
    fourth: null,
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const data = await apiService.getAdminGroups();
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', `Could not load groups: ${error}`);
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleEditGroup = (group: GroupResult) => {
    setEditingGroupId(group.group_id);
    setSelectedPositions({
      first: group.result?.first_place || null,
      second: group.result?.second_place || null,
      third: group.result?.third_place || null,
      fourth: group.result?.fourth_place || null,
    });
  };

  const handleTeamPress = (teamId: number) => {
    setSelectedPositions(prevPositions => {
      const newPositions = { ...prevPositions };
      
      // Check if team is already selected - if yes, remove it
      if (newPositions.first === teamId) {
        newPositions.first = null;
      } else if (newPositions.second === teamId) {
        newPositions.second = null;
      } else if (newPositions.third === teamId) {
        newPositions.third = null;
      } else if (newPositions.fourth === teamId) {
        newPositions.fourth = null;
      } else {
        // Team is not selected - assign to best available position
        if (newPositions.first === null) {
          newPositions.first = teamId;
        } else if (newPositions.second === null) {
          newPositions.second = teamId;
        } else if (newPositions.third === null) {
          newPositions.third = teamId;
        } else if (newPositions.fourth === null) {
          newPositions.fourth = teamId;
        }
      }
      
      return newPositions;
    });
  };

  const handleSaveResult = async (groupId: number) => {
    if (!selectedPositions.first || !selectedPositions.second || 
        !selectedPositions.third || !selectedPositions.fourth) {
      Alert.alert('Error', 'Please select all 4 positions');
      return;
    }

    // Check that all positions are different
    const positions = [
      selectedPositions.first,
      selectedPositions.second,
      selectedPositions.third,
      selectedPositions.fourth,
    ];
    if (new Set(positions).size !== 4) {
      Alert.alert('Error', 'All 4 positions must be different');
      return;
    }

    setSaving(true);
    try {
      await apiService.updateGroupResult(groupId, {
        first_place: selectedPositions.first!,
        second_place: selectedPositions.second!,
        third_place: selectedPositions.third!,
        fourth_place: selectedPositions.fourth!,
      });
      Alert.alert('Success', 'Group result updated successfully');
      setEditingGroupId(null);
      fetchGroups();
    } catch (error: any) {
      console.error('Error updating group result:', error);
      const errorMessage = error?.message || error?.detail || JSON.stringify(error) || 'Could not update group result';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    const group = groups.find(g => g.group_id === editingGroupId);
    if (group) {
      setSelectedPositions({
        first: group.result?.first_place || null,
        second: group.result?.second_place || null,
        third: group.result?.third_place || null,
        fourth: group.result?.fourth_place || null,
      });
    }
    setEditingGroupId(null);
  };

  const getTeamNameById = (teamId: number | null, teams: Team[]): string => {
    if (!teamId) return 'Not set';
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown';
  };

  const getTeamPosition = (teamId: number): number | null => {
    if (selectedPositions.first === teamId) return 1;
    if (selectedPositions.second === teamId) return 2;
    if (selectedPositions.third === teamId) return 3;
    if (selectedPositions.fourth === teamId) return 4;
    return null;
  };

  const GroupCard = ({ group }: { group: GroupResult }) => {
    const isEditing = editingGroupId === group.group_id;
    
    // Get positions for display - use selectedPositions if editing, otherwise use result
    const getDisplayPosition = (teamId: number): number | null => {
      if (isEditing) {
        return getTeamPosition(teamId);
      }
      if (group.result) {
        if (group.result.first_place === teamId) return 1;
        if (group.result.second_place === teamId) return 2;
        if (group.result.third_place === teamId) return 3;
        if (group.result.fourth_place === teamId) return 4;
      }
      return null;
    };

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>Group {group.group_name}</Text>
          {isEditing && (
            <TouchableOpacity
              style={styles.saveHeaderButton}
              onPress={() => handleSaveResult(group.group_id)}
              disabled={saving}
            >
              <Text style={styles.saveHeaderButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}
          {!isEditing && (
            <TouchableOpacity
              style={styles.editHeaderButton}
              onPress={() => handleEditGroup(group)}
            >
              <Text style={styles.editHeaderButtonText}>
                {group.result ? 'Edit' : 'Set'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.teamsContainer}>
          <Text style={styles.teamsLabel}>Teams:</Text>
          {group.teams.map((team, index) => {
            const position = getDisplayPosition(team.id);
            const isSelected = position !== null;
            
            // Determine badge color based on position
            let badgeStyle = styles.positionBadge;
            if (position === 1 || position === 2) {
              badgeStyle = styles.positionBadgeQualified;
            } else if (position === 3) {
              badgeStyle = styles.positionBadgeWaiting;
            } else if (position === 4) {
              badgeStyle = styles.positionBadgeEliminated;
            }

            return (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamRow,
                  isEditing && styles.teamRowEditable,
                  isEditing && isSelected && styles.teamRowSelected,
                ]}
                onPress={() => {
                  if (isEditing) {
                    handleTeamPress(team.id);
                  }
                }}
                disabled={!isEditing}
              >
                <View style={badgeStyle}>
                  <Text style={styles.positionText}>
                    {position !== null ? position : ''}
                  </Text>
                </View>
                <View style={styles.teamInfo}>
                  {team.flag_url && (
                    <Image 
                      source={{ uri: team.flag_url }} 
                      style={styles.flag}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={[
                    styles.teamName,
                    isEditing && isSelected && styles.teamNameSelected,
                  ]}>
                    {team.name}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {isEditing && (
          <View style={styles.editingHint}>
            <Text style={styles.editingHintText}>
              Tap teams in order: 1st → 2nd → 3rd → 4th
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditingGroupId(null);
                // Reset to original result
                setSelectedPositions({
                  first: group.result?.first_place || null,
                  second: group.result?.second_place || null,
                  third: group.result?.third_place || null,
                  fourth: group.result?.fourth_place || null,
                });
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={groups}
        renderItem={({ item }) => <GroupCard group={item} />}
        keyExtractor={(item) => `group-${item.group_id}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No groups found</Text>
          </View>
        }
      />
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
  listContainer: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  editHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#dc2626',
  },
  editHeaderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#16a34a',
  },
  saveHeaderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  teamsContainer: {
    marginBottom: 16,
  },
  teamsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
  },
  teamRowEditable: {
    backgroundColor: '#f8fafc',
  },
  teamRowSelected: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  flag: {
    width: 32,
    height: 24,
    borderRadius: 4,
  },
  teamName: {
    fontSize: 16,
    color: '#1e293b',
  },
  resultContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultPosition: {
    fontSize: 14,
    color: '#64748b',
    width: 40,
  },
  resultTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  resultFlag: {
    width: 24,
    height: 18,
    borderRadius: 3,
  },
  resultTeamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  noResultContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  noResultText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  editingHint: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  editingHintText: {
    fontSize: 14,
    color: '#0369a1',
    textAlign: 'center',
    marginBottom: 8,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  positionBadgeQualified: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1e40af',
  },
  positionBadgeWaiting: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  positionBadgeEliminated: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#111827',
  },
  positionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamNameSelected: {
    fontWeight: '600',
    color: '#dc2626',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
  },
});
