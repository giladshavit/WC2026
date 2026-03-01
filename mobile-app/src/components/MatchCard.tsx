import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MatchStatsModal from './MatchStatsModal';
import type { TextInput as RNTextInput } from 'react-native';
import { Match } from '../services/api';

type ScoreField = 'home' | 'away';

interface MatchCardProps {
  match: Match;
  onScoreChange: (matchId: number, homeScore: number | null, awayScore: number | null) => void;
  hasPendingChanges?: boolean;
  onInputFocus?: (matchId: number) => void;
}

const MatchStatusIndicator = ({ status }: { status: string }) => {
  const dotOpacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (status !== 'live_editable' && status !== 'live_locked') return;
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.1, duration: 800, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [status]);

  if (status !== 'live_editable' && status !== 'live_locked') return null;

  return (
    <View style={styles.liveContainer}>
      <Animated.View style={[styles.liveDot, { opacity: dotOpacity }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
};

// Component for actual result display (below score inputs)
// Always rendered so all cards have identical height; shows " " when no result
const ActualResultDisplay = ({ actualResult }: { actualResult: any }) => (
  <View style={styles.actualResultContainer}>
    <Text style={styles.actualResultScore}>
      {actualResult ? `${actualResult.home_score} - ${actualResult.away_score}` : ' '}
    </Text>
  </View>
);

// Component for points display (bottom right)
const PointsDisplay = ({ userPrediction, actualResult }: {
  userPrediction: any;
  actualResult: any;
}) => {
  if (!actualResult) return null;

  const points = userPrediction?.points ?? 0;
  const status = userPrediction?.status;

  const getBackgroundColor = () => {
    switch (status) {
      case 'exact':
        return '#16a34a'; // green
      case 'correct_outcome':
        return '#f97316'; // orange
      case 'wrong':
        return '#ef4444'; // red
      default:
        return '#94a3b8'; // gray fallback
    }
  };

  return (
    <View style={[styles.pointsContainer, { backgroundColor: getBackgroundColor() }]}>
      <Text style={styles.pointsText}>{points} pts</Text>
    </View>
  );
};

// Component for blinking cursor
const BlinkingCursor = () => {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.cursor, { opacity }]} />
  );
};

