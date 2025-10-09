import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import { Match } from '../services/api';

interface MatchCardProps {
  match: Match;
  onScoreChange: (matchId: number, homeScore: number | null, awayScore: number | null) => void;
  hasPendingChanges?: boolean;
}

export default function MatchCard({ match, onScoreChange, hasPendingChanges = false }: MatchCardProps) {
  const [homeScore, setHomeScore] = React.useState<string>(
    match.user_prediction.home_score?.toString() || ''
  );
  const [awayScore, setAwayScore] = React.useState<string>(
    match.user_prediction.away_score?.toString() || ''
  );

  // Call onScoreChange only when user manually changes scores
  const handleScoreChange = React.useCallback((field: 'home' | 'away', value: string) => {
    if (field === 'home') {
      setHomeScore(value);
    } else {
      setAwayScore(value);
    }
    
    // Calculate the new scores
    const home = field === 'home' ? (value ? parseInt(value) : null) : (homeScore ? parseInt(homeScore) : null);
    const away = field === 'away' ? (value ? parseInt(value) : null) : (awayScore ? parseInt(awayScore) : null);
    
    // Only send if there's a real change from the original prediction
    const originalHome = match.user_prediction.home_score;
    const originalAway = match.user_prediction.away_score;
    
    if (home !== originalHome || away !== originalAway) {
      onScoreChange(match.id, home, away);
    }
  }, [homeScore, awayScore, match.id, onScoreChange, match.user_prediction.home_score, match.user_prediction.away_score]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'group':
        return `Group ${match.group}`;
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

  return (
    <View style={[styles.container, hasPendingChanges && styles.containerPending]}>
      <View style={styles.header}>
        <Text style={styles.stageText}>{getStageText(match.stage)}</Text>
        <Text style={styles.dateText}>{formatDate(match.date)}</Text>
      </View>
      
      <View style={styles.teamsContainer}>
        <View style={styles.teamContainer}>
          <View style={styles.teamInfo}>
            {match.home_team.flag_url && (
              <Image source={{ uri: match.home_team.flag_url }} style={styles.flag} />
            )}
            <Text style={styles.teamName}>{match.home_team.name}</Text>
          </View>
          <TextInput
            style={[
              styles.scoreInput,
              !match.can_edit && styles.scoreInputDisabled
            ]}
            value={homeScore}
            onChangeText={(value) => handleScoreChange('home', value)}
            placeholder="0"
            keyboardType="numeric"
            editable={match.can_edit}
            maxLength={2}
          />
        </View>
        
        <Text style={styles.vsText}>vs</Text>
        
        <View style={styles.teamContainer}>
          <View style={styles.teamInfo}>
            {match.away_team.flag_url && (
              <Image source={{ uri: match.away_team.flag_url }} style={styles.flag} />
            )}
            <Text style={styles.teamName}>{match.away_team.name}</Text>
          </View>
          <TextInput
            style={[
              styles.scoreInput,
              !match.can_edit && styles.scoreInputDisabled
            ]}
            value={awayScore}
            onChangeText={(value) => handleScoreChange('away', value)}
            placeholder="0"
            keyboardType="numeric"
            editable={match.can_edit}
            maxLength={2}
          />
        </View>
      </View>
      
      
      {match.user_prediction.points !== null && (
        <Text style={styles.pointsText}>
          Points: {match.user_prediction.points}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  containerPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#f6ad55',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stageText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
  },
  dateText: {
    fontSize: 12,
    color: '#718096',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flag: {
    width: 24,
    height: 18,
    marginRight: 8,
    borderRadius: 2,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreInput: {
    width: 50,
    height: 40,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreInputDisabled: {
    backgroundColor: '#f7fafc',
    borderColor: '#cbd5e0',
    color: '#a0aec0',
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a5568',
    marginHorizontal: 16,
  },
  pointsText: {
    fontSize: 12,
    color: '#38a169',
    textAlign: 'center',
    fontWeight: '600',
  },
});
