import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { KnockoutPrediction } from '../services/api';

interface KnockoutMatchCardProps {
  prediction: KnockoutPrediction;
  onTeamPress: (teamId: number) => void;
  pendingWinner?: number; // team1_id or team2_id from pending changes
  originalWinner?: number; // team1_id or team2_id from original selection
}

const KnockoutMatchCard = React.memo(({ prediction, onTeamPress, pendingWinner, originalWinner }: KnockoutMatchCardProps) => {
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
  
  // לוגיקה חדשה לזיהוי סוג הבחירה
  const isJustSaved = originalWinner === -1; // Special flag for "just saved"
  const isBackToOriginal = originalWinner && originalWinner !== -1 && currentWinner === originalWinner;
  const isNewChange = pendingWinner && pendingWinner !== originalWinner;
  
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
            pendingWinner === prediction.team1_id && styles.pendingWinnerButton,
            (isBackToOriginal && currentWinner === prediction.team1_id) ? styles.originalWinnerButton : 
            (isJustSaved && currentWinner === prediction.team1_id) ? styles.justSavedButton : null
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
            pendingWinner === prediction.team2_id && styles.pendingWinnerButton,
            (isBackToOriginal && currentWinner === prediction.team2_id) ? styles.originalWinnerButton : 
            (isJustSaved && currentWinner === prediction.team2_id) ? styles.justSavedButton : null
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
    borderRadius: 9, // 12 * 0.75
    padding: 12, // 16 * 0.75
    marginBottom: 9, // 12 * 0.75
    marginHorizontal: 4, // Even smaller margin
    marginTop: 6, // 8 * 0.75
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 90, // 120 * 0.75
    width: '48%', // For 2 columns layout
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  teamButton: {
    width: 60, // 120 * 0.5
    height: 60, // 80 * 0.75
    alignItems: 'center',
    justifyContent: 'center', // Center everything vertically
    paddingHorizontal: 4, // 8 * 0.5
    borderRadius: 6, // 8 * 0.75
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginHorizontal: 2, // 4 * 0.5
  },
  teamFlag: {
    width: 24, // 32 * 0.75
    height: 18, // 24 * 0.75
    borderRadius: 3, // 4 * 0.75
    marginBottom: 4, // 8 * 0.5
  },
  teamName: {
    fontSize: 7, // Even smaller text
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  tbdText: {
    color: '#111827', // near-black
    fontWeight: '900', // very bold
    fontSize: 27, // 36 * 0.75
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  vs: {
    fontSize: 10, // Even smaller
    color: '#718096',
    marginHorizontal: 4, // Smaller padding between columns
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
  originalWinnerButton: {
    backgroundColor: '#dbeafe', // Light blue background for original choice
    borderColor: '#3b82f6', // Blue border for original choice
  },
  justSavedButton: {
    backgroundColor: '#dbeafe', // Light blue background for just saved
    borderColor: '#3b82f6', // Blue border for just saved
  },
});

export default KnockoutMatchCard;
