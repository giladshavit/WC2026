import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { KnockoutPrediction } from '../services/api';

interface KnockoutMatchCardProps {
  prediction: KnockoutPrediction;
  onTeamPress: (teamId: number) => void;
}

export default function KnockoutMatchCard({ prediction, onTeamPress }: KnockoutMatchCardProps) {
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

  const isTeam1Winner = prediction.winner_team_id === prediction.team1_id;
  const isTeam2Winner = prediction.winner_team_id === prediction.team2_id;

  return (
    <View style={[styles.matchCard, { borderColor: getStatusColor(prediction.status) }]}>
      <View style={styles.teamContainer}>
        <TouchableOpacity 
          style={[
            styles.teamButton,
            isTeam1Winner && styles.winnerButton
          ]}
          onPress={() => onTeamPress(prediction.team1_id)}
          activeOpacity={0.7}
        >
          {prediction.team1_flag && (
            <Image source={{ uri: prediction.team1_flag }} style={styles.teamFlag} />
          )}
          <Text 
            style={[
              styles.teamName,
              isTeam1Winner && styles.winnerText
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {prediction.team1_name || 'TBD'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.vs}>vs</Text>
        
        <TouchableOpacity 
          style={[
            styles.teamButton,
            isTeam2Winner && styles.winnerButton
          ]}
          onPress={() => onTeamPress(prediction.team2_id)}
          activeOpacity={0.7}
        >
          {prediction.team2_flag && (
            <Image source={{ uri: prediction.team2_flag }} style={styles.teamFlag} />
          )}
          <Text 
            style={[
              styles.teamName,
              isTeam2Winner && styles.winnerText
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {prediction.team2_name || 'TBD'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
    justifyContent: 'space-between',
    paddingTop: 8, // Increased padding from top
    paddingBottom: 6, // Reduced padding from bottom
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
    marginBottom: 4, // Fixed distance between flag and team name
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
    height: 36, // Increased height for text area with larger button
    overflow: 'hidden',
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
});
