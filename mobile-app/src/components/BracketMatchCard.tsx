import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BracketMatch } from '../utils/bracketCalculator';

const TROPHY_IMAGE = require('../../assets/trophy.png');

interface BracketMatchCardProps {
  match: BracketMatch;
  onPress?: (match: BracketMatch) => void;
  onLayout?: (matchId: number, layout: { x: number; y: number; width: number; height: number }) => void;
}

export default function BracketMatchCard({ match, onPress, onLayout }: BracketMatchCardProps) {
  const isTeam1Winner = match.winner_team_id === match.team1_id;
  const isTeam2Winner = match.winner_team_id === match.team2_id;
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
        return '#f59e0b';
      case 'correct_full':
      case 'correct_partial':
      case 'incorrect':
      default:
        return '#cbd5e1';
    }
  };

  const borderColor = getStatusColor(match.status);

  // Extract winner flag from team1/team2 based on winner_team_id when winner_team_flag is null
  const resolvedWinnerFlag = match.winner_team_flag
    || (match.winner_team_id === match.team1_id ? match.team1_flag : null)
    || (match.winner_team_id === match.team2_id ? match.team2_flag : null);

  const getHalfBackground = (
    isWinner: boolean,
    isInvalid: boolean
  ): string => {
    if (isInvalid) return '#f9fafb';
    if (isWinner) return '#f0fdf4';
    return '#fafafa';
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
        <View style={[styles.teamHalfInner, { opacity: isEliminated ? 0.25 : 1 }]}>
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

    return (
      <View style={styles.finalContainer}>
        {/* Team 1 - name + large flag */}
        <Text style={styles.finalTeamName}>{team1Name}</Text>
        {match.team1_flag ? (
          <View style={styles.finalFlagWrapper}>
            <Image
              source={{ uri: match.team1_flag }}
              style={styles.finalFlag}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.finalTbdPlaceholder} />
        )}

        <Text style={styles.finalVsText}>VS</Text>

        {/* Team 2 - large flag + name */}
        {match.team2_flag ? (
          <View style={styles.finalFlagWrapper}>
            <Image
              source={{ uri: match.team2_flag }}
              style={styles.finalFlag}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.finalTbdPlaceholder} />
        )}
        <Text style={styles.finalTeamName}>{team2Name}</Text>
      </View>
    );
  };

  if (isFinal) {
    return (
      <View style={styles.finalWrapper}>
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

        {/* The actual final match card */}
        <View style={styles.finalGlowOuter}>
          <TouchableOpacity
            style={[styles.container, styles.finalCardContainer]}
            onPress={() => onPress?.(match)}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              onLayout?.(match.id, { x, y, width, height });
            }}
            activeOpacity={0.7}
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
    <View style={styles.wrapper}>
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
    backgroundColor: '#fafafa',
    marginVertical: 1,
    marginHorizontal: 1,
    alignSelf: 'center',
  },
  container: {
    backgroundColor: '#fafafa',
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
    color: '#374151',
    flex: 1,
  },
  teamNameInvalid: {
    color: '#cbd5e1',
  },
  halfDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  finalCardContainer: {
    width: 130,
    height: 220,
    padding: 4,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#f59e0b',
    justifyContent: 'center',
  },
  finalGlowOuter: {
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 15,
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
    color: '#1f2937',
    textAlign: 'center',
    marginVertical: 2,
    letterSpacing: 0.3,
  },
  finalFlag: {
    width: 44,
    height: 30,
    borderWidth: 0.5,
    borderColor: '#d1d5db',
    borderRadius: 6,
  },
  finalFlagWrapper: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 2,
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#6b7280',
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
    backgroundColor: '#f8fafc',
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
    color: '#6b7280',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  winnerFlagPlaceholder: {
    width: 80,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#f3f4f6',
  },
  winnerPlaceholder: {
    height: 80,
    marginBottom: 8,
  },
});
