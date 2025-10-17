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
  const isFinal = match.stage === 'final';

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

  const renderFinalMatch = () => {
    const team1Name = match.team1_name && match.team1_name !== 'TBD' ? match.team1_name : 'TBD';
    const team2Name = match.team2_name && match.team2_name !== 'TBD' ? match.team2_name : 'TBD';
    
    return (
      <View style={styles.finalContainer}>
        {/* Team 1 */}
        <Text style={[styles.finalTeamName, isTeam1Winner && styles.finalWinnerText]}>
          {team1Name}
        </Text>
        {match.team1_flag && (
          <Image 
            source={{ uri: match.team1_flag }} 
            style={styles.finalFlag}
            resizeMode="contain"
          />
        )}
        
        {/* VS */}
        <Text style={styles.finalVsText}>VS</Text>
        
        {/* Team 2 */}
        {match.team2_flag && (
          <Image 
            source={{ uri: match.team2_flag }} 
            style={styles.finalFlag}
            resizeMode="contain"
          />
        )}
        <Text style={[styles.finalTeamName, isTeam2Winner && styles.finalWinnerText]}>
          {team2Name}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.container, isFinal && styles.finalCardContainer]}
      onPress={() => {
        onPress?.(match);
      }}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        onLayout?.(match.id, { x, y, width, height });
      }}
      activeOpacity={0.7}
    >
      {isFinal ? (
        renderFinalMatch()
      ) : (
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
      )}
      
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
  // Final match styles
  finalCardContainer: {
    width: 120, // Wider for final
    height: 200, // Taller for final
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  finalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  finalTeamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginVertical: 1, // קטן יותר מהגבולות
  },
  finalWinnerText: {
    color: '#059669', // Green for winner
    fontWeight: '900',
  },
  finalFlag: {
    width: 36,
    height: 24,
    marginVertical: 12, // גדול יותר מהסמלים
    borderWidth: 0.5,
    borderColor: '#d1d5db',
    borderRadius: 2,
  },
  finalVsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    marginVertical: 3, // קצת יותר גדול בין הסמלים
  },
});
