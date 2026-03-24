import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { apiService, MatchStats } from '../../services/api';

const flagUrl = (code: string) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

interface Props {
  visible: boolean;
  matchId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamFlagCode?: string;
  awayTeamFlagCode?: string;
  onClose: () => void;
}

export default function MatchStatsModal({ visible, matchId, homeTeamName, awayTeamName, homeTeamFlagCode, awayTeamFlagCode, onClose }: Props) {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && matchId) {
      fetchStats();
    } else {
      setStats(null);
      setError(null);
    }
  }, [visible, matchId]);

  const fetchStats = async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMatchStats(matchId);
      setStats(data);
    } catch (e) {
      setError('Could not load statistics');
    } finally {
      setLoading(false);
    }
  };

  const renderPreResult = () => {
    if (!stats || !stats.winner_distribution) return null;
    const { home_pct, draw_pct, away_pct } = stats.winner_distribution;

    return (
      <View>
        <Text style={styles.sectionLabel}>Who Will Win?</Text>

        {/* Horizontal bar showing distribution */}
        <View style={styles.barContainer}>
          {home_pct > 0 && (
            <View style={[styles.barSegment, styles.barHome, { flex: home_pct }]}>
              <Text style={styles.barText}>{home_pct}%</Text>
            </View>
          )}
          {draw_pct > 0 && (
            <View style={[styles.barSegment, styles.barDraw, { flex: draw_pct }]}>
              <Text style={styles.barText}>{draw_pct}%</Text>
            </View>
          )}
          {away_pct > 0 && (
            <View style={[styles.barSegment, styles.barAway, { flex: away_pct }]}>
              <Text style={styles.barText}>{away_pct}%</Text>
            </View>
          )}
        </View>

        {/* Legend: colored dot + flag for home/away, dot + "Draw" for draw */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            {homeTeamFlagCode ? (
              <Image source={{ uri: flagUrl(homeTeamFlagCode) }} style={styles.flagImage} />
            ) : null}
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} />
            <Text style={styles.legendDrawText}>Draw</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
            {awayTeamFlagCode ? (
              <Image source={{ uri: flagUrl(awayTeamFlagCode) }} style={styles.flagImage} />
            ) : null}
          </View>
        </View>

        {/* Popular scores - Top Scores cards */}
        {stats.popular_scores && stats.popular_scores.length > 0 && (
          <View style={styles.sectionWithDivider}>
            <Text style={styles.sectionLabel}>Top Scores</Text>
            <View style={styles.popularRow}>
              {stats.popular_scores.slice(0, 3).map((score, index) => (
                <View key={index} style={styles.popularCard}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreHome}>{score.home}</Text>
                    <Text style={styles.scoreSep}> – </Text>
                    <Text style={styles.scoreAway}>{score.away}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats || !stats.accuracy) return null;
    const { exact_pct, correct_pct, wrong_pct } = stats.accuracy;

    return (
      <View>
        <Text style={styles.sectionLabel}>Prediction Accuracy</Text>

        {/* Horizontal bar */}
        <View style={styles.barContainer}>
          {exact_pct > 0 && (
            <View style={[styles.barSegment, styles.barExact, { flex: exact_pct }]}>
              <Text style={styles.barText}>{exact_pct}%</Text>
            </View>
          )}
          {correct_pct > 0 && (
            <View style={[styles.barSegment, styles.barCorrect, { flex: correct_pct }]}>
              <Text style={styles.barText}>{correct_pct}%</Text>
            </View>
          )}
          {wrong_pct > 0 && (
            <View style={[styles.barSegment, styles.barWrong, { flex: wrong_pct }]}>
              <Text style={styles.barText}>{wrong_pct}%</Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.postLegendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.postLegendText}>Exact</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.postLegendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.postLegendText}>Correct</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.postLegendDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.postLegendText}>Wrong</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {homeTeamName} vs {awayTeamName}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonTouch}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <View>
              {stats.has_result ? renderPostResult() : renderPreResult()}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: '#2d4a6e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    flex: 1,
  },
  closeButtonTouch: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionWithDivider: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
    paddingTop: 12,
  },
  // Horizontal stacked bar
  barContainer: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 30,
  },
  barText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  barHome: { backgroundColor: '#f97316' },
  barDraw: { backgroundColor: '#9ca3af' },
  barAway: { backgroundColor: '#2563eb' },
  barExact: { backgroundColor: '#4CAF50' },
  barCorrect: { backgroundColor: '#FF9800' },
  barWrong: { backgroundColor: '#F44336' },
  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendDrawText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  flagImage: {
    width: 22,
    height: 15,
    borderRadius: 2,
    marginRight: 4,
  },
  postLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  postLegendText: {
    fontSize: 11,
    color: '#6b7280',
  },
  popularRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  popularCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreHome: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f97316',
  },
  scoreSep: {
    fontSize: 20,
    fontWeight: '400',
    color: '#9ca3af',
  },
  scoreAway: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563eb',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
