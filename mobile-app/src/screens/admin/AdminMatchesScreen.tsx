import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';

interface AdminMatch {
  match_id?: number; // Backend returns match_id
  id?: number; // Fallback
  stage: string;
  date: string;
  home_team: {
    id: number;
    name: string;
    flag_url?: string;
  };
  away_team: {
    id: number;
    name: string;
    flag_url?: string;
  };
  result?: {
    home_team_score?: number; // Backend returns home_team_score
    away_team_score?: number; // Backend returns away_team_score
    home_score?: number; // Fallback
    away_score?: number; // Fallback
    home_score_120?: number;
    away_score_120?: number;
    home_penalties?: number;
    away_penalties?: number;
    outcome_type?: string;
    winner_team_id?: number;
  };
  status: string;
  group?: string;
}

export default function AdminMatchesScreen() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const data = await apiService.getAdminMatches();
      console.log('Fetched matches data:', data); // Debug log
      
      // Validate and sanitize data - backend returns match_id, not id
      const sanitizedData = (data || []).map((match: any) => {
        const matchId = match?.match_id || match?.id || 0;
        return {
          ...match,
          id: matchId,
          match_id: matchId,
          stage: match?.stage || 'unknown',
          date: match?.date || '',
          home_team: match?.home_team || { id: 0, name: 'Unknown' },
          away_team: match?.away_team || { id: 0, name: 'Unknown' },
          status: match?.status || 'scheduled',
          result: match?.result ? {
            // Map backend fields to frontend fields
            home_score: match.result.home_team_score ?? match.result.home_score,
            away_score: match.result.away_team_score ?? match.result.away_score,
            home_score_120: match.result.home_team_score_120,
            away_score_120: match.result.away_team_score_120,
            home_penalties: match.result.home_team_penalties,
            away_penalties: match.result.away_team_penalties,
            outcome_type: match.result.outcome_type || 'regular',
            winner_team_id: match.result.winner_team_id,
            // Keep original fields for compatibility
            home_team_score: match.result.home_team_score,
            away_team_score: match.result.away_team_score,
          } : undefined,
          group: match?.group || undefined,
        };
      });
      
      console.log('Sanitized matches:', sanitizedData.length); // Debug log
      
      // Remove duplicates based on id
      const uniqueMatches = sanitizedData.filter((match: AdminMatch, index: number, self: AdminMatch[]) => {
        const matchId = match.id || match.match_id || 0;
        // Keep matches with valid ids, and for matches with id 0, keep only first occurrence
        if (matchId > 0) {
          return index === self.findIndex((m) => (m.id || m.match_id) === matchId);
        }
        return index === self.findIndex((m) => (m.id || m.match_id) === matchId && m === match);
      });
      
      console.log('Unique matches:', uniqueMatches.length); // Debug log
      setMatches(uniqueMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('Error', `Could not load matches: ${error}`);
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const handleSaveResult = async (match: AdminMatch, scores: any) => {
    const matchId = match?.id || match?.match_id;
    if (!matchId) {
      Alert.alert('Error', 'Invalid match');
      return;
    }
    setSaving(true);
    try {
      await apiService.updateMatchResult(matchId, scores);
      Alert.alert('Success', 'Match result updated successfully');
      setEditingMatchId(null);
      fetchMatches();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update match result');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (matchId: number, status: string) => {
    if (!matchId) {
      Alert.alert('Error', 'Invalid match ID');
      return;
    }
    try {
      await apiService.updateMatchStatus(matchId, status);
      Alert.alert('Success', 'Match status updated successfully');
      fetchMatches();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update match status');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStageText = (stage: string, group?: string) => {
    switch (stage) {
      case 'group':
        return group ? `Group ${group}` : 'Group Stage';
      case 'round32':
        return 'Round of 32';
      case 'round16':
        return 'Round of 16';
      case 'quarter':
        return 'Quarter Final';
      case 'semi':
        return 'Semi Final';
      case 'final':
        return 'Final';
      default:
        return stage;
    }
  };

  const MatchCard = ({ match }: { match: AdminMatch }) => {
    const matchId = match?.id || match?.match_id;
    if (!match || !matchId) {
      return null;
    }
    
    const isEditing = editingMatchId === matchId;
    
    // Helper function to safely convert to string
    const safeToString = (value: number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      try {
        return String(value);
      } catch (error) {
        return '';
      }
    };

    // Helper to get result value - handle both field names
    const getResultValue = (field: 'home_score' | 'away_score' | 'home_score_120' | 'away_score_120' | 'home_penalties' | 'away_penalties'): string => {
      if (!match.result) return '';
      // Try both field names (home_score and home_team_score)
      if (field === 'home_score') {
        return safeToString(match.result.home_score ?? match.result.home_team_score);
      }
      if (field === 'away_score') {
        return safeToString(match.result.away_score ?? match.result.away_team_score);
      }
      if (field === 'home_score_120') {
        return safeToString(match.result.home_score_120);
      }
      if (field === 'away_score_120') {
        return safeToString(match.result.away_score_120);
      }
      if (field === 'home_penalties') {
        return safeToString(match.result.home_penalties);
      }
      if (field === 'away_penalties') {
        return safeToString(match.result.away_penalties);
      }
      return '';
    };

    const [editScores, setEditScores] = useState({
      homeScore: getResultValue('home_score'),
      awayScore: getResultValue('away_score'),
      homeScore120: getResultValue('home_score_120'),
      awayScore120: getResultValue('away_score_120'),
      homePenalties: getResultValue('home_penalties'),
      awayPenalties: getResultValue('away_penalties'),
    });

    // Reset scores when editing starts
    useEffect(() => {
      if (isEditing) {
        setEditScores({
          homeScore: getResultValue('home_score'),
          awayScore: getResultValue('away_score'),
          homeScore120: getResultValue('home_score_120'),
          awayScore120: getResultValue('away_score_120'),
          homePenalties: getResultValue('home_penalties'),
          awayPenalties: getResultValue('away_penalties'),
        });
      }
    }, [isEditing, matchId]);

    return (
      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <Text style={styles.stageText}>
            {getStageText(match?.stage || 'unknown', match?.group)}
          </Text>
          <Text style={styles.dateText}>{formatDate(match?.date)}</Text>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamContainer}>
            <View style={styles.teamRow}>
              {match?.home_team?.flag_url && (
                <Image 
                  source={{ uri: match.home_team.flag_url }} 
                  style={styles.flag}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.teamName}>{match?.home_team?.name || 'Unknown'}</Text>
            </View>
          </View>
          <Text style={styles.vsText}>vs</Text>
          <View style={styles.teamContainer}>
            <View style={styles.teamRow}>
              {match?.away_team?.flag_url && (
                <Image 
                  source={{ uri: match.away_team.flag_url }} 
                  style={styles.flag}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.teamName}>{match?.away_team?.name || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <Text style={styles.editLabel}>Regular Time:</Text>
            <View style={styles.scoreInputRow}>
              <TextInput
                style={styles.scoreInput}
                value={editScores.homeScore}
                onChangeText={(text) => setEditScores({ ...editScores, homeScore: text })}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.separator}>-</Text>
              <TextInput
                style={styles.scoreInput}
                value={editScores.awayScore}
                onChangeText={(text) => setEditScores({ ...editScores, awayScore: text })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <Text style={styles.editLabel}>Extra Time (120 min):</Text>
            <View style={styles.scoreInputRow}>
              <TextInput
                style={styles.scoreInput}
                value={editScores.homeScore120}
                onChangeText={(text) => setEditScores({ ...editScores, homeScore120: text })}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.separator}>-</Text>
              <TextInput
                style={styles.scoreInput}
                value={editScores.awayScore120}
                onChangeText={(text) => setEditScores({ ...editScores, awayScore120: text })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <Text style={styles.editLabel}>Penalties:</Text>
            <View style={styles.scoreInputRow}>
              <TextInput
                style={styles.scoreInput}
                value={editScores.homePenalties}
                onChangeText={(text) => setEditScores({ ...editScores, homePenalties: text })}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.separator}>-</Text>
              <TextInput
                style={styles.scoreInput}
                value={editScores.awayPenalties}
                onChangeText={(text) => setEditScores({ ...editScores, awayPenalties: text })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditingMatchId(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={() => {
                  handleSaveResult(match, {
                    home_team_score: parseInt(editScores.homeScore) || 0,
                    away_team_score: parseInt(editScores.awayScore) || 0,
                    home_team_score_120: editScores.homeScore120 ? parseInt(editScores.homeScore120) : undefined,
                    away_team_score_120: editScores.awayScore120 ? parseInt(editScores.awayScore120) : undefined,
                    home_team_penalties: editScores.homePenalties ? parseInt(editScores.homePenalties) : undefined,
                    away_team_penalties: editScores.awayPenalties ? parseInt(editScores.awayPenalties) : undefined,
                    outcome_type: match.result?.outcome_type || 'regular',
                  });
                }}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.resultContainer}>
            {match.result ? (
              <View>
                <Text style={styles.resultText}>
                  {(match.result.home_score ?? match.result.home_team_score ?? 0)} - {(match.result.away_score ?? match.result.away_team_score ?? 0)}
                </Text>
                {(match.result.home_score_120 !== null && match.result.home_score_120 !== undefined) && (
                  <Text style={styles.extraTimeText}>
                    ET: {match.result.home_score_120 ?? 0} - {match.result.away_score_120 ?? 0}
                  </Text>
                )}
                {(match.result.home_penalties !== null && match.result.home_penalties !== undefined) && (
                  <Text style={styles.penaltiesText}>
                    Pens: {match.result.home_penalties ?? 0} - {match.result.away_penalties ?? 0}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.noResultText}>No result</Text>
            )}
          </View>
        )}

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={styles.statusButtons}>
            {['scheduled', 'live_editable', 'live_locked', 'finished'].map((status, idx) => (
              <TouchableOpacity
                key={`${match?.id || 'unknown'}-status-${status}-${idx}`}
                style={[
                  styles.statusButton,
                  (match?.status || 'scheduled') === status && styles.statusButtonActive,
                ]}
                onPress={() => {
                  const matchId = match?.id || match?.match_id;
                  if (matchId) handleUpdateStatus(matchId, status);
                }}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    (match?.status || 'scheduled') === status && styles.statusButtonTextActive,
                  ]}
                >
                  {status.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!isEditing && matchId && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditingMatchId(matchId)}
          >
            <Text style={styles.editButtonText}>Edit Result</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMatch = ({ item: match }: { item: AdminMatch }) => {
    return <MatchCard match={match} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item, index) => {
          // Ensure unique keys - use id or match_id if available
          const matchId = item?.id || item?.match_id;
          if (matchId && matchId > 0) {
            return `match-${matchId}`;
          }
          return `match-${index}`;
        }}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matches found</Text>
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
  matchCard: {
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
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamContainer: {
    flex: 1,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flag: {
    width: 32,
    height: 24,
    borderRadius: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  vsText: {
    fontSize: 14,
    color: '#94a3b8',
    marginHorizontal: 12,
  },
  resultContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  extraTimeText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  penaltiesText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  noResultText: {
    fontSize: 16,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusButtonActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  statusButtonText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },
  editButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editContainer: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#ffffff',
  },
  separator: {
    fontSize: 20,
    marginHorizontal: 12,
    color: '#64748b',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#dc2626',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
