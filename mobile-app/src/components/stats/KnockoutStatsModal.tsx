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
import { apiService, KnockoutStats } from '../../services/api';

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
            <Text style={styles.matchupSubtitle}>
              <Text style={styles.matchupPctHighlight}>{matchup.matchup_pct}%</Text>
              {' of predictions'}
            </Text>
            <View style={styles.teamsRow}>
              <View style={styles.teamColumn}>
                {matchup.team_a.flag_url ? (
                  <Image source={{ uri: matchup.team_a.flag_url }} style={styles.teamFlag} />
                ) : (
                  <View style={styles.teamFlagPlaceholder} />
                )}
                <Text style={styles.teamNameInCard} numberOfLines={2}>{matchup.team_a.name}</Text>
              </View>
              <Text style={styles.vsLabel}>vs</Text>
              <View style={styles.teamColumn}>
                {matchup.team_b.flag_url ? (
                  <Image source={{ uri: matchup.team_b.flag_url }} style={styles.teamFlag} />
                ) : (
                  <View style={styles.teamFlagPlaceholder} />
                )}
                <Text style={styles.teamNameInCard} numberOfLines={2}>{matchup.team_b.name}</Text>
              </View>
            </View>
            <View style={styles.winnerBar}>
              {(matchup.team_a_winner_pct ?? 0) > 0 && (
                <View style={[styles.winnerSegmentA, { flex: matchup.team_a_winner_pct }]}>
                  <Text style={styles.winnerBarText}>{matchup.team_a_winner_pct}%</Text>
                </View>
              )}
              {(matchup.team_b_winner_pct ?? 0) > 0 && (
                <View style={[styles.winnerSegmentB, { flex: matchup.team_b_winner_pct }]}>
                  <Text style={styles.winnerBarText}>{matchup.team_b_winner_pct}%</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats) return null;

    const items = [
      {
        icon: 'trophy-outline' as const,
        iconColor: '#16a34a',
        bgColor: 'rgba(22,163,74,0.12)',
        pct: stats.exact_winner_pct || 0,
        barColor: '#16a34a',
        labelParts: [
          { type: 'flag' as const, value: stats.winner_flag || '' },
          { type: 'text' as const, value: 'exact winner' },
        ],
      },
      {
        icon: 'shuffle-outline' as const,
        iconColor: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.12)',
        pct: stats.partial_winner_pct || 0,
        barColor: '#f59e0b',
        labelParts: [
          { type: 'flag' as const, value: stats.winner_flag || '' },
          { type: 'text' as const, value: 'winner from different match' },
        ],
      },
      {
        icon: 'people-outline' as const,
        iconColor: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.12)',
        pct: stats.correct_matchup_pct || 0,
        barColor: '#3b82f6',
        labelParts: [
          { type: 'flag' as const, value: stats.team1_flag || '' },
          { type: 'text' as const, value: 'vs' },
          { type: 'flag' as const, value: stats.team2_flag || '' },
          { type: 'text' as const, value: 'exact matchup' },
        ],
      },
    ];

    return (
      <View>
        {/* Winner banner */}
        {(stats.winner_name || stats.winner_flag) && (
          <View style={styles.winnerBanner}>
            {stats.winner_flag && (
              <Image source={{ uri: stats.winner_flag }} style={styles.winnerFlag} />
            )}
            <View>
              <Text style={styles.winnerLabel}>Match Winner</Text>
              <Text style={styles.winnerName}>{stats.winner_name || ''}</Text>
            </View>
          </View>
        )}

        {/* Stat cards */}
        {items.map((item, i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: item.bgColor }]}>
            <View style={styles.statCardHeader}>
              <Ionicons name={item.icon} size={18} color={item.iconColor} />
              <View style={styles.statLabelRow}>
                {item.labelParts.map((part, j) =>
                  part.type === 'text'
                    ? <Text key={j} style={styles.statCardLabel} numberOfLines={1}>{part.value}</Text>
                    : part.value ? <Image key={j} source={{ uri: part.value }} style={styles.inlineFlag} /> : null
                )}
              </View>
              <Text style={[styles.statCardPct, { color: item.iconColor }]}>{item.pct}%</Text>
            </View>
            <View style={styles.statBarWrapper}>
              <View style={[styles.statBar, { width: `${Math.max(item.pct, 2)}%`, backgroundColor: item.barColor }]} />
            </View>
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
            <Text style={styles.modalTitle}>Knockout Match Statistics</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonWrapper}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  closeButtonWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  matchupCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d4a6e',
  },
  matchupSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  matchupPctHighlight: {
    fontWeight: '800',
    fontSize: 14,
    color: '#ffffff',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  vsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 4,
  },
  teamFlagPlaceholder: {
    width: 40,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginBottom: 4,
  },
  teamFlag: {
    width: 40,
    height: 28,
    borderRadius: 4,
    marginBottom: 4,
  },
  teamNameInCard: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  winnerBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  winnerSegmentA: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerSegmentB: {
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerBarText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  winnerFlag: {
    width: 44,
    height: 32,
    borderRadius: 4,
  },
  winnerLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  winnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  statCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    gap: 4,
  },
  statCardLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  inlineFlag: {
    width: 22,
    height: 16,
    borderRadius: 2,
  },
  statCardPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  statBarWrapper: {
    height: 6,
    backgroundColor: '#0f172a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    borderRadius: 3,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
