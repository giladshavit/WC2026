import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { GroupPrediction } from '../services/api';

interface GroupCardProps {
  group: GroupPrediction;
  onTeamPress: (groupId: number, teamId: number) => void;
  isIncomplete?: boolean;
}

export default function GroupCard({ group, onTeamPress, isIncomplete = false }: GroupCardProps) {
  // Helper function to get position for a team
  const getTeamPosition = (teamId: number): number | null => {
    if (group.first_place === teamId) return 1;
    if (group.second_place === teamId) return 2;
    if (group.third_place === teamId) return 3;
    if (group.fourth_place === teamId) return 4;
    return null;
  };

  // Helper function to get actual position from result
  const getActualPosition = (teamId: number): number | null => {
    if (!group.result) return null;
    if (group.result.first_place === teamId) return 1;
    if (group.result.second_place === teamId) return 2;
    if (group.result.third_place === teamId) return 3;
    if (group.result.fourth_place === teamId) return 4;
    return null;
  };

  // Helper function to check if prediction is correct
  const isPredictionCorrect = (teamId: number): boolean | null => {
    const predictedPosition = getTeamPosition(teamId);
    const actualPosition = getActualPosition(teamId);
    
    if (predictedPosition === null || actualPosition === null) return null;
    return predictedPosition === actualPosition;
  };

  // Check if group has result - if yes, it's not editable
  const hasResult = group.result !== null && group.result !== undefined;
  const isEditable = group.is_editable && !hasResult;

  return (
    <View style={[styles.container, isIncomplete && styles.containerIncomplete]}>
      {/* Group Header */}
      <View style={styles.header}>
        <Text style={styles.groupName}>Group {group.group_name}</Text>
        {hasResult && (
          <View style={[styles.pointsContainer, group.points === 0 && styles.pointsContainerZero]}>
            <Text style={styles.pointsText}>
              {group.points} נק׳
            </Text>
          </View>
        )}
      </View>

      {/* Teams List */}
      <View style={styles.teamsContainer}>
        {/* Display teams in the exact order received from server (already sorted if needed) */}
        {group.teams.map((team) => {
          const position = getTeamPosition(team.id);
          const isCorrect = isPredictionCorrect(team.id);
          const hasResult = group.result !== null && group.result !== undefined;
          
          // Determine badge color based on result
          let badgeStyle = styles.positionBadge;
          let badgeTextStyle = styles.positionText;
          
          if (hasResult && isCorrect !== null) {
            if (isCorrect) {
              // Correct prediction - green
              badgeStyle = styles.positionBadgeCorrect;
            } else {
              // Wrong prediction - red
              badgeStyle = styles.positionBadgeWrong;
            }
          }
          
          if (position === null) {
            if (hasResult && isCorrect !== null) {
              // Already set to correct/wrong above
            } else {
              badgeStyle = {...styles.positionBadge, ...styles.positionBadgePlaceholder};
              badgeTextStyle = {...styles.positionText, ...styles.positionTextPlaceholder};
            }
          }
          
          return (
            <TouchableOpacity
              key={team.id}
              style={styles.teamRow}
              onPress={() => isEditable && onTeamPress(group.group_id, team.id)}
              activeOpacity={isEditable ? 0.7 : 1}
              disabled={!isEditable}
            >
              {/* Position Badge - always show (with placeholder or number) */}
              <View style={badgeStyle}>
                <Text style={badgeTextStyle}>
                  {position !== null ? position : ''}
                </Text>
              </View>

              {/* Team Flag */}
              {team.flag_url && (
                <Image 
                  source={{ uri: team.flag_url }} 
                  style={styles.flag}
                />
              )}

              {/* Team Name */}
              <Text style={styles.teamName}>{team.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
  },
  containerIncomplete: {
    borderColor: '#f6ad55',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  pointsContainer: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pointsContainerZero: {
    backgroundColor: '#FF9800',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  teamsContainer: {
    padding: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 2,
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  positionBadgeCorrect: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#48bb78', // Green for correct
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  positionBadgeWrong: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f56565', // Red for wrong
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  positionBadgePlaceholder: {
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  positionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  positionTextPlaceholder: {
    color: '#a0aec0',
    fontSize: 16,
  },
  flag: {
    width: 28,
    height: 20,
    borderRadius: 3,
    marginRight: 8,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
  },
});

