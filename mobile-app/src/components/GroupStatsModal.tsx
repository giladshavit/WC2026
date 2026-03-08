import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { apiService, Team } from '../services/api';

interface GroupStats {
  total_predictions: number;
  has_result: boolean;
  consensus_table?: Array<{ team_id: number; rank: number }>;
  position_distribution?: Record<string, {
    first_pct: number;
    second_pct: number;
    third_pct: number;
    fourth_pct: number;
  }>;
  position_accuracy?: Record<string, { team_name: string; correct_pct: number }>;
  accuracy_distribution?: Record<string, number>;
}

interface Props {
  visible: boolean;
  groupId: number | null;
  groupName: string;
  teams: Team[];
  onClose: () => void;
}

export default function GroupStatsModal({ visible, groupId, groupName, teams, onClose }: Props) {
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && groupId) {
      fetchStats();
    } else {
      setStats(null);
      setError(null);
    }
  }, [visible, groupId]);

  const fetchStats = async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getGroupStats(groupId);
      setStats(data);
    } catch (e) {
      setError('Could not load statistics');
    } finally {
      setLoading(false);
    }
  };

  const teamName = (id: number): string => {
    return teams.find(t => t.id === id)?.name || 'Unknown';
  };

  const renderPreResult = () => {
    if (!stats || !stats.consensus_table || !stats.position_distribution) return null;

    return (
      <View>
        <Text style={styles.sectionTitle}>Consensus Ranking</Text>
        {stats.consensus_table.map((entry) => (
          <View key={entry.team_id} style={styles.consensusRow}>
            <Text style={styles.rankBadge}>{entry.rank}</Text>
            <Text style={styles.teamNameText}>{teamName(entry.team_id)}</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Position Distribution</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Team</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>1st</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>2nd</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>3rd</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>4th</Text>
        </View>
        {stats.consensus_table.map((entry) => {
          const dist = stats.position_distribution![String(entry.team_id)];
          if (!dist) return null;
          return (
            <View key={entry.team_id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                {teamName(entry.team_id)}
              </Text>
              <Text style={styles.tableCell}>{dist.first_pct}%</Text>
              <Text style={styles.tableCell}>{dist.second_pct}%</Text>
              <Text style={styles.tableCell}>{dist.third_pct}%</Text>
              <Text style={styles.tableCell}>{dist.fourth_pct}%</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats || !stats.position_accuracy || !stats.accuracy_distribution) return null;

    const positionLabels: Record<string, string> = {
      first_place: '1st',
      second_place: '2nd',
      third_place: '3rd',
      fourth_place: '4th',
    };

    return (
      <View>
        <Text style={styles.sectionTitle}>Who Got It Right?</Text>
        {Object.entries(stats.position_accuracy).map(([pos, data]) => (
          <View key={pos} style={styles.accuracyRow}>
            <Text style={styles.posLabel}>{positionLabels[pos] || pos}</Text>
            <Text style={styles.accuracyTeam}>{data.team_name}</Text>
            <Text style={styles.accuracyPct}>{data.correct_pct}%</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>How Many Positions Right?</Text>
        <View style={styles.distContainer}>
          {[0, 1, 2, 3, 4].map((n) => {
            const count = stats.accuracy_distribution![String(n)] || 0;
            return (
              <View key={n} style={styles.distItem}>
                <Text style={styles.distCount}>{count}</Text>
                <Text style={styles.distLabel}>{n}/4</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Group {groupName}</Text>
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
    maxHeight: '80%',
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
  consensusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 10,
    overflow: 'hidden',
  },
  teamNameText: {
    fontSize: 15,
    color: '#1f2937',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontWeight: '600',
    color: '#6b7280',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  posLabel: {
    width: 32,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  accuracyTeam: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  accuracyPct: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  distContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  distItem: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    minWidth: 48,
  },
  distCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  distLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