export default function MatchCard({ match, onScoreChange, hasPendingChanges = false, onInputFocus }: MatchCardProps) {
  const [homeScore, setHomeScore] = React.useState<string>(
    match.user_prediction.home_score?.toString() || ''
  );
  const [awayScore, setAwayScore] = React.useState<string>(
    match.user_prediction.away_score?.toString() || ''
  );
  const [homeFocused, setHomeFocused] = React.useState(false);
  const [awayFocused, setAwayFocused] = React.useState(false);
  const homeInputRef = React.useRef<RNTextInput | null>(null);
  const awayInputRef = React.useRef<RNTextInput | null>(null);
  const [showStats, setShowStats] = React.useState(false);
  const originalScoreRef = React.useRef<Record<ScoreField, string | null>>({
    home: null,
    away: null,
  });
  const overwriteRef = React.useRef<Record<ScoreField, boolean>>({
    home: false,
    away: false,
  });

  const isEditable = match.can_edit;
  const separatorChar = ':';
  const homeName = match.home_team.name || '';
  const awayName = match.away_team.name || '';

  // Call onScoreChange only when user manually changes scores
  const handleScoreChange = React.useCallback((field: ScoreField, value: string) => {
    if (field === 'home') {
      setHomeScore(value);
    } else {
      setAwayScore(value);
    }
    
    // Calculate the new scores
    const home = field === 'home' ? (value ? parseInt(value) : null) : (homeScore ? parseInt(homeScore) : null);
    const away = field === 'away' ? (value ? parseInt(value) : null) : (awayScore ? parseInt(awayScore) : null);
    
    // Only send if there's a real change from the original prediction
    const originalHome = match.user_prediction.home_score;
    const originalAway = match.user_prediction.away_score;
    
    if (home !== originalHome || away !== originalAway) {
      onScoreChange(match.id, home, away);
    }
  }, [homeScore, awayScore, match.id, onScoreChange, match.user_prediction.home_score, match.user_prediction.away_score]);

  const handleHomeInputChange = React.useCallback((value: string) => {
    const trimmed = value.slice(-1);
    if (trimmed === '') {
      handleScoreChange('home', '');
      return;
    }

    if (overwriteRef.current.home) {
      overwriteRef.current.home = false;
    }

    handleScoreChange('home', trimmed);
    
    // If match has no result and away score is empty, focus on away input
    const hasNoResult = !match.actual_result;
    if (hasNoResult && isEditable && !awayScore) {
      // Don't blur - directly focus on next input to keep keyboard open
      setHomeFocused(false);
      setAwayFocused(true);
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        awayInputRef.current?.focus();
      });
    } else {
      // Only blur if we're not moving to next input
      setHomeFocused(false);
      homeInputRef.current?.blur();
    }
  }, [handleScoreChange, match.actual_result, isEditable, awayScore]);
 
   const handleAwayInputChange = React.useCallback((value: string) => {
    const trimmed = value.slice(-1);
    if (trimmed === '') {
      handleScoreChange('away', '');
      return;
    }

    if (overwriteRef.current.away) {
      overwriteRef.current.away = false;
    }

    handleScoreChange('away', trimmed);
    
    // If match has no result and home score is empty, focus on home input
    const hasNoResult = !match.actual_result;
    if (hasNoResult && isEditable && !homeScore) {
      // Don't blur - directly focus on next input to keep keyboard open
      setAwayFocused(false);
      setHomeFocused(true);
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        homeInputRef.current?.focus();
      });
    } else {
      // Only blur if we're not moving to next input
      setAwayFocused(false);
      awayInputRef.current?.blur();
    }
  }, [handleScoreChange, match.actual_result, isEditable, homeScore]);

  const handleFocus = React.useCallback((field: ScoreField) => {
    const isHome = field === 'home';
    const scoreValue = isHome ? homeScore : awayScore;
    const setFocusedState = isHome ? setHomeFocused : setAwayFocused;
    const inputRef = isHome ? homeInputRef : awayInputRef;

    setFocusedState(true);
    onInputFocus?.(match.id);
    originalScoreRef.current[field] = scoreValue;
    overwriteRef.current[field] = isEditable && scoreValue.length > 0;

    
    const input = inputRef.current;
    if (input && scoreValue.length > 0) {
      input.setNativeProps({ selection: { start: 0, end: scoreValue.length } });
    }
  }, [awayScore, homeScore, isEditable, match.id, onInputFocus]);

  const handleBlur = React.useCallback((field: ScoreField) => {
    const isHome = field === 'home';
    const setFocusedState = isHome ? setHomeFocused : setAwayFocused;
    const currentScore = isHome ? homeScore : awayScore;
    const originalScore = originalScoreRef.current[field];

    setFocusedState(false);

    if (currentScore === '' && originalScore) {
      handleScoreChange(field, originalScore);
    }

    originalScoreRef.current[field] = null;
    overwriteRef.current[field] = false;
  }, [awayScore, handleScoreChange, homeScore]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}  ·  ${hours}:${minutes}`;
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'group':
        return `Group ${match.group}`;
      case 'round32':
        return 'Round of 32';
      case 'round16':
        return 'Round of 16';
      case 'quarter':
        return 'Quarter Final';
      case 'semi':
        return 'Semi Final';
      case 'final':
        return 'Final';
      default:
        return stage;
    }
  };

  const renderTeamColumn = (field: ScoreField) => {
    const team = field === 'home' ? match.home_team : match.away_team;
    return (
      <View style={styles.teamColumn}>
        <View style={styles.teamFlagWrapper}>
          {team.flag_url && (
            <Image source={{ uri: team.flag_url }} style={styles.teamFlagLarge} />
          )}
        </View>
      </View>
    );
  };

  const renderTeamName = (field: ScoreField) => {
    const name = field === 'home' ? homeName : awayName;
    return (
      <View style={styles.teamNameWrapper}>
        <Text
          style={[styles.teamName, field === 'home' && styles.teamNameHome]}
          numberOfLines={field === 'home' ? 1 : 2}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
      </View>
    );
  };

  const renderScoreInput = (field: ScoreField) => {
    const isHome = field === 'home';
    const scoreValue = isHome ? homeScore : awayScore;
    const isFieldFocused = isHome ? homeFocused : awayFocused;
    const inputRef = isHome ? homeInputRef : awayInputRef;
    const handleChange = isHome ? handleHomeInputChange : handleAwayInputChange;

    // Check if we should show cursor: match has no result, field is editable, empty, and focused
    const hasNoResult = !match.actual_result;
    const shouldShowCursor = hasNoResult && isEditable && !scoreValue && isFieldFocused;

    const displayValue = scoreValue || (isEditable ? (isFieldFocused ? '' : '+') : '-');
    const placeholderColor = isEditable ? '#111827' : '#a0aec0';

    return (
      <View
        style={[
          styles.scoreBox,
          isEditable ? styles.scoreBoxEditable : styles.scoreBoxLocked,
          isFieldFocused && isEditable && styles.scoreBoxFocused,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={scoreValue}
          onChangeText={handleChange}
          keyboardType="numeric"
          editable={isEditable}
          maxLength={2}
          onFocus={() => handleFocus(field)}
          onBlur={() => handleBlur(field)}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.visibleButton}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={0.8}
          disabled={!isEditable}
        >
          {shouldShowCursor ? (
            <View style={styles.cursorContainer}>
              <BlinkingCursor />
            </View>
          ) : (
            <Text
              style={[
                styles.scoreInput,
                isEditable ? styles.scoreInputEditable : styles.scoreInputDisabled,
                !scoreValue && { color: placeholderColor },
              ]}
            >
              {displayValue}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, hasPendingChanges && styles.containerPending]}>
      <View style={styles.header}>
        <View style={styles.stageContainer}>
          <Text style={styles.stageText}>{getStageText(match.stage)}</Text>
        </View>
        <View style={styles.timeContainer}>
          <Text style={styles.kickoffText}>{formatDate(match.date)}</Text>
        </View>
        <View style={styles.statusWrapper}>
          <MatchStatusIndicator status={match.status} />
        </View>
      </View>
      
        <View style={styles.matchLayout}>
          {renderTeamColumn('home')}

          <View style={styles.scoreSection}>
            {renderScoreInput('home')}
            <Text
              style={[
                styles.scoreSeparator,
                isEditable ? styles.scoreSeparatorEditable : styles.scoreSeparatorLocked,
              ]}
            >
              {separatorChar}
            </Text>
            {renderScoreInput('away')}
          </View>

          {renderTeamColumn('away')}
        </View>

        <View style={styles.namesRow}>
          {renderTeamName('home')}
          <View style={styles.scoreSpacer} />
          {renderTeamName('away')}
        </View>

        {/* Actual result - below score inputs */}
        <ActualResultDisplay actualResult={match.actual_result} />

      {/* Stats button - bottom left */}
      <TouchableOpacity
        style={styles.statsButton}
        onPress={() => setShowStats(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="stats-chart" size={16} color="#ffffff" />
      </TouchableOpacity>

      {/* Stats Modal */}
      <MatchStatsModal
        visible={showStats}
        matchId={match.id}
        homeTeamName={match.home_team?.name || ''}
        awayTeamName={match.away_team?.name || ''}
        onClose={() => setShowStats(false)}
      />

      {/* Points - bottom right */}
      <PointsDisplay
        userPrediction={match.user_prediction}
        actualResult={match.actual_result}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fafafa',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    minHeight: 145,
    borderWidth: 1,
    borderColor: '#e5e7eb', // Light gray border
  },
  containerPending: {
    borderColor: '#fbbf24',
    borderWidth: 1.5,
    backgroundColor: '#fffbeb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  stageContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stageText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  timeContainer: {
    flex: 1,
    alignItems: 'center',
  },
  kickoffText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  statusWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  matchLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 14,
  },
  teamColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    paddingHorizontal: 8,
  },
  teamFlagWrapper: {
    height: 40,
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
  },
  teamFlagLarge: {
    width: 56,
    height: 40,
    borderRadius: 8,
  },
  teamNameWrapper: {
    width: 90,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 0,
  },
  teamNameHome: {
    marginBottom: 0,
  },
  namesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 0,
    gap: 14,
  },
  scoreSpacer: {
    width: 116,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 116,
  },
  scoreBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scoreBoxEditable: {
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  scoreBoxLocked: {
    borderWidth: 2,
    borderColor: '#a0aec0',
  },
  scoreBoxFocused: {
    borderColor: '#15803d',
    borderWidth: 2.5,
  },
  scoreInput: {
    borderWidth: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  scoreInputEditable: {
    color: '#111827',
  },
  scoreInputDisabled: {
    color: '#a0aec0',
  },
  hiddenInput: {
    position: 'absolute',
    top: -100,
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
  },
  visibleButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreSeparator: {
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  scoreSeparatorEditable: {
    color: '#374151',
  },
  scoreSeparatorLocked: {
    color: '#a0aec0',
  },
  // Status indicator styles
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Actual result display styles
  actualResultContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  actualResultScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  // Stats button - bottom left
  statsButton: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Points display styles - bottom right
  pointsContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 14,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Cursor styles
  cursorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: '#111827',
  },
});
