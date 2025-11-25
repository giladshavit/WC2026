import React, { useState, useEffect, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';

interface ThirdPlaceTeam {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
  flag_url?: string;
}

export default function AdminThirdPlaceScreen() {
  const [teams, setTeams] = useState<ThirdPlaceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]); // Array to preserve order
  const [hasResult, setHasResult] = useState(false);

  const fetchData = async () => {
    try {
      const data = await apiService.getAdminThirdPlaceResults();
      
      // Handle eligible teams
      const eligibleTeams = data.eligible_teams || [];
      setTeams(eligibleTeams);
      
      // Initialize selected teams from existing result (if exists)
      if (data.has_result && data.result) {
        const result = data.result;
        const selected = [
          result.first_team_qualifying,
          result.second_team_qualifying,
          result.third_team_qualifying,
          result.fourth_team_qualifying,
          result.fifth_team_qualifying,
          result.sixth_team_qualifying,
          result.seventh_team_qualifying,
          result.eighth_team_qualifying,
        ].filter(id => id !== null && id !== undefined);
        setSelectedTeams(selected);
        setHasResult(true);
      } else {
        setSelectedTeams([]);
        setHasResult(false);
      }
    } catch (error) {
      console.error('Error fetching third place results:', error);
      Alert.alert('Error', `Could not load third place teams: ${error}`);
      setTeams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTeamPress = (teamId: number) => {
    setSelectedTeams(prev => {
      const index = prev.indexOf(teamId);
      
      if (index !== -1) {
        // Team is already selected - remove it
        return prev.filter(id => id !== teamId);
      } else {
        // Team is not selected - add it (max 8)
        if (prev.length < 8) {
          return [...prev, teamId];
        } else {
          Alert.alert('Maximum Reached', 'You can only select 8 teams to advance.');
          return prev;
        }
      }
    });
  };

  const handleSave = async () => {
    if (selectedTeams.length !== 8) {
      Alert.alert('Incomplete Selection', 'Please select exactly 8 teams to advance.');
      return;
    }

    // Check that all teams are different
    if (new Set(selectedTeams).size !== 8) {
      Alert.alert('Error', 'All 8 teams must be different');
      return;
    }

    setSaving(true);
    try {
      await apiService.updateAdminThirdPlaceResult({
        first_team_qualifying: selectedTeams[0],
        second_team_qualifying: selectedTeams[1],
        third_team_qualifying: selectedTeams[2],
        fourth_team_qualifying: selectedTeams[3],
        fifth_team_qualifying: selectedTeams[4],
        sixth_team_qualifying: selectedTeams[5],
        seventh_team_qualifying: selectedTeams[6],
        eighth_team_qualifying: selectedTeams[7],
      });
      
      Alert.alert('Success', 'Third place results updated successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error updating third place result:', error);
      const errorMessage = error?.message || error?.detail || JSON.stringify(error) || 'Could not update third place result';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Calculate dynamic height based on screen size
  const getCardHeight = () => {
    const screenHeight = Dimensions.get('window').height;
    const reservedSpace = 200; // Header + counter + padding
    const availableHeight = screenHeight - reservedSpace;
    const marginsBetweenRows = 3 * 8; // 3 gaps between 4 rows
    const cardHeight = (availableHeight - marginsBetweenRows) / 4;
    return Math.max(cardHeight, 80);
  };

  const renderTeam = ({ item }: { item: ThirdPlaceTeam }) => {
    const isSelected = selectedTeams.includes(item.id);
    const position = isSelected ? selectedTeams.indexOf(item.id) + 1 : null;
    
    let cardStyle: any = styles.teamCard;
    if (isSelected) {
      cardStyle = [styles.teamCard, styles.teamCardSelected];
    }

    return (
      <TouchableOpacity
        style={[cardStyle, { height: getCardHeight() }]}
        onPress={() => handleTeamPress(item.id)}
        activeOpacity={0.7}
      >
        {/* Position badge if selected */}
        {isSelected && (
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{position}</Text>
          </View>
        )}
        
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
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading third place teams...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (teams.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No eligible teams found</Text>
          <Text style={styles.subtitle}>Please set group stage results first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (selectedTeams.length !== 8 || saving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={selectedTeams.length !== 8 || saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.counter}>
            Selected: {selectedTeams.length}/8
          </Text>
          <View style={styles.headerRight} />
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No eligible teams found</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  counter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerRight: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    zIndex: 10,
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
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
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
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  positionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  positionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamFlag: {
    width: 40,
    height: 28,
    borderRadius: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    flex: 1,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 6,
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
