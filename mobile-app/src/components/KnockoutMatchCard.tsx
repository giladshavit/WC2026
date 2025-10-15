import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { KnockoutPrediction } from '../services/api';

interface KnockoutMatchCardProps {
  prediction: KnockoutPrediction;
  onTeamPress: (teamId: number) => void;
  pendingWinner?: number; // team1_id or team2_id from pending changes
}

const KnockoutMatchCard = React.memo(({ prediction, onTeamPress, pendingWinner }: KnockoutMatchCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'must_change_predict':
        return '#e53e3e'; // red
      case 'might_change_predict':
        return '#f6ad55'; // yellow
      case 'predicted':
        return '#38a169'; // green
      default:
        return 'transparent';
    }
  };

  // Check if there's a pending winner, otherwise use the saved winner
  const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
  const team1IsTBD = isTBD(prediction.team1_name);
  const team2IsTBD = isTBD(prediction.team2_name);
  const currentWinner = pendingWinner || prediction.winner_team_id;
  // Suppress winner highlight if the winner refers to a TBD team
  const isTeam1Winner = !team1IsTBD && currentWinner === prediction.team1_id;
  const isTeam2Winner = !team2IsTBD && currentWinner === prediction.team2_id;

  const handleTeamPress = (teamId: number) => {
    // Ignore presses on TBD teams
    if ((teamId === prediction.team1_id && team1IsTBD) || (teamId === prediction.team2_id && team2IsTBD)) {
      return;
    }
    onTeamPress(teamId);
  };

  // Use green border if there's a pending change, otherwise use status color
  const borderColor = pendingWinner ? '#10b981' : getStatusColor(prediction.status);
  
  return (
    <View style={[styles.matchCard, { borderColor }]}>
      <View style={styles.teamContainer}>
        <TouchableOpacity 
          style={[
            styles.teamButton,
            isTeam1Winner && styles.winnerButton,
            pendingWinner === prediction.team1_id && styles.pendingWinnerButton
          ]}
          onPress={() => handleTeamPress(prediction.team1_id)}
          activeOpacity={0.7}
        >
          {!team1IsTBD && prediction.team1_flag && (
            <Image source={{ uri: prediction.team1_flag }} style={styles.teamFlag} />
          )}
          <Text 
            style={[
              styles.teamName,
              isTeam1Winner && styles.winnerText,
              team1IsTBD && styles.tbdText
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {team1IsTBD ? '?' : (prediction.team1_name || '')}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.vs}>vs</Text>
        
        <TouchableOpacity 
          style={[
            styles.teamButton,
            isTeam2Winner && styles.winnerButton,
            pendingWinner === prediction.team2_id && styles.pendingWinnerButton
          ]}
          onPress={() => handleTeamPress(prediction.team2_id)}
          activeOpacity={0.7}
        >
          {!team2IsTBD && prediction.team2_flag && (
            <Image source={{ uri: prediction.team2_flag }} style={styles.teamFlag} />
          )}
          <Text 
            style={[
              styles.teamName,
              isTeam2Winner && styles.winnerText,
              team2IsTBD && styles.tbdText
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {team2IsTBD ? '?' : (prediction.team2_name || '')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 8, // Small margin from top for first card
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120, // Increased height to accommodate larger buttons
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  teamButton: {
    width: 120, // Back to original width
    height: 80, // Increased height
    alignItems: 'center',
    justifyContent: 'center', // Center everything vertically
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginHorizontal: 4,
  },
  teamFlag: {
    width: 32,
    height: 24,
    borderRadius: 4,
    marginBottom: 8, // Space between flag and team name
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  tbdText: {
    color: '#111827', // near-black
    fontWeight: '900', // very bold
    fontSize: 36, // 24 * 1.5 = 36
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  vs: {
    fontSize: 16,
    color: '#718096',
    marginHorizontal: 16,
    fontWeight: 'bold',
  },
  winnerButton: {
    backgroundColor: '#f0fff4', // Light green background for winner
    borderColor: '#38a169', // Green border for winner
  },
  winnerText: {
    color: '#38a169', // Green text for winner
    fontWeight: '700', // Bolder text for winner
  },
  pendingWinnerButton: {
    backgroundColor: '#f0fff4', // Light green background for pending winner (same as winner)
    borderColor: '#38a169', // Green border for pending winner (same as winner)
  },
});

export default KnockoutMatchCard;
