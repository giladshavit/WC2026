import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Match } from '../services/api';

type ScoreField = 'home' | 'away';

interface MatchCardProps {
  match: Match;
  onScoreChange: (matchId: number, homeScore: number | null, awayScore: number | null) => void;
  hasPendingChanges?: boolean;
  onInputFocus?: (matchId: number) => void;
}

// Component for status indicator
const MatchStatusIndicator = ({ status }: { status: string }) => {
  if (status === 'live_editable' || status === 'live_locked') {
    return (
      <View style={styles.statusContainer}>
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>● לייב</Text>
        </View>
      </View>
    );
  }
  
  return null;
};

// Component for actual result display (below score inputs)
const ActualResultDisplay = ({ actualResult }: { actualResult: any }) => {
  if (!actualResult) return null;
  
  return (
    <View style={styles.actualResultContainer}>
      <Text style={styles.actualResultScore}>
        {actualResult.home_score} - {actualResult.away_score}
      </Text>
    </View>
  );
};

// Component for points display (bottom right)
const PointsDisplay = ({ userPrediction, actualResult }: { userPrediction: any; actualResult: any }) => {
  if (!actualResult) return null;
  
  // If there's no prediction, show 0 points
  const points = userPrediction?.points ?? 0;
  
  const isZeroPoints = points === 0;
  
  return (
    <View style={[styles.pointsContainer, isZeroPoints && styles.pointsContainerZero]}>
      <Text style={styles.pointsText}>{points} נק׳</Text>
    </View>
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
  const originalScoreRef = React.useRef<Record<ScoreField, string | null>>({
    home: null,
    away: null,
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
    handleScoreChange('home', value);

    if (isEditable && value !== '' && awayScore === '') {
      setTimeout(() => {
        awayInputRef.current?.focus();
      }, 250);
    }
  }, [handleScoreChange, isEditable, awayScore]);
 
   const handleAwayInputChange = React.useCallback((value: string) => {
    handleScoreChange('away', value);

    if (isEditable && value !== '' && homeScore === '') {
      setTimeout(() => {
        homeInputRef.current?.focus();
      }, 250);
    }
  }, [handleScoreChange, homeScore, isEditable]);

  const handleFocus = React.useCallback((field: ScoreField) => {
    const isHome = field === 'home';
    const scoreValue = isHome ? homeScore : awayScore;
    const setFocusedState = isHome ? setHomeFocused : setAwayFocused;
    const inputRef = isHome ? homeInputRef : awayInputRef;

    setFocusedState(true);
    onInputFocus?.(match.id);
    originalScoreRef.current[field] = scoreValue;

    
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
  }, [awayScore, handleScoreChange, homeScore]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <Text style={styles.teamName} numberOfLines={2}>
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
          style={[
            styles.scoreInput,
            isEditable ? styles.scoreInputEditable : styles.scoreInputDisabled,
          ]}
          value={scoreValue}
          onChangeText={handleChange}
          placeholder={isEditable ? (isFieldFocused ? '' : '+') : '-'}
          placeholderTextColor={isEditable ? '#111827' : '#a0aec0'}
          keyboardType="numeric"
          editable={isEditable}
          maxLength={2}
          caretHidden
          selectionColor="transparent"
          selectTextOnFocus
          onFocus={() => handleFocus(field)}
          onBlur={() => handleBlur(field)}
        />
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
    backgroundColor: '#f4f6fb',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 145,
    borderWidth: 2,
    borderColor: '#f4f6fb',
  },
  containerPending: {
    borderColor: '#f6ad55',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  namesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 8,
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
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scoreBoxEditable: {
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  scoreBoxLocked: {
    borderWidth: 2,
    borderColor: '#a0aec0',
  },
  scoreBoxFocused: {
    borderColor: '#1f2937',
  },
  scoreInput: {
    width: 42,
    height: 42,
    borderWidth: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreInputEditable: {
    color: '#111827',
  },
  scoreInputDisabled: {
    color: '#a0aec0',
  },
  scoreSeparator: {
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  scoreSeparatorEditable: {
    color: '#1f2937',
  },
  scoreSeparatorLocked: {
    color: '#a0aec0',
  },
  // Status indicator styles
  statusContainer: {
    alignItems: 'center',
  },
  liveIndicator: {
    // No background
  },
  liveText: {
    color: '#FF0000',
    fontSize: 12,
    fontWeight: 'bold',
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
  // Points display styles - bottom right
  pointsContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12, // Match card border radius
  },
  pointsContainerZero: {
    backgroundColor: '#FF9800', // Orange background for 0 points
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 8,
  },
});
