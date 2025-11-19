import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { GroupPrediction } from '../services/api';

interface GroupCardProps {
  group: GroupPrediction;
  onTeamPress: (groupId: number, teamId: number) => void;
  isIncomplete?: boolean;
  hasPendingChanges?: boolean;
}

export default function GroupCard({ group, onTeamPress, isIncomplete = false, hasPendingChanges = false }: GroupCardProps) {
  // Helper function to get position for a team
  const getTeamPosition = (teamId: number): number | null => {
    if (group.first_place === teamId) return 1;
    if (group.second_place === teamId) return 2;
    if (group.third_place === teamId) return 3;
    if (group.fourth_place === teamId) return 4;
    return null;
  };

  // Get subtle background color based on group number for visual separation
  const getGroupBackgroundColor = () => {
    const groupNum = parseInt(group.group_name) || 0;
    // Alternate between subtle warm shades (less white)
    if (groupNum % 2 === 0) {
      return '#f8f9fa'; // Very light gray
    } else {
      return '#f5f6f7'; // Slightly darker light gray
    }
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
    <View style={[styles.container, { backgroundColor: getGroupBackgroundColor() }, hasPendingChanges && styles.containerPending, isIncomplete && styles.containerIncomplete]}>
      {/* Group Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={styles.groupName}>Group {group.group_name}</Text>
        <View style={styles.headerRight}>
          {hasResult && (
            <View style={[styles.pointsContainer, group.points === 0 && styles.pointsContainerZero]}>
              <Text style={styles.pointsText}>
                {group.points} pts
              </Text>
            </View>
          )}
        </View>
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
          } else if (!hasResult && position !== null) {
            // No result yet - use different colors to distinguish qualification status
            switch (position) {
              case 1:
              case 2:
                // Places 1-2: Qualified automatically (same color)
                badgeStyle = styles.positionBadgeQualified;
                break;
              case 3:
                // Place 3: Waiting for qualification
                badgeStyle = styles.positionBadgeWaiting;
                break;
              case 4:
                // Place 4: Eliminated
                badgeStyle = styles.positionBadgeEliminated;
                break;
              default:
                badgeStyle = styles.positionBadge;
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
    backgroundColor: '#ffffff', // White background for better contrast
    marginHorizontal: 16,
    marginVertical: 8, // Spacing between groups
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0', // Light gray border
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    flex: 1,
  },
  containerPending: {
    borderColor: '#f6ad55',
    borderWidth: 2,
    backgroundColor: '#fff9e6', // Light yellow background for pending
  },
  containerIncomplete: {
    borderColor: '#f6ad55',
    borderWidth: 2,
    backgroundColor: '#fff9e6', // Light yellow background for incomplete
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f7fafc', // Very light gray-blue for header
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#ffffff', // White background for team rows
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#48bb78', // Green badge
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  positionBadgeQualified: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb', // Deeper blue for places 1-2 (qualified automatically)
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  positionBadgeWaiting: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f59e0b', // Orange/amber for place 3 (waiting for qualification)
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  positionBadgeEliminated: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f2937', // Dark gray/black for place 4 (eliminated)
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  positionBadgeCorrect: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#48bb78', // Green for correct
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  positionBadgeWrong: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f56565', // Red for wrong
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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

