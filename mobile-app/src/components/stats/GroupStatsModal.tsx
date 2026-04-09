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
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
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
  teams_info?: Record<string, { name: string; short_name: string | null }>;
}

interface Props {
  visible: boolean;
  groupId: number | null;
  groupName: string;
  teams: Team[];
  onClose: () => void;
}

const DONUT_SEGMENTS = [
  { key: '0', label: '0', color: '#ef4444' },
  { key: '1', label: '1', color: '#f97316' },
  { key: '2', label: '2', color: '#eab308' },
  { key: '4', label: '4', color: '#16a34a' },
];

const HEATMAP_BASE = '#16a34a';

/** Position column headers: 1st/2nd advance (green), 3rd uncertain (orange), 4th out (red). */
const HEATMAP_POSITION_HEADER_COLORS = ['#16a34a', '#16a34a', '#f97316', '#ef4444'] as const;

/** Same curve as BonusScreen renderMiniPill; maxPct is max across entire heatmap table. */
const heatmapCellOpacity = (pct: number, maxPct: number) =>
  maxPct > 0 ? 0.12 + Math.pow(pct / maxPct, 1.6) * 0.88 : 0.12;

const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

function DonutChart({ distribution }: { distribution: Record<string, number> }) {
  const size = 160;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const total = DONUT_SEGMENTS.reduce((sum, s) => sum + (distribution[s.key] || 0), 0);

  // Build segments with strokeDashoffset
  let cumulativePct = 0;
  const segments = DONUT_SEGMENTS.map((s) => {
    const pct = total > 0 ? (distribution[s.key] || 0) / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    // Rotate so segment starts at cumulative position (-90deg = top)
    const rotation = -90 + cumulativePct * 360;
    cumulativePct += pct;
    return { ...s, pct, dash, gap, rotation };
  });

  return (
    <View style={styles.donutWrapper}>
      {/* Donut SVG */}
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="#1e3a5f"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Colored segments */}
        {segments.map((seg) =>
          seg.pct > 0 ? (
            <G key={seg.key} transform={`rotate(${seg.rotation} ${cx} ${cy})`}>
              <Circle
                cx={cx} cy={cy} r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${seg.dash} ${seg.gap}`}
                strokeLinecap="butt"
              />
            </G>
          ) : null
        )}
        {/* Center label */}
        <SvgText
          x={cx} y={cy - 8}
          textAnchor="middle"
          fontSize="11"
          fill="#94a3b8"
          fontWeight="500"
        >
          correct
        </SvgText>
        <SvgText
          x={cx} y={cy + 10}
          textAnchor="middle"
          fontSize="11"
          fill="#94a3b8"
          fontWeight="500"
        >
          positions
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={styles.donutLegend}>
        {DONUT_SEGMENTS.map((s) => {
          const pct = distribution[s.key] || 0;
          return (
            <View key={s.key} style={styles.donutLegendRow}>
              <View style={[styles.donutLegendDot, { backgroundColor: s.color }]} />
              <Text style={styles.donutLegendLabel}>{s.label}/4</Text>
              <Text style={[styles.donutLegendPct, { color: s.color }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
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
    if (rank === 1 || rank === 2) return '#16a34a';
    if (rank === 3) return '#f97316'; // orange — not guaranteed to advance
    return '#ef4444';
  };

  const renderPreResult = () => {
    if (!stats || !stats.consensus_table || !stats.position_distribution) return null;

    const pd = stats.position_distribution;
    const maxHeatmapPct = Math.max(
      0,
      ...Object.values(pd).flatMap((d) => [d.first_pct, d.second_pct, d.third_pct, d.fourth_pct]),
    );

    return (
      <View>
        <Text style={styles.sectionTitle}>Predicted Standings</Text>
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
        <View style={styles.heatmapHeaderRow}>
          <Text style={[styles.heatmapHeaderCell, styles.heatmapTeamHeader]}>Team</Text>
          {(['1st', '2nd', '3rd', '4th'] as const).map((label, i) => (
            <Text
              key={label}
              style={[
                styles.heatmapHeaderCell,
                styles.heatmapPositionHeader,
                { color: HEATMAP_POSITION_HEADER_COLORS[i] },
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
        {Object.entries(pd)
          .sort((a, b) => {
            const rankA = stats.consensus_table?.find(e => String(e.team_id) === a[0])?.rank ?? 99;
            const rankB = stats.consensus_table?.find(e => String(e.team_id) === b[0])?.rank ?? 99;
            return rankA - rankB;
          })
          .map(([teamIdStr, dist]) => {
          const teamId = parseInt(teamIdStr);
          const team = teams.find(t => t.id === teamId) ?? teams.find(t => String(t.id) === teamIdStr);
          const statsTeamInfo = stats.teams_info?.[teamIdStr];
          const displayName = statsTeamInfo?.short_name ?? team?.name ?? `Team ${teamId}`;
          const flagUrl = team?.flag_url;
          const pctCells = [
            { key: 'first', pct: dist.first_pct },
            { key: 'second', pct: dist.second_pct },
            { key: 'third', pct: dist.third_pct },
            { key: 'fourth', pct: dist.fourth_pct },
          ];
          return (
            <View key={teamIdStr} style={styles.heatmapRow}>
              <View style={styles.heatmapTeamCell}>
                {flagUrl ? (
                  <Image
                    source={{ uri: flagUrl }}
                    style={styles.heatmapTeamFlag}
                  />
                ) : null}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.45}
                  style={styles.heatmapTeamText}
                >
                  {displayName}
                </Text>
              </View>
              {pctCells.map(({ key, pct }) => {
                const alpha = heatmapCellOpacity(pct, maxHeatmapPct);
                return (
                  <View
                    key={key}
                    style={[
                      styles.heatmapCell,
                      { backgroundColor: hexToRgba(HEATMAP_BASE, alpha) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heatmapCellText,
                        { color: pct < 15 ? 'rgba(255,255,255,0.5)' : '#ffffff' },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                      maxFontSizeMultiplier={1}
                    >
                      {pct}%
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
        </View>
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats || !stats.position_accuracy || !stats.accuracy_distribution) return null;

    const positionNumbers: Record<string, number> = {
      first_place: 1,
      second_place: 2,
      third_place: 3,
      fourth_place: 4,
    };
    return (
      <View>
        <Text style={styles.sectionTitle}>Who Got It Right?</Text>
        {Object.entries(stats.position_accuracy).map(([pos, data]) => {
          const team = teams.find(t => t.name === data.team_name);
          const n = positionNumbers[pos] ?? 0;
          const badgeBg = '#6b7280';
          return (
            <View key={pos} style={styles.accuracyRow}>
              <View style={[styles.accuracyPositionBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.accuracyPositionText}>{n}</Text>
              </View>
              {team?.flag_url ? (
                <Image source={{ uri: team.flag_url }} style={styles.teamFlag} />
              ) : null}
              <Text style={styles.accuracyTeam}>{data.team_name}</Text>
              <Text style={styles.accuracyPct} numberOfLines={1} maxFontSizeMultiplier={1.2}>{data.correct_pct}%</Text>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Correct Positions out of 4</Text>
        <DonutChart distribution={stats.accuracy_distribution!} />
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
              style={{ maxHeight: 520 }}
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
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#2d4a6e',
    paddingBottom: 6,
    marginBottom: 4,
  },
  heatmapHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  heatmapTeamHeader: {
    flex: 2,
    color: '#64748b',
    textAlign: 'left',
    paddingLeft: 4,
  },
  heatmapPositionHeader: {
    flex: 1,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  heatmapTeamCell: {
    flex: 2,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
    paddingLeft: 4,
    minHeight: 36,
    minWidth: 0,
    overflow: 'hidden',
  },
  heatmapTeamFlag: {
    width: 20,
    height: 14,
    borderRadius: 2,
    flexShrink: 0,
  },
  heatmapTeamText: {
    fontSize: 12,
    color: '#e2e8f0',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  heatmapCell: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
    borderRadius: 4,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  heatmapCellText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
  },
  accuracyPositionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  accuracyPositionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
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
  donutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    gap: 20,
  },
  donutLegend: {
    gap: 10,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donutLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  donutLegendLabel: {
    fontSize: 13,
    color: '#94a3b8',
    width: 28,
  },
  donutLegendPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
});
