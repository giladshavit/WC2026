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
  isLocked?: boolean;
}

const KnockoutMatchCard = React.memo(({ prediction, onTeamPress, originalWinner, isTouched, isPreTournament, isLocked }: KnockoutMatchCardProps) => {
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

  const isInvalid = statusUpper === 'INVALID' && showStatusIndicator && !isLocked;
  const isUnreachable = statusUpper === 'UNREACHABLE' && showStatusIndicator && !isLocked;

  const showScoreBadge = showStatusIndicator && (
    statusUpper === 'CORRECT_FULL' ||
    statusUpper === 'CORRECT_PARTIAL' ||
    statusUpper === 'INCORRECT'
  );

  const scoreBadgeColor =
    statusUpper === 'CORRECT_FULL' ? '#16a34a' :    // green
    statusUpper === 'CORRECT_PARTIAL' ? '#f97316' : // orange
    '#ef4444';                                       // red

  const hasResult = showScoreBadge;
  const team1Invalid = hasResult ? false : (prediction.team1_is_valid === false);
  const team2Invalid = hasResult ? false : (prediction.team2_is_valid === false);

  const team1Eliminated = prediction.team1_is_eliminated === true;
  const team2Eliminated = prediction.team2_is_eliminated === true;

  const cardBackground = '#ffffff';

  const team1Bg = isTeam1Winner ? '#bbf7d0' : '#ffffff';
  const team2Bg = isTeam2Winner ? '#bbf7d0' : '#ffffff';
  const team1TextColor = isTeam1Winner ? '#16a34a' : '#374151';
  const team2TextColor = isTeam2Winner ? '#16a34a' : '#374151';

  const renderTeamHalf = (
    teamId: number,
    isTBD: boolean,
    flag: string | null | undefined,
    name: string | null | undefined,
    isInvalid: boolean,
    isEliminated: boolean,
    isLeft: boolean,
    halfBg: string,
    textColor: string
  ) => {
    const halfStyle = [
      styles.teamHalf,
      isLeft && styles.teamHalfLeft,
      { backgroundColor: halfBg },
    ];
    const content = (
      <View style={styles.teamHalfContent}>
          {!isTBD && flag ? (
            <Image source={{ uri: flag }} style={[styles.teamFlag, isEliminated && { opacity: 1 }]} />
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
                isInvalid && styles.teamNameInvalid,
                isEliminated && styles.teamNameEliminated,
                {
                  color: textColor,
                  fontWeight: textColor === '#16a34a' ? '700' as const : '500' as const,
                  ...(isEliminated && { opacity: 1, textDecorationLine: 'line-through' as const }),
                },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {name || ''}
            </Text>
          )}
        </View>
    );
    return isLocked ? (
      <View style={halfStyle}>{content}</View>
    ) : (
      <TouchableOpacity style={halfStyle} onPress={() => handleTeamPress(teamId)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.matchCard,
      {
        backgroundColor: cardBackground,
        borderWidth: 1,
        borderColor: '#d1d5db',
      },
    ]}>
      {showScoreBadge ? (
        <View style={[styles.scoreBadge, { backgroundColor: scoreBadgeColor }]}>
          <Text style={styles.scoreBadgeText}>
            {prediction.points !== undefined ? prediction.points : '?'}
          </Text>
        </View>
      ) : isUnreachable ? (
        <View style={[styles.warningIconTopRight, styles.invalidIndicator, styles.unreachableIndicator]}>
          <Ionicons name="alert-circle-outline" size={22} color="#ca8a04" />
        </View>
      ) : isInvalid ? (
        <View style={[styles.warningIconTopRight, styles.invalidIndicator]}>
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
          team1Invalid,
          team1Eliminated,
          true,
          team1Bg,
          team1TextColor
        )}
        {renderTeamHalf(
          prediction.team2_id,
          team2IsTBD,
          prediction.team2_flag,
          prediction.team2_name,
          team2Invalid,
          team2Eliminated,
          false,
          team2Bg,
          team2TextColor
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
  warningIconTopRight: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  invalidIndicator: {
    backgroundColor: '#ef4444',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 1,
  },
  unreachableIndicator: {
    backgroundColor: '#fef3c7',
    width: 28,
    height: 28,
    borderRadius: 14,
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
