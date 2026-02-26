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
import { apiService, ThirdPlaceStats } from '../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ThirdPlaceStatsModal({ visible, onClose }: Props) {
  const [stats, setStats] = useState<ThirdPlaceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortByPct, setSortByPct] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchStats();
    } else {
      setStats(null);
      setError(null);
      setSortByPct(false);
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

    let entries = Object.entries(stats.group_pick_pct);
    if (sortByPct) {
      entries.sort((a, b) => b[1] - a[1]);
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return (
      <View>
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Group Pick Rate</Text>
          <TouchableOpacity onPress={() => setSortByPct(!sortByPct)}>
            <Text style={styles.sortButton}>
              {sortByPct ? 'Sort A-L' : 'Sort by %'}
            </Text>
          </TouchableOpacity>
        </View>

        {entries.map(([group, pct]) => (
          <View key={group} style={styles.groupRow}>
            <Text style={styles.groupLabel}>Group {group}</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.bar, { width: `${Math.max(pct, 2)}%` }]} />
            </View>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPostResult = () => {
    if (!stats || !stats.group_accuracy || !stats.accuracy_distribution) return null;

    const accuracyEntries = Object.entries(stats.group_accuracy).sort();

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
          {[4, 5, 6, 7, 8].map((n) => {
            const pct = stats.accuracy_distribution![String(n)] || 0;
            return (
              <View key={n} style={styles.distItem}>
                <Text style={styles.distPct}>{pct}%</Text>
                <Text style={styles.distLabel}>{n}/8</Text>
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
            <Text style={styles.modalTitle}>3rd Place Statistics</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginVertical: 20 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {stats && !loading && (
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.totalText}>{stats.total_predictions} predictions</Text>
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
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sortButton: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupLabel: {
    width: 60,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
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
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  barCorrect: {
    backgroundColor: '#4CAF50',
  },
  pctText: {
    width: 42,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
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
    minWidth: 52,
  },
  distPct: {
    fontSize: 16,
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
