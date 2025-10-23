import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Match, apiService, MatchesResponse } from '../../services/api';
import MatchCard from '../../components/MatchCard';
import { useTournament } from '../../contexts/TournamentContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<number, {homeScore: number | null, awayScore: number | null}>>(new Map());
  const [saving, setSaving] = useState(false);
  const [matchesScore, setMatchesScore] = useState<number | null>(null);
  
  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();

  // Determine if there are any incomplete (null) scores among pending changes
  const hasIncompletePending = Array.from(pendingChanges.values()).some(
    (s) => s.homeScore === null || s.awayScore === null
  );
  const canSave = pendingChanges.size > 0 && !hasIncompletePending && !saving;

  const fetchMatches = async () => {
    try {
      const data: MatchesResponse = await apiService.getMatches(1); // Using user_id = 1 for now
      setMatches(data.matches);
      setMatchesScore(data.matches_score);
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('Error', 'Could not load matches. Please check that the server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleScoreChange = useCallback((matchId: number, homeScore: number | null, awayScore: number | null) => {
    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      newChanges.set(matchId, { homeScore, awayScore });
      return newChanges;
    });
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };


  const performSave = async () => {
    setSaving(true);
    try {
      const predictions = Array.from(pendingChanges.entries()).map(([matchId, scores]) => ({
        match_id: matchId,
        home_score: scores.homeScore,
        away_score: scores.awayScore,
      }));

      const result = await apiService.updateBatchMatchPredictions(1, predictions);
      console.log('Save result:', result);
      
      Alert.alert('Success', 'All predictions saved successfully!');
      
      // Clear pending changes immediately
      setPendingChanges(new Map());
      
      // Wait 2 seconds for the server to process the updates and force refresh
      setTimeout(() => {
        console.log('Refreshing matches after save...');
        fetchMatches();
      }, 2000);
      
    } catch (error) {
      console.error('Error saving predictions:', error);
      Alert.alert('Error', 'Could not save predictions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (pendingChanges.size === 0) {
      Alert.alert('Message', 'No changes to save');
      return;
    }

    if (hasIncompletePending) {
      Alert.alert('Missing Value', 'Cannot save prediction when one of the scores is empty. Fill in both scores.');
      return;
    }

    // Check if any of the pending changes are for matches with LIVE_EDITABLE status
    const hasLiveEditableMatches = Array.from(pendingChanges.keys()).some(matchId => {
      const match = matches.find(m => m.id === matchId);
      return match && match.status === 'live_editable';
    });

    if (hasLiveEditableMatches) {
      Alert.alert(
        'Penalty Warning',
        'Some matches are currently live. Editing these predictions will result in a 1-point penalty per match. Do you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: performSave }
        ]
      );
    } else {
      // No live matches, save directly
      performSave();
    }
  };

  const renderMatch = ({ item }: { item: Match }) => {
    const pendingChange = pendingChanges.get(item.id);
    const matchWithPendingChanges = pendingChange ? {
      ...item,
      user_prediction: {
        ...item.user_prediction,
        home_score: pendingChange.homeScore,
        away_score: pendingChange.awayScore,
      }
    } : item;
    
    return (
      <MatchCard 
        match={matchWithPendingChanges} 
        onScoreChange={handleScoreChange}
        hasPendingChanges={!!pendingChange}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No matches available</Text>
        <Text style={styles.emptySubtext}>Check that the server is running and matches are created</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Match Predictions</Text>
        {matchesScore !== null && (
          <View style={styles.pointsContainer}>
            <Text style={styles.totalPoints}>{matchesScore} pts</Text>
          </View>
        )}
        {pendingChanges.size > 0 && (
          <TouchableOpacity 
            style={[styles.saveButton, (!canSave) && styles.saveButtonDisabled]} 
            onPress={handleSaveAll}
            disabled={!canSave}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? 'Saving...'
                : hasIncompletePending
                  ? 'Fill scores before saving'
                  : `Save Predictions (${pendingChanges.size})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id.toString()}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    flex: 1,
  },
  pointsContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
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
    paddingBottom: 20,
  },
});

