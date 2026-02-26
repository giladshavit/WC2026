import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { apiService, KnockoutStats } from '../services/api';

interface Props {
  visible: boolean;
  templateMatchId: number | null;
  onClose: () => void;
}

export default function KnockoutStatsModal({ visible, templateMatchId, onClose }: Props) {
  const [stats, setStats] = useState<KnockoutStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && templateMatchId) {
      fetchStats();
    } else {
      setStats(null);
      setError(null);
    }
  }, [visible, templateMatchId]);

  const fetchStats = async () => {
    if (!templateMatchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getKnockoutMatchStats(templateMatchId);
      setStats(data);
    } catch (e) {
      setError('Could not load statistics');
    } finally {
      setLoading(false);
    }
  };

  const renderPreResult = () => {
    if (!stats || !stats.top_matchups) return null;

    return (
      <View>
        <Text style={styles.sectionTitle}>Most Popular Matchups</Text>
        {stats.top_matchups.map((matchup, index) => (
          <View key={index} style={styles.matchupCard}>
            <View style={styles.matchupHeader}>
              <Text style={styles.matchupTeams}>
                {matchup.team_a.name} vs {matchup.team_b.name}
              </Text>
              <Text style={styles.matchupPct}>{matchup.matchup_pct}%</Text>
            </View>
            <View style={styles.winnerBar}>
              <View style={[styles.winnerSegmentA, { flex: matchup.team_a_winner_pct || 1 }]}>
                <Text style={styles.winnerBarText}>{matchup.team_a_winner_pct}%</Text>
              </View>
              <View style={[styles.winnerSegmentB, { flex: matchup.team_b_winner_pct || 1 }]}>
                <Text style={styles.winnerBarText}>{matchup.team_b_winner_pct}%</Text>
              </View>
            </View>
            <View style={styles.winnerLabels}>
              <Text style={styles.winnerLabelA}>{matchup.team_a.name}</Text>
              <Text style={styles.winnerLabelB}>{matchup.team_b.name}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats) return null;

    const items = [
      { label: 'Exact winner', pct: stats.exact_winner_pct || 0, color: '#16a34a' },
      { label: 'Winner via other match', pct: stats.partial_winner_pct || 0, color: '#f59e0b' },
      { label: 'Correct matchup', pct: stats.correct_matchup_pct || 0, color: '#3b82f6' },
    ];

    return (
      <View>
        <Text style={styles.sectionTitle}>Prediction Accuracy</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.accuracyRow}>
            <Text style={styles.accuracyLabel}>{item.label}</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.bar, { width: `${Math.max(item.pct, 2)}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.accuracyPct}>{item.pct}%</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Match Statistics</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <View>
              <Text style={styles.totalText}>{stats.total_predictions} predictions</Text>
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
    width: '90%',
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
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
  },
  matchupCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  matchupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  matchupTeams: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  matchupPct: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  winnerBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  winnerSegmentA: {
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerSegmentB: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerBarText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  winnerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  winnerLabelA: {
    fontSize: 10,
    color: '#16a34a',
  },
  winnerLabelB: {
    fontSize: 10,
    color: '#3b82f6',
    textAlign: 'right',
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accuracyLabel: {
    width: 110,
    fontSize: 12,
    color: '#374151',
  },
  barWrapper: {
    flex: 1,
    height: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  accuracyPct: {
    width: 42,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
