import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, Image, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThirdPlaceTeam, apiService } from '../../services/api';
import { useTournament } from '../../contexts/TournamentContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';

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

  const insets = useSafeAreaInsets();

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();

  // Calculate number of changes in third place prediction
  const calculateThirdPlaceChanges = useMemo(() => {
    // Get currently selected teams
    const currentlySelected = Array.from(selectedTeams);
    
    // Get originally selected teams (from the teams data)
    const originallySelected = teams
      .filter(team => team.is_selected)
      .map(team => team.id);
    
    // Count only teams that are newly selected (not in original selection)
    // This is unidirectional - only count new additions, not removals
    const newSelections = currentlySelected.filter(teamId => 
      !originallySelected.includes(teamId)
    );
    
    return newSelections.length;
  }, [selectedTeams, teams]);

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
    // Don't allow changes if not editable
    if (!isEditable) return;
    
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
    }
  };

  const handleSave = async () => {
    if (calculateThirdPlaceChanges === 0) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }

    // Use the generic penalty confirmation hook
    showPenaltyConfirmation(performSave, calculateThirdPlaceChanges);
  };

  const renderTeam = ({ item }: { item: ThirdPlaceTeam }) => {
    const isSelected = selectedTeams.has(item.id);
    const isChanged = changedGroups.includes(item.group_name);
    
    // Check if there's a result and if this team's group is correct
    const hasResult = thirdPlaceResult !== null;
    const isEditable = hasResult ? false : true; // If result exists, not editable
    
    // Get the result groups from the result
    let isCorrect = null;
    if (hasResult && thirdPlaceResult.result_groups && isSelected) {
      // Check if this team's group appears in the result groups
      isCorrect = thirdPlaceResult.result_groups.includes(item.group_name);
    }
    
    // Logic: Changed (yellow border) + Selected (green background) can coexist
    // But if there's a result, don't show changed indicator
    let cardStyle: any = styles.teamCard;
    if (hasResult && isSelected && isCorrect === false) {
      // Wrong prediction: red background
      cardStyle = [styles.teamCard, styles.teamCardIncorrect];
    } else if (hasResult && isSelected && isCorrect === true) {
      // Correct prediction: green background but no border (results are final)
      cardStyle = [styles.teamCard, styles.teamCardSelectedNoBorder];
    } else if (isChanged && isSelected && !hasResult) {
      // Both changed and selected (and no result): yellow border + green background
      cardStyle = [styles.teamCard, styles.teamCardSelected, styles.teamCardChanged];
    } else if (isChanged && !hasResult) {
      // Only changed (and no result): yellow border only
      cardStyle = [styles.teamCard, styles.teamCardChanged];
    } else if (isSelected && !hasResult) {
      // Only selected (and no result): green border + green background
      cardStyle = [styles.teamCard, styles.teamCardSelected];
    }
    
    return (
      <TouchableOpacity
        style={[cardStyle, { height: getCardHeight() }]}
        onPress={() => handleTeamPress(item.id)}
        activeOpacity={isEditable ? 0.7 : 1}
        disabled={!isEditable}
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
            <Text style={styles.selectedText}>✓</Text>
          </View>
        )}
        {isChanged && !hasResult && (
          <View style={styles.changedIndicator}>
            <Text style={styles.changedText}>!</Text>
          </View>
        )}
        {/* Show correctness indicator if there's a result and team is selected */}
        {hasResult && isSelected && isCorrect !== null && (
          <View style={[styles.correctnessIndicator, isCorrect ? styles.correctIndicator : styles.incorrectIndicator]}>
            <Text style={styles.correctnessText}>{isCorrect ? '✓' : '✗'}</Text>
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
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.saveButton, (!isEditable || calculateThirdPlaceChanges === 0 || saving || selectedTeams.size !== 8) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!isEditable || calculateThirdPlaceChanges === 0 || saving || selectedTeams.size !== 8}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text 
            style={styles.counter}
            onLayout={(event) => setCounterHeight(event.nativeEvent.layout.height)}
            pointerEvents="none"
          >
            {hasResult ? `Correct: ${correctCount}/8` : `Selected: ${selectedTeams.size}/8`}
          </Text>
          <View style={styles.headerRight}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d4edda',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#d4edda',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    marginTop: 4,
  },
  counter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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
    alignItems: 'flex-end',
  },
  totalScoreContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  totalScore: {
    fontSize: 16,
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
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d4edda',
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
  teamCardSelectedNoBorder: {
    backgroundColor: '#f0fff4', // Green background but no border
  },
  teamCardChanged: {
    borderColor: '#f6ad55',
  },
  teamCardIncorrect: {
    backgroundColor: '#fee2e2', // Light red background for incorrect predictions
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
  correctnessIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  correctIndicator: {
    backgroundColor: '#48bb78',
  },
  incorrectIndicator: {
    backgroundColor: '#f56565',
  },
  correctnessText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});