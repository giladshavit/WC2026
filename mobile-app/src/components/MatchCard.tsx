import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Match } from '../services/api';

interface MatchCardProps {
  match: Match;
  onScoreChange: (matchId: number, homeScore: number | null, awayScore: number | null) => void;
}

export default function MatchCard({ match, onScoreChange }: MatchCardProps) {
  const [homeScore, setHomeScore] = React.useState<string>(
    match.user_prediction.home_score?.toString() || ''
  );
  const [awayScore, setAwayScore] = React.useState<string>(
    match.user_prediction.away_score?.toString() || ''
  );

  const handleScoreSubmit = () => {
    const home = homeScore ? parseInt(homeScore) : null;
    const away = awayScore ? parseInt(awayScore) : null;
    onScoreChange(match.id, home, away);
  };

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
      case 'GROUP_STAGE':
        return `בית ${match.group}`;
      case 'ROUND_OF_32':
        return 'שמינית גמר';
      case 'ROUND_OF_16':
        return 'רבע גמר';
      case 'QUARTER_FINAL':
        return 'חצי גמר';
      case 'SEMI_FINAL':
        return 'גמר';
      case 'FINAL':
        return 'גמר העולם';
      default:
        return stage;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stageText}>{getStageText(match.stage)}</Text>
        <Text style={styles.dateText}>{formatDate(match.date)}</Text>
      </View>
      
      <View style={styles.teamsContainer}>
        <View style={styles.teamContainer}>
          <Text style={styles.teamName}>{match.home_team.name}</Text>
          <TextInput
            style={[
              styles.scoreInput,
              !match.can_edit && styles.scoreInputDisabled
            ]}
            value={homeScore}
            onChangeText={setHomeScore}
            placeholder="0"
            keyboardType="numeric"
            editable={match.can_edit}
            maxLength={2}
          />
        </View>
        
        <Text style={styles.vsText}>vs</Text>
        
        <View style={styles.teamContainer}>
          <Text style={styles.teamName}>{match.away_team.name}</Text>
          <TextInput
            style={[
              styles.scoreInput,
              !match.can_edit && styles.scoreInputDisabled
            ]}
            value={awayScore}
            onChangeText={setAwayScore}
            placeholder="0"
            keyboardType="numeric"
            editable={match.can_edit}
            maxLength={2}
          />
        </View>
      </View>
      
      {match.can_edit && (
        <TouchableOpacity style={styles.saveButton} onPress={handleScoreSubmit}>
          <Text style={styles.saveButtonText}>שמור ניחוש</Text>
        </TouchableOpacity>
      )}
      
      {match.user_prediction.points !== null && (
        <Text style={styles.pointsText}>
          נקודות: {match.user_prediction.points}
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
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
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
  saveButton: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pointsText: {
    fontSize: 12,
    color: '#38a169',
    textAlign: 'center',
    fontWeight: '600',
  },
});
