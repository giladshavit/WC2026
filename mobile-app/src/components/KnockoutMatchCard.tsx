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
  
  // Check if match is finished (has is_correct field)
  const matchFinished = prediction.is_correct !== undefined && prediction.is_correct !== null;
  const isCorrect = prediction.is_correct === true;
  
  // Get validity flags (only if match not finished)
  // Only mark as invalid if explicitly false (not undefined/null)
  const team1Invalid = matchFinished ? false : (prediction.team1_is_valid === false);
  const team2Invalid = matchFinished ? false : (prediction.team2_is_valid === false);
  
  return (
    <View style={[styles.matchCard, { borderColor }]}>
      {matchFinished && (
        <View style={styles.correctnessIndicator}>
          <Text style={[styles.correctnessSymbol, isCorrect ? styles.correctSymbol : styles.incorrectSymbol]}>
            {isCorrect ? '✓' : '✗'}
          </Text>
        </View>
      )}
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
              team1IsTBD && styles.tbdText,
              team1Invalid && styles.invalidText
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
              team2IsTBD && styles.tbdText,
              team2Invalid && styles.invalidText
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
    marginHorizontal: 4,
    marginTop: 6, // 8 * 0.75
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120, // 90 * 1.5 - Increased height
    width: '96%', // Double width - single column layout
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  teamButton: {
    width: 120, // 60 * 2 - Double width
    height: 90, // 60 * 1.5 - Increased height
    alignItems: 'center',
    justifyContent: 'center', // Center everything vertically
    paddingHorizontal: 8,
    borderRadius: 6, // 8 * 0.75
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginHorizontal: 4,
  },
  teamFlag: {
    width: 48, // 32 * 1.5 - Increased flags
    height: 36, // 24 * 1.5 - Increased flags
    borderRadius: 3, // 4 * 0.75
    marginBottom: 6,
  },
  teamName: {
    fontSize: 15, // 10 * 1.5 - Increased font size
    fontWeight: '600',
    fontFamily: 'System',
    letterSpacing: 0.3,
    color: '#2d3748',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  tbdText: {
    color: '#111827', // near-black
    fontWeight: '900', // very bold
    fontSize: 40, // Increased for bigger card
    fontFamily: 'System',
    letterSpacing: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  vs: {
    fontSize: 21, // 14 * 1.5 - Increased font size
    fontFamily: 'System',
    letterSpacing: 0.5,
    color: '#718096',
    marginHorizontal: 8,
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
  correctnessIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  correctnessSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  correctSymbol: {
    color: '#38a169', // Green for correct
  },
  incorrectSymbol: {
    color: '#e53e3e', // Red for incorrect
  },
  invalidText: {
    color: '#e53e3e', // Red text for invalid team
    textDecorationLine: 'line-through',
  },
});

export default KnockoutMatchCard;
