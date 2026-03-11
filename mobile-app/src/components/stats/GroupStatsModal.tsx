import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService, Team } from '../../services/api';

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

  const getRankColor = (rank: number) => {
    if (rank === 4) return '#ef4444'; // red for 4th
    return '#16a34a'; // green for 1st, 2nd, 3rd
  };

  const renderPreResult = () => {
    if (!stats || !stats.consensus_table || !stats.position_distribution) return null;

    return (
      <View>
        <Text style={styles.sectionTitle}>Weighted Consensus Ranking</Text>
        <View style={styles.consensusTableWrapper}>
        {stats.consensus_table.map((entry, idx) => {
          const team = teams.find(t => t.id === entry.team_id);
          const isLastConsensusRow = idx === stats.consensus_table!.length - 1;
          return (
            <View key={entry.team_id} style={[styles.consensusRow, isLastConsensusRow && styles.consensusRowLast]}>
              <View style={[styles.rankBadge, { backgroundColor: getRankColor(entry.rank) }]}>
                <Text style={styles.rankBadgeText}>{entry.rank}</Text>
              </View>
              {team?.flag_url ? (
                <Image source={{ uri: team.flag_url }} style={styles.teamFlag} />
              ) : null}
              <Text style={styles.teamNameText}>{teamName(entry.team_id)}</Text>
            </View>
          );
        })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Position Distribution</Text>
        <View style={styles.consensusTableWrapper}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Team</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { color: '#16a34a' }]}>1st</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { color: '#16a34a' }]}>2nd</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { color: '#16a34a' }]}>3rd</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { color: '#ef4444' }]}>4th</Text>
        </View>
        {Object.entries(stats!.position_distribution!)
          .sort((a, b) => {
            const rankA = stats!.consensus_table?.find(e => String(e.team_id) === a[0])?.rank ?? 99;
            const rankB = stats!.consensus_table?.find(e => String(e.team_id) === b[0])?.rank ?? 99;
            return rankA - rankB;
          })
          .map(([teamIdStr, dist], idx, arr) => {
          const teamId = parseInt(teamIdStr);
          const team = teams.find(t => t.id === teamId) ?? teams.find(t => String(t.id) === teamIdStr);
          const displayName = team?.name ?? `Team ${teamId}`;
          const flagUrl = team?.flag_url;
          const maxPct = Math.max(dist.first_pct, dist.second_pct, dist.third_pct, dist.fourth_pct);
          const pctCells = [
            { key: 'first', pct: dist.first_pct },
            { key: 'second', pct: dist.second_pct },
            { key: 'third', pct: dist.third_pct },
            { key: 'fourth', pct: dist.fourth_pct },
          ];
          const isLastRow = idx === arr.length - 1;
          return (
            <View key={teamIdStr} style={[styles.tableRow, isLastRow && styles.tableRowLast]}>
              <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                {flagUrl ? (
                  <Image source={{ uri: flagUrl }} style={{ width: 20, height: 14, borderRadius: 2 }} />
                ) : null}
                <Text numberOfLines={1} style={{ fontSize: 12, color: '#e2e8f0', flex: 1 }}>{displayName}</Text>
              </View>
              {pctCells.map(({ key, pct }) => (
                <Text
                  key={key}
                  style={[
                    styles.tableCellPct,
                    (pct === maxPct && maxPct > 0) && styles.tableCellPctEmphasized,
                  ]}
                >
                  {pct}%
                </Text>
              ))}
            </View>
          );
        })}
        </View>
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
        {Object.entries(stats.position_accuracy).map(([pos, data]) => {
          const team = teams.find(t => t.name === data.team_name);
          return (
            <View key={pos} style={styles.accuracyRow}>
              <Text style={styles.posLabel}>{positionLabels[pos] || pos}</Text>
              {team?.flag_url ? (
                <Image source={{ uri: team.flag_url }} style={styles.teamFlag} />
              ) : null}
              <Text style={styles.accuracyTeam}>{data.team_name}</Text>
              <Text style={styles.accuracyPct}>{data.correct_pct}%</Text>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>How Many Positions Right?</Text>
        <View style={styles.distContainer}>
          {[
            { n: 0, color: '#fee2e2', textColor: '#dc2626' },  // red - worst
            { n: 1, color: '#ffedd5', textColor: '#ea580c' },  // orange
            { n: 2, color: '#fef9c3', textColor: '#b45309' },   // yellow
            { n: 4, color: '#dcfce7', textColor: '#16a34a' },   // green - best
          ].map(({ n, color, textColor }) => {
            const count = stats.accuracy_distribution![String(n)] || 0;
            return (
              <View key={n} style={[styles.distItem, { backgroundColor: color }]}>
                <Text style={[styles.distCount, { color: textColor }]}>{count}%</Text>
                <Text style={[styles.distLabel, { color: textColor }]}>{n}/4</Text>
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
            <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}>Group {groupName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonWrapper}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <ScrollView
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
            >
              {stats.has_result ? renderPostResult() : renderPreResult()}
            </ScrollView>
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
    width: '90%',
    maxWidth: 380,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#2d4a6e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  closeButtonWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  consensusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
  },
  consensusRowLast: {
    borderBottomWidth: 0,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  rankBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  teamFlag: {
    width: 20,
    height: 14,
    borderRadius: 2,
    marginRight: 8,
  },
  teamNameText: {
    fontSize: 15,
    color: '#e2e8f0',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#2d4a6e',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontWeight: '600',
    color: '#64748b',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  tableCellPct: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
  },
  tableCellPctEmphasized: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
  },
  posLabel: {
    width: 32,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  accuracyTeam: {
    flex: 1,
    fontSize: 14,
    color: '#e2e8f0',
  },
  accuracyPct: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  consensusTableWrapper: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  distContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  distItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  distCount: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1,
  },
  distLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    flexShrink: 1,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
