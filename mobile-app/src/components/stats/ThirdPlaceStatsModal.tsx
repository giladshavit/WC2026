import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService, ThirdPlaceStats } from '../../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ThirdPlaceStatsModal({ visible, onClose }: Props) {
  const [stats, setStats] = useState<ThirdPlaceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortByPct, setSortByPct] = useState(true);

  useEffect(() => {
    if (visible) {
      setSortByPct(true);
      fetchStats();
    } else {
      setStats(null);
      setError(null);
    }
  }, [visible]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getThirdPlaceStats();
      setStats(data);
    } catch (e) {
      setError('Could not load statistics');
    } finally {
      setLoading(false);
    }
  };

  const renderPreResult = () => {
    if (!stats || !stats.group_pick_pct) return null;

    const allEntries = Object.entries(stats.group_pick_pct);

    const sortedByPct = [...allEntries].sort((a, b) => b[1] - a[1]);
    const getRowColor = (group: string): string => {
      const rank = sortedByPct.findIndex(([g]) => g === group);
      return rank < 8 ? '#16a34a' : '#ef4444';
    };

    // Display order based on sort toggle
    const displayEntries = sortByPct
      ? [...allEntries].sort((a, b) => b[1] - a[1])
      : [...allEntries].sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <View>
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Group Pick Rate</Text>
          <TouchableOpacity onPress={() => setSortByPct(!sortByPct)} style={styles.sortButtonWrapper}>
            <Text style={styles.sortButtonText}>
              {sortByPct ? 'Sort A–L' : 'Sort by %'}
            </Text>
          </TouchableOpacity>
        </View>

        {displayEntries.map(([group, pct]) => {
          const color = getRowColor(group);
          return (
            <View key={group} style={styles.groupRow}>
              <Text
                style={[styles.groupLabel, { color, fontWeight: '700' }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                Group {group}
              </Text>
              <View style={styles.barWrapper}>
                <View style={[styles.bar, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
              </View>
              <Text
                style={[styles.pctText, { color, fontWeight: '600' }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >{pct}%</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats || !stats.group_accuracy || !stats.accuracy_distribution) return null;

    const accuracyEntries = Object.entries(stats.group_accuracy).sort((a, b) => b[1] - a[1]);

    return (
      <View>
        <Text style={styles.sectionTitle}>Who Picked the Right Group?</Text>
        {accuracyEntries.map(([group, pct]) => (
          <View key={group} style={styles.groupRow}>
            <Text style={styles.groupLabel}>Group {group}</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.bar, styles.barCorrect, { width: `${Math.max(pct, 2)}%` }]} />
            </View>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>How Many Groups Right?</Text>
        <View style={styles.distContainer}>
          {[
            { n: 4, color: '#fee2e2', textColor: '#dc2626' },   // red - worst
            { n: 5, color: '#ffedd5', textColor: '#ea580c' },  // orange
            { n: 6, color: '#fef9c3', textColor: '#b45309' },    // yellow
            { n: 7, color: '#bbf7d0', textColor: '#15803d' },    // light green
            { n: 8, color: '#dcfce7', textColor: '#16a34a' },    // green - best
          ].map(({ n, color, textColor }) => {
            const pct = stats.accuracy_distribution![String(n)] || 0;
            return (
              <View key={n} style={[styles.distItem, { backgroundColor: color }]}>
                <Text style={[styles.distPct, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}>{pct}%</Text>
                <Text style={[styles.distLabel, { color: textColor }]} numberOfLines={1} maxFontSizeMultiplier={1}>{n}/8</Text>
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
        <TouchableOpacity style={[styles.modalContent, { direction: 'ltr' }]} activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text
              style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.2}
            >3rd Place Statistics</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonWrapper}>
              <Ionicons name="close" size={22} color="#64748b" />
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
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sortButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  sortButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  groupLabel: {
    width: 72,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  barWrapper: {
    flex: 1,
    height: 20,
    backgroundColor: '#152a45',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  bar: {
    height: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  barCorrect: {
    backgroundColor: '#4CAF50',
  },
  pctText: {
    width: 52,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
  },
  distContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  distItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  distPct: {
    fontSize: 13,
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
