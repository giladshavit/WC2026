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
      
        <View style={styles.matchLayout}>
          {/* Home Flag - Fixed position at left edge */}
          <View style={styles.homeFlagContainer}>
            {match.home_team.flag_url && (
              <Image source={{ uri: match.home_team.flag_url }} style={styles.teamFlag} />
            )}
          </View>

          {/* Home Team Name - Fixed distance from flag */}
          <View style={styles.homeTeamContainer}>
            <Text style={styles.homeTeamName}>{match.home_team.name}</Text>
          </View>

          {/* Score Section */}
          <View style={styles.scoreSection}>
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
            <Text style={styles.scoreSeparator}>:</Text>
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

          {/* Away Flag - Fixed position at right edge */}
          <View style={styles.awayFlagContainer}>
            {match.away_team.flag_url && (
              <Image source={{ uri: match.away_team.flag_url }} style={styles.teamFlag} />
            )}
          </View>

          {/* Away Team Name - Fixed distance from flag */}
          <View style={styles.awayTeamContainer}>
            <Text style={styles.awayTeamName}>{match.away_team.name}</Text>
          </View>
        </View>

        {/* Points - Below match layout */}
        {match.user_prediction.points !== null && (
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsText}>
              Points: {match.user_prediction.points}
            </Text>
          </View>
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
  matchLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 0,
    position: 'relative',
    minHeight: 40, // Height for flags and score section
  },
  homeFlagContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 0, // Fixed at left edge
    zIndex: 1,
  },
  awayFlagContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 0, // Fixed at right edge
    zIndex: 1,
  },
  teamFlag: {
    width: 28,
    height: 20,
    borderRadius: 3,
  },
  homeTeamContainer: {
    position: 'absolute',
    left: 36, // 30px flag width + 6px distance
    right: '50%',
    marginRight: 51, // Half of score section width (47px) + 4px spacing
    justifyContent: 'center',
  },
  homeTeamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'left',
  },
  awayTeamContainer: {
    position: 'absolute',
    right: 36, // 30px flag width + 6px distance from flag
    left: '50%',
    marginLeft: 51, // Half of score section width (47px) + 4px spacing
    justifyContent: 'center',
  },
  awayTeamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'right',
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24', // Gold/yellow color like in the image
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -47 }], // Half of the score section width to center it
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreInput: {
    width: 30,
    height: 26,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  scoreInputDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
  },
  scoreSeparator: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1f2937',
    marginHorizontal: 4,
  },
  pointsContainer: {
    alignItems: 'center',
    marginTop: 4, // 4px spacing from match layout above
    marginBottom: 4, // 4px spacing from bottom
  },
  pointsText: {
    fontSize: 12,
    color: '#38a169',
    textAlign: 'center',
    fontWeight: '600',
  },
});
