import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KnockoutPrediction } from '../services/api';
import KnockoutStatsModal from './KnockoutStatsModal';

interface KnockoutMatchCardProps {
  prediction: KnockoutPrediction;
  onTeamPress: (teamId: number) => void;
  originalWinner?: number;
  isTouched?: boolean;
  isPreTournament?: boolean;
}

const KnockoutMatchCard = React.memo(({ prediction, onTeamPress, originalWinner, isTouched, isPreTournament }: KnockoutMatchCardProps) => {
  const [showStats, setShowStats] = useState(false);

  const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
  const team1IsTBD = isTBD(prediction.team1_name);
  const team2IsTBD = isTBD(prediction.team2_name);
  const currentWinner = originalWinner || prediction.winner_team_id;

  const isTeam1Winner = !team1IsTBD && currentWinner === prediction.team1_id;
  const isTeam2Winner = !team2IsTBD && currentWinner === prediction.team2_id;

  const handleTeamPress = (teamId: number) => {
    if ((teamId === prediction.team1_id && team1IsTBD) || (teamId === prediction.team2_id && team2IsTBD)) {
      return;
    }
    onTeamPress(teamId);
  };

  const statusUpper = prediction.status?.toUpperCase();

  // In PRE_GROUP_STAGE: only show warning if user touched this prediction
  // In all other stages: always show status
  const showStatusIndicator = isPreTournament ? !!isTouched : true;

  const isInvalid = statusUpper === 'INVALID' && showStatusIndicator;
  const isUnreachable = statusUpper === 'UNREACHABLE' && showStatusIndicator;

  const showScoreBadge = showStatusIndicator && (
    statusUpper === 'CORRECT_FULL' ||
    statusUpper === 'CORRECT_PARTIAL' ||
    statusUpper === 'INCORRECT'
  );

  const scoreBadgeColor =
    statusUpper === 'CORRECT_FULL' ? '#16a34a' :
    statusUpper === 'CORRECT_PARTIAL' ? '#f97316' :
    '#ef4444';

  const hasResult = showScoreBadge;
  const team1Invalid = hasResult ? false : (prediction.team1_is_valid === false);
  const team2Invalid = hasResult ? false : (prediction.team2_is_valid === false);

  const team1Eliminated = prediction.team1_is_eliminated === true;
  const team2Eliminated = prediction.team2_is_eliminated === true;

  const renderTeamHalf = (
    teamId: number,
    isTBD: boolean,
    flag: string | null | undefined,
    name: string | null | undefined,
    isWinner: boolean,
    isInvalid: boolean,
    isEliminated: boolean,
    isLeft: boolean
  ) => {
    const isPendingOrSaved = isWinner && !isTBD;
    return (
      <TouchableOpacity
        style={[
          styles.teamHalf,
          isPendingOrSaved && styles.teamHalfSelected,
          isLeft && styles.teamHalfLeft,
          isEliminated && styles.teamHalfEliminated,
        ]}
        onPress={() => handleTeamPress(teamId)}
        activeOpacity={0.7}
      >
        <View style={styles.teamHalfContent}>
          {!isTBD && flag ? (
            <Image source={{ uri: flag }} style={styles.teamFlag} />
          ) : (
            <View style={styles.tbdContent}>
              <Ionicons name="help-circle-outline" size={36} color="#cbd5e1" />
              <Text style={styles.tbdLabel}>TBD</Text>
            </View>
          )}
          {!isTBD && (
            <Text
              style={[
                styles.teamName,
                isPendingOrSaved && styles.teamNameSelected,
                !isPendingOrSaved && styles.teamNameDefault,
                isInvalid && styles.teamNameInvalid,
                isEliminated && styles.teamNameEliminated,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {name || ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.matchCard,
      (isTeam1Winner || isTeam2Winner) && styles.matchCardSelected,
    ]}>
      {showScoreBadge ? (
        <View style={[styles.scoreBadge, { backgroundColor: scoreBadgeColor }]}>
          <Text style={styles.scoreBadgeText}>
            {prediction.points !== undefined ? prediction.points : '?'}
          </Text>
        </View>
      ) : (isInvalid || isUnreachable) ? (
        <View style={[styles.invalidIndicator, isUnreachable && styles.unreachableIndicator]}>
          <Ionicons name="warning-outline" size={12} color="#ffffff" style={{ marginTop: 1 }} />
        </View>
      ) : null}

      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          setShowStats(true);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.statsButton}
      >
        <View style={styles.statsButtonInner}>
          <Ionicons name="stats-chart" size={11} color="#ffffff" />
        </View>
      </TouchableOpacity>

      <View style={styles.halvesRow}>
        {renderTeamHalf(
          prediction.team1_id,
          team1IsTBD,
          prediction.team1_flag,
          prediction.team1_name,
          isTeam1Winner,
          team1Invalid,
          team1Eliminated,
          true
        )}
        {renderTeamHalf(
          prediction.team2_id,
          team2IsTBD,
          prediction.team2_flag,
          prediction.team2_name,
          isTeam2Winner,
          team2Invalid,
          team2Eliminated,
          false
        )}
      </View>

      <KnockoutStatsModal
        visible={showStats}
        templateMatchId={prediction.template_match_id}
        onClose={() => setShowStats(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  matchCardSelected: {
    borderColor: '#475569',
  },
  halvesRow: {
    flexDirection: 'row',
    height: 90,
    alignItems: 'stretch',
  },
  teamHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 0,
    backgroundColor: '#f8fafc',
  },
  teamHalfSelected: {
    backgroundColor: '#dcfce7',
  },
  teamHalfLeft: {
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
  },
  teamHalfContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  teamFlag: {
    width: 44,
    height: 32,
    borderRadius: 6,
    marginBottom: 8,
  },
  tbdContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbdLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 13,
    textAlign: 'center',
  },
  teamNameDefault: {
    color: '#374151',
    fontWeight: '500',
  },
  teamNameSelected: {
    color: '#15803d',
    fontWeight: '700',
  },
  teamNameInvalid: {
    color: '#9ca3af',
  },
  teamNameEliminated: {
    textDecorationLine: 'line-through',
  },
  teamHalfEliminated: {
    opacity: 0.35,
  },
  invalidIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#ef4444',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 1,
  },
  unreachableIndicator: {
    backgroundColor: '#f97316',
  },
  scoreBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    borderRadius: 10,
    minWidth: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  statsButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  statsButtonRight: {
    left: undefined,
    right: 8,
  },
  statsButtonInner: {
    backgroundColor: '#0284c7',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default KnockoutMatchCard;
