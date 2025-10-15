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

  // Helper function to get position text
  const getPositionText = (position: number | null): string => {
    if (position === null) return '-';
    return `${position}`;
  };

  return (
    <View style={[styles.container, isIncomplete && styles.containerIncomplete]}>
      {/* Group Header */}
      <View style={styles.header}>
        <Text style={styles.groupName}>Group {group.group_name}</Text>
        {group.points > 0 && (
          <Text style={styles.points}>{group.points} pts</Text>
        )}
      </View>

      {/* Teams List */}
      <View style={styles.teamsContainer}>
        {group.teams.map((team) => {
          const position = getTeamPosition(team.id);
          return (
            <TouchableOpacity
              key={team.id}
              style={styles.teamRow}
              onPress={() => onTeamPress(group.group_id, team.id)}
              activeOpacity={0.7}
            >
              {/* Position Badge - always show (with placeholder or number) */}
              <View style={[
                styles.positionBadge,
                position === null && styles.positionBadgePlaceholder
              ]}>
                <Text style={[
                  styles.positionText,
                  position === null && styles.positionTextPlaceholder
                ]}>
                  {position !== null ? position : '○'}
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
  points: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38a169',
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

