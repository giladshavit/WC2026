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
  
  // Check if winner is not in team1 or team2 - need to show winner flag separately
  const hasWinnerNotInTeams = match.winner_team_id && 
                               match.winner_team_id !== match.team1_id && 
                               match.winner_team_id !== match.team2_id;

  // Check if match is finished (has is_correct field)
  const matchFinished = match.is_correct !== undefined && match.is_correct !== null;
  
  // Get validity flags (only if match not finished)
  // Invalid teams should be shown in gray (not red, not strikethrough)
  // Mark as invalid if explicitly false (regardless of status)
  const team1Invalid = matchFinished ? false : (match.team1_is_valid === false);
  const team2Invalid = matchFinished ? false : (match.team2_is_valid === false);
  
  // Get elimination status
  const team1Eliminated = match.team1_is_eliminated === true;
  const team2Eliminated = match.team2_is_eliminated === true;

  // Get status-based border color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'invalid':
      case 'incorrect':
        return '#F44336'; // red
      case 'unreachable':
      case 'correct_partial':
        return '#FF9800'; // orange
      case 'correct_full':
        return '#4CAF50'; // green
      case 'valid':
      case 'pending_result':
        return '#FFFFFF'; // white/default
      default:
        return '#e2e8f0'; // default gray
    }
  };

  const borderColor = getStatusColor(match.status);

  const renderTeam = (teamName: string | undefined, teamFlag: string | undefined, isWinner: boolean, teamId?: number, shortName?: string, isInvalid: boolean = false, isEliminated: boolean = false) => {
    const displayName = shortName || (teamName && teamName !== 'TBD' ? teamName.substring(0, 8) : 'TBD');
    const isTBD = displayName === 'TBD' || (teamName && teamName === 'TBD');
    
    return (
      <View style={styles.teamContainer}>
        {teamFlag ? (
          <Image 
            source={{ uri: teamFlag }} 
            style={styles.flag}
            resizeMode="contain"
          />
        ) : null}
        <Text style={[
          styles.teamName, 
          isWinner && !isTBD && styles.winnerText,
          // Apply invalid style (gray) if invalid - applies to both winner and non-winner
          isInvalid && styles.invalidText,
          // Add strike-through if eliminated - applies to both winner and non-winner
          isEliminated && styles.eliminatedText
        ]}>
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
        <Text style={[
          styles.finalTeamName, 
          isTeam1Winner && styles.finalWinnerText,
          // Apply invalid style (gray) if invalid - applies to both winner and non-winner
          team1Invalid && styles.invalidText,
          // Add strike-through if eliminated - applies to both winner and non-winner
          team1Eliminated && styles.eliminatedText
        ]}>
          {team1Name}
        </Text>
        {match.team1_flag ? (
          <Image 
            source={{ uri: match.team1_flag }} 
            style={styles.finalFlag}
            resizeMode="contain"
          />
        ) : null}
        
        {/* VS */}
        <Text style={styles.finalVsText}>VS</Text>
        
        {/* Team 2 */}
        {match.team2_flag ? (
          <Image 
            source={{ uri: match.team2_flag }} 
            style={styles.finalFlag}
            resizeMode="contain"
          />
        ) : null}
        <Text style={[
          styles.finalTeamName, 
          isTeam2Winner && !(team2Name === 'TBD') && styles.finalWinnerText,
          // Apply invalid style (gray) if invalid - applies to both winner and non-winner
          team2Invalid && styles.invalidText,
          // Add strike-through if eliminated - applies to both winner and non-winner
          team2Eliminated && styles.eliminatedText
        ]}>
          {team2Name}
        </Text>
        
        {/* Show correctness indicator if match finished */}
        {matchFinished && (
          <View style={styles.finalCorrectnessIndicator}>
            <Text style={[
              styles.correctnessSymbol, 
              match.is_correct ? styles.correctSymbol : styles.incorrectSymbol
            ]}>
              {match.is_correct ? '✓' : '✗'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        isFinal && styles.finalCardContainer,
        { borderColor } // Apply dynamic border color based on status
      ]}
      onPress={() => {
        console.log(`🔥 BracketMatchCard onPress called for match ${match.id}`);
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
            match.team1_id,
            match.team1_short_name,
            team1Invalid,
            team1Eliminated
          )}
          
          {renderTeam(
            match.team2_name, 
            match.team2_flag, 
            isTeam2Winner,
            match.team2_id,
            match.team2_short_name,
            team2Invalid,
            team2Eliminated
          )}
          
          {/* Show middle winner flag if winner_team_flag exists */}
          {match.winner_team_flag ? (
            <View style={styles.winnerFlagContainer}>
              <Image 
                source={{ uri: match.winner_team_flag }} 
                style={styles.winnerFlag}
                resizeMode="contain"
              />
            </View>
          ) : null}
          
          {/* Show correctness indicator if match finished */}
          {matchFinished && (
            <View style={styles.correctnessIndicator}>
              <Text style={[
                styles.correctnessSymbol, 
                match.is_correct ? styles.correctSymbol : styles.incorrectSymbol
              ]}>
                {match.is_correct ? '✓' : '✗'}
              </Text>
            </View>
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
    borderRadius: 16,
    padding: 4,
    marginVertical: 1,
    marginHorizontal: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    borderWidth: 2, // Increased from 1 to 2 for better visibility
    borderColor: '#e2e8f0',
    width: 90, // Smaller width
    height: 60, // Smaller height
    alignSelf: 'center',
    justifyContent: 'center',
  },
  matchContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingVertical: 2, // Small padding from edges
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
    paddingLeft: 4, // Fixed distance from left edge
    paddingRight: 2,
    borderRadius: 3,
    marginVertical: 0.5,
    minWidth: 70,
    justifyContent: 'flex-start', // Align to left instead of center
  },
  flag: {
    width: 18, // 12 * 1.5
    height: 12, // 8 * 1.5
    marginRight: 2,
  },
  teamName: {
    fontSize: 12, // 8 * 1.5
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  winnerText: {
    color: '#374151',
    fontWeight: '700', // Bold instead of green background
    fontSize: 13, // 12 + 1 (slightly larger for winner)
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
    borderWidth: 2, // Add border width for final match
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
  winnerFlagContainer: {
    position: 'absolute',
    right: 2,
    top: '50%',
    marginTop: -6,
    zIndex: 10,
  },
  winnerFlag: {
    width: 12,
    height: 8,
    borderWidth: 0.5,
    borderColor: '#d1d5db',
    borderRadius: 1,
  },
  correctnessIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  correctnessSymbol: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  correctSymbol: {
    color: '#38a169', // Green for correct
  },
  incorrectSymbol: {
    color: '#e53e3e', // Red for incorrect
  },
  invalidText: {
    color: '#9ca3af', // Lighter gray text for invalid team (position not good)
  },
  eliminatedText: {
    textDecorationLine: 'line-through', // Strike-through for eliminated teams
    textDecorationColor: '#e53e3e', // Red strike-through for better visibility
  },
  finalCorrectnessIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});
