import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ActivityIndicator, RefreshControl,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/toast/Toast';

interface ProfilePerGroup {
  group_id: number;
  group_name: string;
  correct_positions_count: number | null;
  points: number;
}

interface UserFullProfile {
  total_points: number;
  penalty: number; // API field; displayed as "Fine"
  bonus_score?: number;
  bonus_penalty?: number;
  penalty_breakdown?: {
    groups: number;
    third_place: number;
    knockout: number;
    bonus?: number;
  };
  matches: { score: number; exact: number; correct_outcome: number; wrong: number; pending: number; total_judged: number };
  groups: {
    score: number;
    total_groups: number;
    judged_groups: number;
    per_group: ProfilePerGroup[];
    position_totals: { first: number; second: number; third: number; fourth: number };
    accuracy_distribution: Record<string, number>;
  };
  third_place: {
    score: number;
    has_prediction: boolean;
    result_available: boolean;
    picks: Array<{ group: string; is_correct: boolean | null }>;
    correct_count: number | null;
  };
  knockout: {
    score: number;
    correct_full: number;
    correct_partial: number;
    incorrect: number;
    valid: number;
    invalid: number;
    unreachable: number;
  };
  bonus?: {
    score: number;
    penalty: number;
    correct_count: number;
    incorrect_count: number;
    has_any_judged: boolean;
  };
}

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function getGroupBlockColor(correctPositions: number | null): string {
  if (correctPositions === null) return '#e5e7eb';
  switch (correctPositions) {
    case 4: return '#16a34a';
    case 3: return '#84cc16';
    case 2: return '#f59e0b';
    case 1: return '#f97316';
    case 0: return '#ef4444';
    default: return '#e5e7eb';
  }
}

