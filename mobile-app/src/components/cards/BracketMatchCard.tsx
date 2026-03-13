import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BracketMatch } from '../../utils/bracketCalculator';

const TROPHY_IMAGE = require('../../../assets/trophy.png');

interface BracketMatchCardProps {
  match: BracketMatch;
  onPress?: (match: BracketMatch) => void;
  onLayout?: (matchId: number, layout: { x: number; y: number; width: number; height: number }) => void;
}

export default function BracketMatchCard({ match, onPress, onLayout }: BracketMatchCardProps) {
  const isLocked = match.is_editable === false;
  const hasWinner = !!match.winner_team_id && match.winner_team_id !== 0;
  const isTeam1Winner = hasWinner && match.winner_team_id === match.team1_id;
  const isTeam2Winner = hasWinner && match.winner_team_id === match.team2_id;
  const isFinal = match.stage === 'final';

  const matchHasResult = ['correct_full', 'correct_partial', 'incorrect'].includes(match.status || '');
  const team1Invalid = matchHasResult ? false : (match.team1_is_valid === false);
  const team2Invalid = matchHasResult ? false : (match.team2_is_valid === false);

  const getScoreBadge = () => {
    if (!match.status || match.points === undefined || match.points === null) return null;
    const s = match.status;
    if (s !== 'correct_full' && s !== 'correct_partial' && s !== 'incorrect') return null;
    const pointsStr = match.points > 0 ? `+${match.points}` : `${match.points}`;
    let bg = '#e2e8f0';
    if (s === 'correct_full') bg = '#16a34a';
    else if (s === 'correct_partial') bg = '#d97706';
    else if (s === 'incorrect') bg = '#dc2626';
    return { points: pointsStr, bg, text: '#fff' };
  };
  const scoreBadge = getScoreBadge();
  const team1Eliminated = match.team1_is_eliminated === true;
  const team2Eliminated = match.team2_is_eliminated === true;

  const getStatusColor = (status?: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'valid':
        return '#cbd5e1';
      case 'invalid':
        return '#ef4444';
      case 'unreachable':
        return '#fb923c'; // light orange - distinct from gold final & red invalid
      case 'correct_full':
      case 'correct_partial':
      case 'incorrect':
      default:
        return '#cbd5e1';
    }
  };

  const borderColor = getStatusColor(match.status);

  // Extract winner flag from team1/team2 based on winner_team_id when winner_team_flag is null
  const resolvedWinnerFlag = hasWinner
    ? (match.winner_team_flag
        || (match.winner_team_id === match.team1_id ? match.team1_flag : null)
        || (match.winner_team_id === match.team2_id ? match.team2_flag : null))
    : null;

  const getHalfBackground = (
    isWinner: boolean,
    isInvalid: boolean
  ): string => {
    if (isInvalid) return '#152a45';
    if (isWinner) return 'rgba(22,163,74,0.2)';
    return '#1e3a5f';
  };

  const team1Bg = getHalfBackground(isTeam1Winner, team1Invalid);
  const team2Bg = getHalfBackground(isTeam2Winner, team2Invalid);

  const renderTeamHalf = (
    teamName: string | undefined,
    teamFlag: string | undefined,
    teamShortName: string | undefined,
    halfBg: string,
    isInvalid: boolean,
    isEliminated: boolean
  ) => {
    const isTBD = !teamName || teamName === 'TBD' || (teamName && teamName.trim() === '');
    const displayName = isTBD ? '' : (teamShortName || (teamName ? teamName : ''));

    return (
      <View style={[styles.teamHalf, { backgroundColor: halfBg }]}>
        <View style={styles.teamHalfInner}>
          {isTBD ? (
            <View style={styles.tbdFlagPlaceholder} />
          ) : teamFlag ? (
            <Image
              source={{ uri: teamFlag }}
              style={styles.flag}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.tbdFlagPlaceholder} />
          )}
          <Text
            style={[
              styles.teamName,
              isInvalid && styles.teamNameInvalid,
              isEliminated && styles.teamNameStrikethrough,
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>
      </View>
    );
  };

  const renderFinalMatch = () => {
    const team1IsTBD = !match.team1_name || match.team1_name === 'TBD';
    const team2IsTBD = !match.team2_name || match.team2_name === 'TBD';
    const team1Name = team1IsTBD ? '' : match.team1_name;
    const team2Name = team2IsTBD ? '' : match.team2_name;

    const renderFinalTeam1 = () => (
      <View style={styles.finalTeamBlock}>
        <Text style={[styles.finalTeamName, team1Eliminated && styles.finalTeamNameStrikethrough]}>
          {team1Name}
        </Text>
        {match.team1_flag ? (
          <View style={styles.finalFlagWrapper}>
            <Image source={{ uri: match.team1_flag }} style={styles.finalFlag} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.finalTbdPlaceholder} />
        )}
      </View>
    );

    const renderFinalTeam2 = () => (
      <View style={styles.finalTeamBlock}>
        {match.team2_flag ? (
          <View style={styles.finalFlagWrapper}>
            <Image source={{ uri: match.team2_flag }} style={styles.finalFlag} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.finalTbdPlaceholder} />
        )}
        <Text style={[styles.finalTeamName, team2Eliminated && styles.finalTeamNameStrikethrough]}>
          {team2Name}
        </Text>
      </View>
    );

    return (
      <View style={styles.finalContainer}>
        {renderFinalTeam1()}
        <Text style={styles.finalVsText}>VS</Text>
        {renderFinalTeam2()}
      </View>
    );
  };

  if (isFinal) {
    const isInvalid = match.status?.toLowerCase() === 'invalid';
    const finalBorderColor = isInvalid ? '#ef4444' : '#ffffff';
    const finalGlowColor = isInvalid ? '#ef4444' : '#f59e0b';

    return (
      <View style={[styles.finalWrapper, isLocked && { opacity: 0.45 }]}>
        {/* Winner or placeholder ABOVE the card */}
        {match.winner_team_id ? (
          <View style={styles.winnerBanner}>
            <Text style={styles.winnerLabel}>WINNER</Text>
            <View style={styles.winnerTeamRow}>
              {resolvedWinnerFlag ? (
                <Image
                  source={{ uri: resolvedWinnerFlag }}
                  style={styles.winnerBannerFlag}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.winnerFlagPlaceholder} />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.winnerPlaceholder} />
        )}

        {/* Trophy image between winner and card */}
        <View style={styles.trophyWrapper}>
          <Image source={TROPHY_IMAGE} style={styles.trophyImage} resizeMode="contain" />
        </View>

        {/* The actual final match card - invalid = red+glow, else gold */}
        <View style={[
          styles.finalGlowOuter,
          {
            shadowColor: finalGlowColor,
            shadowOpacity: 0.45,
            shadowRadius: 18,
            elevation: 15,
          },
        ]}>
          <TouchableOpacity
            style={[styles.container, styles.finalCardContainer, { borderColor: finalBorderColor }]}
            onPress={() => onPress?.(match)}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              onLayout?.(match.id, { x, y, width, height });
            }}
            activeOpacity={isLocked ? 1 : 0.7}
          >
            {renderFinalMatch()}
            {scoreBadge && (
              <View style={[styles.scoreBadgeCircle, { backgroundColor: scoreBadge.bg }]}>
                <Text style={[styles.scoreBadgeText, { color: scoreBadge.text }]}>
                  {scoreBadge.points}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isLocked && { opacity: 0.45 }]}>
      <View style={[
        styles.shadowWrapper,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: borderColor === '#cbd5e1' ? 0.3 : 0.5,
          shadowRadius: borderColor === '#cbd5e1' ? 4 : 12,
          elevation: borderColor === '#cbd5e1' ? 5 : 12,
        }
      ]}>
        <TouchableOpacity
          style={[styles.container, { borderColor }]}
          onPress={() => onPress?.(match)}
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            onLayout?.(match.id, { x, y, width, height });
          }}
          activeOpacity={isLocked ? 1 : 0.7}
        >
          <View style={styles.matchContainer}>
          {renderTeamHalf(
            match.team1_name,
            match.team1_flag,
            match.team1_short_name,
            team1Bg,
            team1Invalid,
            team1Eliminated
          )}
          <View style={styles.halfDivider} />
          {renderTeamHalf(
            match.team2_name,
            match.team2_flag,
            match.team2_short_name,
            team2Bg,
            team2Invalid,
            team2Eliminated
          )}
        </View>
        {scoreBadge && (
          <View style={[styles.scoreBadgeCircle, { backgroundColor: scoreBadge.bg }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreBadge.text }]}>
              {scoreBadge.points}
            </Text>
          </View>
        )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowWrapper: {
    borderRadius: 20,
    backgroundColor: '#1e3a5f',
    marginVertical: 1,
    marginHorizontal: 1,
    alignSelf: 'center',
  },
  container: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#cbd5e1',
    width: 100,
    height: 68,
  },
  matchContainer: {
    flex: 1,
  },
  teamHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 4,
    position: 'relative',
  },
  teamHalfInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  flag: {
    width: 20,
    height: 14,
    marginRight: 4,
    borderRadius: 5,
  },
  tbdFlagPlaceholder: {
    width: 16,
    height: 10,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  teamName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#e2e8f0',
    flex: 1,
  },
  teamNameInvalid: {
    color: '#475569',
  },
  teamNameStrikethrough: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#000000',
    textDecorationStyle: 'double',
    color: '#94a3b8',
    opacity: 0.8,
  },
  halfDivider: {
    height: 1,
    backgroundColor: '#2d4a6e',
  },
  finalCardContainer: {
    width: 130,
    height: 220,
    padding: 4,
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    borderWidth: 2.5,
    justifyContent: 'center',
  },
  finalGlowOuter: {
    shadowOffset: { width: 0, height: 0 },
    borderRadius: 20,
  },
  finalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  trophyEmoji: {
    fontSize: 32,
    color: '#d97706',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderEmoji: {
    fontSize: 28,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  finalTeamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    textAlign: 'center',
    marginVertical: 2,
    letterSpacing: 0.3,
  },
  finalFlag: {
    width: 44,
    height: 30,
  },
  finalFlagWrapper: {
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  finalTeamBlock: {
    alignItems: 'center',
  },
  finalTeamNameStrikethrough: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#000000',
    textDecorationStyle: 'double',
    color: '#94a3b8',
    opacity: 0.8,
  },
  finalTbdPlaceholder: {
    width: 44,
    height: 30,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
    borderRadius: 6,
  },
  finalVsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    marginVertical: 2,
    letterSpacing: 2,
  },
  scoreBadgeCircle: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  scoreBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  finalWrapper: {
    alignItems: 'center',
  },
  trophyWrapper: {
    height: 110,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12,
    marginTop: 8,
  },
  trophyImage: {
    width: 72,
    height: 96,
  },
  winnerBanner: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  winnerLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#94a3b8',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  winnerTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBannerFlag: {
    width: 80,
    height: 54,
  },
  winnerFlagPlaceholder: {
    width: 80,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    borderStyle: 'dashed',
    backgroundColor: '#152a45',
  },
  winnerPlaceholder: {
    height: 80,
    marginBottom: 8,
  },
});
