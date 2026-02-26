import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { apiService, MatchStats } from '../services/api';

interface Props {
  visible: boolean;
  matchId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
}

export default function MatchStatsModal({ visible, matchId, homeTeamName, awayTeamName, onClose }: Props) {
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
        <Text style={styles.sectionTitle}>Winner Predictions</Text>

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

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>{homeTeamName}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9E9E9E' }]} />
            <Text style={styles.legendText}>Draw</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>{awayTeamName}</Text>
          </View>
        </View>

        {/* Popular scores */}
        {stats.popular_scores && stats.popular_scores.length > 0 && (
          <View style={styles.scoresSection}>
            <Text style={styles.sectionTitle}>Popular Predictions</Text>
            {stats.popular_scores.map((score, index) => (
              <View key={index} style={styles.scoreRow}>
                <Text style={styles.scoreText}>
                  {score.home} - {score.away}
                </Text>
                <Text style={styles.scoreCount}>
                  {score.count} {score.count === 1 ? 'prediction' : 'predictions'}
                </Text>
              </View>
            ))}
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
        <Text style={styles.sectionTitle}>Prediction Accuracy</Text>

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
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Exact ({exact_pct}%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>Correct ({correct_pct}%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Wrong ({wrong_pct}%)</Text>
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
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <View>
              <Text style={styles.totalText}>
                {stats.total_predictions} predictions
              </Text>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 350,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  closeButton: {
    fontSize: 20,
    color: '#9ca3af',
    paddingLeft: 12,
  },
  totalText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
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
  barHome: { backgroundColor: '#4CAF50' },
  barDraw: { backgroundColor: '#9E9E9E' },
  barAway: { backgroundColor: '#2196F3' },
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
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6b7280',
  },
  // Popular scores
  scoresSection: {
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  scoreCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