export default function StatisticsScreen() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { getCurrentUserId } = useAuth();

  const fetchProfile = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const data = await apiService.getUserFullProfile(userId);
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Could not load statistics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCurrentUserId]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  if (loading) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No statistics available yet</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const renderBar = (segments: Array<{ value: number; color: string }>) => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return null;
    return (
      <View style={styles.barContainer}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <View key={i} style={[styles.barSegment, { flex: s.value, backgroundColor: s.color }]}>
            <Text style={styles.barText}>{s.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderStatChip = (color: string, label: string, value: number) => (
    <View key={label} style={styles.statChip}>
      <View style={[styles.statChipDot, { backgroundColor: color }]} />
      <Text style={styles.statChipLabel}>{label}</Text>
      <Text style={styles.statChipValue}>{value}</Text>
    </View>
  );

  const renderDonutChart = (correctFull: number, correctPartial: number, incorrect: number) => {
    const judged = correctFull + correctPartial + incorrect;
    const size = 160;
    const strokeWidth = 18;

    if (judged === 0) {
      return null;
    }

    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    const segments = [
      { value: correctFull, color: '#4CAF50' },
      { value: correctPartial, color: '#FF9800' },
      { value: incorrect, color: '#F44336' },
    ].filter(s => s.value > 0);

    let rotation = -90;
    return (
      <View style={styles.donutWrapper}>
        <View style={{ width: size, height: size, position: 'relative' }}>
          <Svg width={size} height={size}>
            {segments.map((seg, i) => {
              const percent = seg.value / judged;
              const segmentLength = circumference * percent;
              const dashArray = `${segmentLength} ${circumference}`;
              const currentRotation = rotation;
              rotation += percent * 360;
              return (
                <Circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={dashArray}
                  strokeDashoffset={0}
                  transform={`rotate(${currentRotation}, ${center}, ${center})`}
                />
              );
            })}
          </Svg>
          <View style={[styles.donutCenter, { width: size, height: size }]}>
            <Text style={styles.donutCenterCount}>{judged}</Text>
            <Text style={styles.donutCenterLabel}>judged</Text>
          </View>
        </View>
      </View>
    );
  };

  const { matches, groups, third_place, knockout } = profile;
  const bracketPts = groups.score + third_place.score + knockout.score;
  const bonusScore = profile.bonus?.score ?? 0;
  const judgedKnockout = knockout.correct_full + knockout.correct_partial + knockout.incorrect;

  // Total penalty = sum of all breakdown items (groups + third_place + knockout)
  const breakdown = profile.penalty_breakdown;
  const totalPenalty = (breakdown?.groups ?? 0) + (breakdown?.third_place ?? 0) + (breakdown?.knockout ?? 0);

  const perGroupMap = new Map<string, { correct_positions_count: number | null; points: number }>();
  groups.per_group.forEach((g: ProfilePerGroup) => {
    const letter = g.group_name.replace(/^Group\s+/i, '').trim() || g.group_name;
    perGroupMap.set(letter, { correct_positions_count: g.correct_positions_count, points: g.points });
  });

  const groupsArray = GROUP_LETTERS.map((letter) => {
    const data = perGroupMap.get(letter) ?? { correct_positions_count: null, points: 0 };
    return { letter, ...data };
  });
  const orderedGroups = [...groupsArray].sort((a, b) => b.points - a.points);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchProfile(); }}
            tintColor="#16a34a"
          />
        }
      >
        {/* 1. Header card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsValue}>{profile.total_points}</Text>
          <Text style={styles.pointsLabel}>Total Points</Text>
          <View style={styles.pointsDivider} />
          <View style={styles.pointsStatsRow}>
            <View style={styles.pointsStatBlock}>
              <Ionicons name="football-outline" size={20} color="#a7f3d0" />
              <Text style={styles.pointsStatNumber}>{matches.score}</Text>
              <Text style={styles.pointsStatLabel}>Matches</Text>
            </View>
            <View style={styles.pointsStatSeparator} />
            <View style={styles.pointsStatBlock}>
              <Ionicons name="gift-outline" size={20} color="#a7f3d0" />
              <Text style={styles.pointsStatNumber}>{bonusScore}</Text>
              <Text style={styles.pointsStatLabel}>Bonus</Text>
            </View>
            <View style={styles.pointsStatSeparator} />
            <View style={styles.pointsStatBlock}>
              <Ionicons name="trophy-outline" size={20} color="#a7f3d0" />
              <Text style={styles.pointsStatNumber}>{bracketPts}</Text>
              <Text style={styles.pointsStatLabel}>Bracket</Text>
            </View>
            <View style={styles.pointsStatSeparator} />
            <View style={styles.pointsStatBlock}>
              <Ionicons name="warning-outline" size={20} color="#a7f3d0" />
              <Text style={[styles.pointsStatNumber, totalPenalty > 0 && styles.pointsStatNumberFine]}>
                {totalPenalty}
              </Text>
              <Text style={styles.pointsStatLabel}>Fine</Text>
            </View>
          </View>
        </View>

        {/* 2. Match Predictions card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Match Predictions</Text>
            <View style={styles.cardScoreCircle}>
              <Text style={styles.cardScoreCircleText}>{matches.score}</Text>
            </View>
          </View>
          {matches.total_judged > 0 ? (
            <>
              {renderBar([
                { value: matches.exact, color: '#4CAF50' },
                { value: matches.correct_outcome, color: '#FF9800' },
                { value: matches.wrong, color: '#F44336' },
              ])}
              <View style={styles.statChipsRow}>
                {renderStatChip('#4CAF50', 'Exact', matches.exact)}
                {renderStatChip('#FF9800', 'Outcome', matches.correct_outcome)}
                {renderStatChip('#F44336', 'Wrong', matches.wrong)}
              </View>
              <View style={styles.matchesFooter}>
                <Text style={styles.matchesFooterText}>✓ {matches.total_judged} matches played</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No results yet</Text>
          )}
        </View>

        {/* 3. Bonus Predictions card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Bonus Predictions</Text>
            <View style={styles.cardScoreCircle}>
              <Text style={styles.cardScoreCircleText}>{profile.bonus?.score ?? 0}</Text>
            </View>
          </View>
          {!profile.bonus?.has_any_judged ? (
            <Text style={styles.noDataText}>No results yet</Text>
          ) : (
            <View style={styles.bonusResultRow}>
              <View style={[styles.bonusResultChip, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.bonusResultCount, { color: '#16a34a' }]}>
                  ✓ {profile.bonus.correct_count}
                </Text>
                <Text style={[styles.bonusResultLabel, { color: '#16a34a' }]}>correct</Text>
              </View>
              <View style={[styles.bonusResultChip, { backgroundColor: '#fee2e2' }]}>
                <Text style={[styles.bonusResultCount, { color: '#dc2626' }]}>
                  ✗ {profile.bonus.incorrect_count}
                </Text>
                <Text style={[styles.bonusResultLabel, { color: '#dc2626' }]}>wrong</Text>
              </View>
            </View>
          )}
        </View>

        {/* 4. Group Stage + Position Accuracy card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Group Stage</Text>
            <View style={styles.cardScoreCircle}>
              <Text style={styles.cardScoreCircleText}>{groups.score}</Text>
            </View>
          </View>
          {groups.judged_groups > 0 ? (
            <>
              <View style={styles.groupsGrid}>
                {[0, 1, 2].map((rowIdx) => (
                  <View key={rowIdx} style={styles.groupsGridRow}>
                    {orderedGroups.slice(rowIdx * 4, rowIdx * 4 + 4).map(({ letter, correct_positions_count, points }) => (
                      <View
                        key={letter}
                        style={[
                          styles.groupBlock,
                          { backgroundColor: getGroupBlockColor(correct_positions_count) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupBlockLetter,
                            correct_positions_count === null && styles.groupBlockLetterGray,
                          ]}
                        >
                          {letter}
                        </Text>
                        <Text
                          style={[
                            styles.groupBlockPoints,
                            correct_positions_count === null && styles.groupBlockPointsGray,
                          ]}
                        >
                          {points} pts
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>Position Accuracy</Text>
              {[
                { label: '1st', correct: groups.position_totals.first, color: '#16a34a' },
                { label: '2nd', correct: groups.position_totals.second, color: '#22c55e' },
                { label: '3rd', correct: groups.position_totals.third, color: '#84cc16' },
                { label: '4th', correct: groups.position_totals.fourth, color: '#9ca3af' },
              ].map(({ label, correct, color }) => (
                <View key={label} style={styles.positionBarRow}>
                  <Text style={styles.positionBarLabel}>{label}</Text>
                  <View style={styles.positionBarTrack}>
                    <View
                      style={[
                        styles.positionBarFill,
                        {
                          width: `${(correct / groups.judged_groups) * 100}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.positionBarValue}>
                    {correct}/{groups.judged_groups}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.noDataText}>No results yet</Text>
          )}
        </View>

        {/* 5. Third Place card (Bracket) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>3rd Place Picks</Text>
            <View style={styles.cardScoreCircle}>
              <Text style={styles.cardScoreCircleText}>{third_place.score}</Text>
            </View>
          </View>
          {!third_place.has_prediction ? (
            <Text style={styles.noDataText}>No prediction made</Text>
          ) : !third_place.result_available ? (
            <>
              <Text style={[styles.noDataText, { marginBottom: 8 }]}>No results yet</Text>
              <View style={styles.groupsGrid}>
                {[0, 1].map((rowIdx) => (
                  <View key={rowIdx} style={styles.groupsGridRow}>
                    {third_place.picks.slice(rowIdx * 4, rowIdx * 4 + 4).map((p, idx) => (
                      <View
                        key={`${p.group}-${idx}`}
                        style={[styles.groupBlock, { backgroundColor: '#e5e7eb' }]}
                      >
                        <Text style={[styles.groupBlockLetter, { color: '#6b7280' }]}>{p.group}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </>
          ) : !third_place.picks?.length ? (
            <>
              <Text style={styles.noDataText}>No groups selected</Text>
              <View style={styles.thirdPlaceSummary}>
                <Text style={[styles.thirdPlaceSummaryText, { color: '#16a34a' }]}>
                  ✓ {third_place.correct_count ?? 0} correct
                </Text>
                <Text style={[styles.thirdPlaceSummaryText, { color: '#ef4444' }]}>
                  ✗ {8 - (third_place.correct_count ?? 0)} wrong
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.groupsGrid}>
                {[0, 1].map((rowIdx) => (
                  <View key={rowIdx} style={styles.groupsGridRow}>
                    {third_place.picks.slice(rowIdx * 4, rowIdx * 4 + 4).map((p, idx) => (
                      <View
                        key={`${p.group}-${idx}`}
                        style={[
                          styles.groupBlock,
                          {
                            backgroundColor:
                              p.is_correct === true
                                ? '#16a34a'
                                : p.is_correct === false
                                ? '#ef4444'
                                : '#e5e7eb',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupBlockLetter,
                            p.is_correct === null && { color: '#6b7280' },
                          ]}
                        >
                          {p.group}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.thirdPlaceSummary}>
                <Text style={[styles.thirdPlaceSummaryText, { color: '#16a34a' }]}>
                  ✓ {third_place.correct_count ?? 0} correct
                </Text>
                <Text style={[styles.thirdPlaceSummaryText, { color: '#ef4444' }]}>
                  ✗ {8 - (third_place.correct_count ?? 0)} wrong
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 6. Knockout card (Bracket) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Knockout</Text>
            <View style={styles.cardScoreCircle}>
              <Text style={styles.cardScoreCircleText}>{knockout.score}</Text>
            </View>
          </View>
          {judgedKnockout === 0 ? (
            <Text style={styles.noDataText}>No results yet</Text>
          ) : (
            <>
              {renderDonutChart(knockout.correct_full, knockout.correct_partial, knockout.incorrect)}
              <View style={styles.knockoutLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.legendLabel}>Full</Text>
                  <Text style={styles.legendCount}>{knockout.correct_full}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.legendLabel}>Partial</Text>
                  <Text style={styles.legendCount}>{knockout.correct_partial}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                  <Text style={styles.legendLabel}>Wrong</Text>
                  <Text style={styles.legendCount}>{knockout.incorrect}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 7. Fine Breakdown card */}
        <View style={[styles.card, styles.cardLast]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Fines</Text>
            <View style={styles.cardScoreCircleRed}>
              <Text style={styles.cardScoreCircleText}>
                {totalPenalty}
              </Text>
            </View>
          </View>
          {(() => {
            const breakdown = profile.penalty_breakdown;
            const groups   = breakdown?.groups      ?? 0;
            const thirdPl  = breakdown?.third_place ?? 0;
            const knockout = breakdown?.knockout    ?? 0;
            const bonus    = breakdown?.bonus       ?? 0;
            const total    = groups + thirdPl + knockout + bonus;

            const allSegments = [
              { value: groups,   color: '#f59e0b', label: 'Groups' },
              { value: thirdPl,  color: '#f97316', label: 'Third Place' },
              { value: knockout, color: '#92400e', label: 'Knockout' },
            ];

            const size = 160;
            const center = size / 2;
            const radius = size / 2 - 4;

            const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
            const getArcPath = (startAngle: number, endAngle: number) => {
              const startRad = toRad(startAngle);
              const endRad = toRad(endAngle);
              const x1 = center + radius * Math.cos(startRad);
              const y1 = center + radius * Math.sin(startRad);
              const x2 = center + radius * Math.cos(endRad);
              const y2 = center + radius * Math.sin(endRad);
              const largeArc = endAngle - startAngle > 180 ? 1 : 0;
              return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
            };

            const segmentsWithValue = allSegments.filter(s => s.value > 0);
            let currentAngle = 0;

            return (
              <View style={styles.fineDonutWrapper}>
                {total > 0 && (
                  <View style={{ width: size, height: size, position: 'relative' }}>
                    <Svg width={size} height={size}>
                      {segmentsWithValue.length === 1 ? (
                        <Circle
                          cx={center}
                          cy={center}
                          r={radius}
                          fill={segmentsWithValue[0].color}
                        />
                      ) : (
                        segmentsWithValue.map((seg, i) => {
                          const percent = seg.value / total;
                          const angle = percent * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          return (
                            <Path
                              key={i}
                              d={getArcPath(startAngle, currentAngle)}
                              fill={seg.color}
                            />
                          );
                        })
                      )}
                    </Svg>
                    {segmentsWithValue.length === 1 && (
                      <View style={[styles.donutCenter, { width: size, height: size }]}>
                        <Text style={[styles.donutCenterCount, { color: '#fff' }]}>
                          {segmentsWithValue[0].value}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {total > 0 && (
                  <View style={styles.fineLegendChips}>
                    {allSegments.map(({ label, value, color }) => (
                      <View key={label} style={[styles.fineChip, { backgroundColor: color + '18' }]}>
                        <View style={[styles.statChipDot, { backgroundColor: color, marginRight: 0 }]} />
                        <Text style={[styles.fineChipLabel, { color }]}>{label}</Text>
                        <Text style={[styles.fineChipValue, { color }]}>{value}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {total === 0 && (
                  <Text style={[styles.noDataText, { textAlign: 'center', marginTop: 16 }]}>
                    No fines yet
                  </Text>
                )}
              </View>
            );
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1e293b' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  emptyText: { fontSize: 16, color: '#9ca3af' },

  pointsCard: {
    backgroundColor: '#166534', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  pointsValue: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  pointsLabel: { fontSize: 14, color: '#d1fae5', marginTop: 4 },
  pointsDivider: {
    width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14,
  },
  pointsStatsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
  },
  pointsStatBlock: {
    flex: 1, alignItems: 'center',
  },
  pointsStatSeparator: {
    width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pointsStatNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  pointsStatNumberFine: { color: '#fecaca' },
  pointsStatLabel: { fontSize: 11, color: '#a7f3d0', marginTop: 2 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardLast: { marginBottom: 32 },
  bonusResultRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  bonusResultChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  bonusResultCount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  bonusResultLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  fineDonutWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  fineLegendChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 20,
    flexWrap: 'wrap',
  },
  fineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  fineChipLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  fineChipValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  cardScoreCircle: {
    width: 33, height: 33, borderRadius: 22,
    backgroundColor: '#15803d', justifyContent: 'center', alignItems: 'center',
  },
  cardScoreCircleRed: {
    width: 33, height: 33, borderRadius: 22,
    backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center',
  },
  cardScoreCircleText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  barContainer: {
    flexDirection: 'row', height: 32, borderRadius: 10, overflow: 'hidden', marginBottom: 8,
  },
  barSegment: { justifyContent: 'center', alignItems: 'center', minWidth: 24 },
  barText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },

  statChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  statChipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statChipLabel: { fontSize: 13, color: '#6b7280', marginRight: 4 },
  statChipValue: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },

  matchesFooter: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, marginTop: 4,
  },
  matchesFooterText: { fontSize: 13, color: '#9ca3af' },

  groupsGrid: { gap: 8, alignItems: 'center' },
  groupsGridRow: {
    flexDirection: 'row', gap: 8, marginBottom: 8, justifyContent: 'center', alignSelf: 'center',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
    width: '100%',
  },
  groupBlock: {
    flex: 1, aspectRatio: 1, maxWidth: 72, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  groupBlockLetter: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  groupBlockLetterGray: { color: '#6b7280' },
  groupBlockPoints: { fontSize: 9, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  groupBlockPointsGray: { color: '#9ca3af' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  positionBarRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  positionBarLabel: { fontSize: 13, fontWeight: '600', color: '#374151', width: 36 },
  positionBarTrack: {
    flex: 1, height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', marginHorizontal: 8,
  },
  positionBarFill: { height: '100%', borderRadius: 5 },
  positionBarValue: { fontSize: 12, fontWeight: '600', color: '#6b7280', width: 36, textAlign: 'right' },
  noDataText: { fontSize: 14, color: '#9ca3af' },

  thirdPlaceSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  thirdPlaceSummary: {
    flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12,
  },
  thirdPlaceSummaryText: { fontSize: 14, fontWeight: '600' },

  donutWrapper: { alignItems: 'center', marginVertical: 12 },
  donutCenter: {
    position: 'absolute', top: 0, left: 0, justifyContent: 'center', alignItems: 'center',
  },
  donutCenterCount: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  donutCenterLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  donutPlaceholder: {
    justifyContent: 'center', alignItems: 'center',
  },
  donutPlaceholderText: { fontSize: 14, color: '#9ca3af' },
  knockoutLegend: {
    flexDirection: 'row', justifyContent: 'center', gap: 20, flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { fontSize: 13, color: '#6b7280', marginRight: 4 },
  legendCount: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
});
