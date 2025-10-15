import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThirdPlaceTeam, apiService } from '../../services/api';

interface ThirdPlaceScreenProps {}

export default function ThirdPlaceScreen({}: ThirdPlaceScreenProps) {
  const [teams, setTeams] = useState<ThirdPlaceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(new Set());
  const [changedGroups, setChangedGroups] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const data = await apiService.getThirdPlacePredictionsData(1); // Using user_id = 1 for now
      setTeams(data.eligible_teams);
      
      // Initialize selected teams from existing prediction
      const selectedSet = new Set<number>();
      data.eligible_teams.forEach(team => {
        if (team.is_selected) {
          selectedSet.add(team.id);
        }
      });
      setSelectedTeams(selectedSet);
      
      // Initialize changed groups from prediction data
      setChangedGroups(data.prediction.changed_groups || []);
    } catch (error) {
      console.error('Error fetching third place data:', error);
      Alert.alert('Error', 'Could not load third place teams. Please check that the server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTeamPress = (teamId: number) => {
    // Find the team to get its group name
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    let wasActionSuccessful = false;
    
    setSelectedTeams(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(teamId)) {
        // Removing a team - always allowed
        newSelected.delete(teamId);
        wasActionSuccessful = true;
      } else {
        // Adding a team - check if we can add more teams (max 8)
        if (newSelected.size < 8) {
          newSelected.add(teamId);
          wasActionSuccessful = true;
        } else {
          Alert.alert('Maximum Reached', 'You can only select 8 teams to advance.');
          wasActionSuccessful = false;
        }
      }
      return newSelected;
    });
    
    // Only update changed groups if the action was successful
    if (wasActionSuccessful) {
      setChangedGroups(prev => {
        const newChanged = prev.filter(groupName => groupName !== team.group_name);
        return newChanged;
      });
    }
  };

  const handleSave = async () => {
    if (selectedTeams.size === 0) {
      Alert.alert('No Selection', 'Please select at least one team to advance.');
      return;
    }

    setSaving(true);
    try {
      const advancingTeamIds = Array.from(selectedTeams);
      const result = await apiService.updateThirdPlacePrediction(1, advancingTeamIds);
      console.log('Save result:', result);
      
      Alert.alert('Success', 'Third place prediction saved successfully!');
      
      // Refresh data to get updated prediction info
      await fetchData();
    } catch (error) {
      console.error('Error saving third place prediction:', error);
      Alert.alert('Error', 'Could not save prediction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderTeam = ({ item }: { item: ThirdPlaceTeam }) => {
    const isSelected = selectedTeams.has(item.id);
    const isChanged = changedGroups.includes(item.group_name);
    
    // Logic: Changed (yellow border) + Selected (green background) can coexist
    let cardStyle: any = styles.teamCard;
    if (isChanged && isSelected) {
      // Both changed and selected: yellow border + green background
      cardStyle = [styles.teamCard, styles.teamCardSelected, styles.teamCardChanged];
    } else if (isChanged) {
      // Only changed: yellow border only
      cardStyle = [styles.teamCard, styles.teamCardChanged];
    } else if (isSelected) {
      // Only selected: green border + green background
      cardStyle = [styles.teamCard, styles.teamCardSelected];
    }
    
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={() => handleTeamPress(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.teamName}>{item.name}</Text>
        <Text style={styles.groupName}>Group {item.group_name}</Text>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedText}>✓</Text>
          </View>
        )}
        {isChanged && (
          <View style={styles.changedIndicator}>
            <Text style={styles.changedText}>!</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading third place teams...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>3rd Place Qualifiers</Text>
          {selectedTeams.size > 0 && (
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
        <Text style={styles.subtitle}>Select 8 teams that will advance from 3rd place</Text>
        <Text style={styles.counter}>
          Selected: {selectedTeams.size}/8
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
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
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 8,
  },
  counter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38a169',
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
  listContainer: {
    padding: 8,
  },
  teamCard: {
    flex: 1,
    margin: 4,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
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
  teamCardChanged: {
    borderColor: '#f6ad55',
  },
  teamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#48bb78',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
});