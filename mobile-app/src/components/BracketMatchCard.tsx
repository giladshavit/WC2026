import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BracketMatch } from '../utils/bracketCalculator';

interface BracketMatchCardProps {
  match: BracketMatch;
  onPress?: (match: BracketMatch) => void;
  onLayout?: (matchId: number, layout: { x: number; y: number; width: number; height: number }) => void;
}

export default function BracketMatchCard({ match, onPress, onLayout }: BracketMatchCardProps) {
  const isTeam1Winner = match.winner_team_id === match.team1_id;
  const isTeam2Winner = match.winner_team_id === match.team2_id;

  const renderTeam = (teamName: string | undefined, teamFlag: string | undefined, isWinner: boolean, teamId?: number) => {
    const displayName = teamName && teamName !== 'TBD' ? teamName.substring(0, 8) : 'TBD';
    
    return (
      <View style={[styles.teamContainer, isWinner && styles.winnerTeam]}>
        {teamFlag && (
          <Image 
            source={{ uri: teamFlag }} 
            style={styles.flag}
            resizeMode="contain"
          />
        )}
        <Text style={[styles.teamName, isWinner && styles.winnerText]}>
          {displayName}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress?.(match)}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        onLayout?.(match.id, { x, y, width, height });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.matchContainer}>
        {renderTeam(
          match.team1_name, 
          match.team1_flag, 
          isTeam1Winner,
          match.team1_id
        )}
        
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        
        {renderTeam(
          match.team2_name, 
          match.team2_flag, 
          isTeam2Winner,
          match.team2_id
        )}
      </View>
      
      {/* Removed match ID to save space */}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 4,
    marginVertical: 2,
    marginHorizontal: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 90, // Smaller width
    height: 60, // Smaller height
    alignSelf: 'center',
    justifyContent: 'center',
  },
  matchContainer: {
    alignItems: 'center',
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderRadius: 3,
    marginVertical: 0.5,
    minWidth: 70,
    justifyContent: 'center',
  },
  winnerTeam: {
    backgroundColor: '#10b981',
    borderWidth: 1,
    borderColor: '#059669',
  },
  flag: {
    width: 12,
    height: 8,
    marginRight: 2,
  },
  teamName: {
    fontSize: 8,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  winnerText: {
    color: '#fff',
    fontWeight: '600',
  },
  vsContainer: {
    paddingVertical: 0.5,
  },
  vsText: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#6b7280',
  },
});
