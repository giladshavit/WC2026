import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, Dimensions, Keyboard, StatusBar, Modal, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IS_RTL } from '../../utils/rtl';
import { Match, apiService, MatchesResponse } from '../../services/api';
import MatchCard, { MatchCardHandle } from '../../components/cards/MatchCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal, LockedMatchModal } from '../../components/modals/CustomModals';

// In-memory cache — lives as long as the app is open
interface MatchesCache {
  matches: Match[];
  score: number | null;
  cachedAt: number;
}
let _matchesCache: MatchesCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

function isCacheValid(): boolean {
  if (!_matchesCache) return false;
  return Date.now() - _matchesCache.cachedAt < CACHE_TTL_MS;
}

function setMatchesCache(matches: Match[], score: number | null): void {
  _matchesCache = { matches, score, cachedAt: Date.now() };
}

function clearMatchesCache(): void {
  _matchesCache = null;
}

const DEBOUNCE_MS = 800;

function MatchLegendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const rows = [
    {
      icon: 'stats-chart',
      color: '#38bdf8',
      label: t('matches.legendStatsLabel'),
      desc: t('matches.legendStatsDesc'),
    },
    {
      icon: 'flash',
      color: '#7c3aed',
      label: t('matches.legendTemptLabel'),
      desc: t('matches.legendTemptDesc'),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={matchLegendStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={[matchLegendStyles.card, { direction: IS_RTL ? 'rtl' : 'ltr' }]} onPress={() => {}}>

          <View style={matchLegendStyles.titleRow}>
            <Ionicons name="information-circle" size={18} color="#94a3b8" />
            <Text style={[matchLegendStyles.title, { textAlign: 'left' }]}>{t('matches.legendTitle')}</Text>
          </View>

          {rows.map((row) => (
            <View key={row.icon} style={matchLegendStyles.row}>
              <View style={[matchLegendStyles.iconBox, { backgroundColor: row.color + '22' }]}>
                <Ionicons name={row.icon as any} size={16} color={row.color} />
              </View>
              <View style={matchLegendStyles.rowText}>
                <Text style={[matchLegendStyles.rowLabel, { color: row.color, textAlign: 'left' }]}>{row.label}</Text>
                <Text style={[matchLegendStyles.rowDesc, { textAlign: 'left' }]}>{row.desc}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={matchLegendStyles.closeBtn} onPress={onClose}>
            <Text style={matchLegendStyles.closeBtnText}>{t('matches.legendGotIt')}</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const matchLegendStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
});

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchesScore, setMatchesScore] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const hasAutoScrolledRef = useRef(false);
  const debounceTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const cardHandles = useRef<Map<number, MatchCardHandle>>(new Map());
  const scrollOffsetRef = useRef(0);
  const focusedMatchIdRef = useRef<number | null>(null);

  const { getCurrentUserId } = useAuth();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [lockedModal, setLockedModal] = useState<{
    message: string;
  } | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setInfoModalVisible(true)}
          style={{ paddingRight: 16, paddingVertical: 8 }}
        >
          <Ionicons name="information-circle" size={24} color="#e2e8f0" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchMatches = useCallback(async (forceRefresh = false) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
        setLoading(false);
        return;
      }

      // Serve from cache if valid and not a forced refresh
      if (!forceRefresh && isCacheValid() && _matchesCache) {
        setMatches(_matchesCache.matches);
        setMatchesScore(_matchesCache.score);
        setFetchCount(prev => prev + 1);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data: MatchesResponse = await apiService.getMatches(userId);
      setMatchesCache(data.matches, data.matches_score);
      setMatches(data.matches);
      setMatchesScore(data.matches_score);
      setFetchCount(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setErrorModal({ title: 'Error', message: 'Could not load matches. Please check your connection.', goBack: true });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCurrentUserId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Clear debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  const scrollToFocusedCard = useCallback(async (kbHeight: number) => {
    const matchId = focusedMatchIdRef.current;
    if (matchId === null || !flatListRef.current) return;

    const handle = cardHandles.current.get(matchId);
    if (!handle) return;

    const pos = await handle.measureCard();
    if (!pos) return;

    const PADDING = 16;
    const screenHeight = Dimensions.get('window').height;
    const visibleBottom = screenHeight - kbHeight;
    const cardBottom = pos.y + pos.height;

    if (cardBottom > visibleBottom) {
      const newOffset = scrollOffsetRef.current + (cardBottom - visibleBottom + PADDING);
      flatListRef.current.scrollToOffset({ offset: newOffset, animated: true });
    }
  }, []);

  // Keyboard show/hide listeners for dynamic padding and scroll logic
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height;
      setKeyboardHeight(kbHeight);
      setTimeout(() => {
        scrollToFocusedCard(kbHeight);
      }, 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      focusedMatchIdRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToFocusedCard]);

  // Scroll to first live or first unfinished match when matches are loaded
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;

    if (!loading && matches.length > 0 && flatListRef.current) {
      const firstLive = matches.findIndex((m) => m.status === 'live');
      const firstScheduled = matches.findIndex((m) => !m.actual_result);
      const scrollTarget = firstLive !== -1 ? firstLive : firstScheduled;

      if (scrollTarget !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: scrollTarget,
            animated: true,
            viewPosition: 0,
          });
          hasAutoScrolledRef.current = true;
        }, 100);
      } else {
        hasAutoScrolledRef.current = true;
      }
    }
  }, [loading, matches]);

  const saveMatch = useCallback(
    async (matchId: number, homeScore: number, awayScore: number, isTempted: boolean = false) => {
      const userId = getCurrentUserId();
      if (!userId) return;

      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.status === 'live') {
        setLockedModal({ message: 'This match has started and can no longer be edited.' });
        return;
      }
      if (match.status === 'finished') {
        setLockedModal({ message: 'This match has finished and can no longer be edited.' });
        return;
      }

      // Optimistic update — update local state immediately, no GET needed
      setMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? {
                ...m,
                user_prediction: {
                  ...m.user_prediction,
                  home_score: homeScore,
                  away_score: awayScore,
                  is_tempted: isTempted,
                  predicted_winner:
                    homeScore > awayScore ? m.home_team.id
                    : awayScore > homeScore ? m.away_team.id
                    : 0,
                },
              }
            : m
        )
      );

      // Keep cache in sync with optimistic update
      if (_matchesCache) {
        _matchesCache.matches = _matchesCache.matches.map(m =>
          m.id === matchId
            ? {
                ...m,
                user_prediction: {
                  ...m.user_prediction,
                  home_score: homeScore,
                  away_score: awayScore,
                  is_tempted: isTempted,
                  predicted_winner:
                    homeScore > awayScore ? m.home_team.id
                    : awayScore > homeScore ? m.away_team.id
                    : 0,
                },
              }
            : m
        );
      }

      try {
        await apiService.updateBatchMatchPredictions(userId, [
          { match_id: matchId, home_score: homeScore, away_score: awayScore, is_tempted: isTempted },
        ]);
        // No fetchMatches() — local state is already correct
      } catch (error) {
        console.error('Error saving prediction:', error);
        showToast('Could not save prediction. Please try again.', 'error');
        // Rollback on error
        setResetCount(prev => prev + 1);
        await fetchMatches();
      }
    },
    [matches, getCurrentUserId, fetchMatches]
  );

  const handleScoreChange = useCallback(
    (matchId: number, homeScore: number | null, awayScore: number | null, isTempted: boolean = false) => {
      const existingTimer = debounceTimersRef.current.get(matchId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(matchId);
      }

      if (homeScore !== null && awayScore !== null) {
        const timer = setTimeout(() => {
          debounceTimersRef.current.delete(matchId);
          saveMatch(matchId, homeScore, awayScore, isTempted);
        }, DEBOUNCE_MS);
        debounceTimersRef.current.set(matchId, timer);
      }
    },
    [saveMatch]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    clearMatchesCache();
    fetchMatches(true);
  };

  const handleMatchFocus = useCallback((matchId: number) => {
    focusedMatchIdRef.current = matchId;
  }, []);

  const renderMatch = ({ item }: { item: Match }) => (
    <MatchCard
      key={`${item.id}-${fetchCount}-${resetCount}`}
      ref={(el) => {
        if (el) cardHandles.current.set(item.id, el);
      }}
      match={item}
      onScoreChange={handleScoreChange}
      onInputFocus={handleMatchFocus}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading matches...</Text>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title ?? 'Error'}
          message={errorModal?.message ?? ''}
          onClose={() => setErrorModal(null)}
          {...(errorModal?.goBack && {
            onGoBack: () => { setErrorModal(null); navigation.goBack(); },
            goBackLabel: 'Go Back',
          })}
        />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cloud-offline-outline" size={56} color="#f87171" />
        <Text style={styles.emptyText}>Could not load matches</Text>
        <Text style={styles.emptySubtext}>Please check your connection and try again</Text>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title ?? 'Error'}
          message={errorModal?.message ?? ''}
          onClose={() => setErrorModal(null)}
          {...(errorModal?.goBack && {
            onGoBack: () => { setErrorModal(null); navigation.goBack(); },
            goBackLabel: 'Go Back',
          })}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { direction: 'ltr' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.container}>
        <View style={styles.header}>
          {matchesScore !== null && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>{matchesScore} pts</Text>
            </View>
          )}
        </View>
        <FlatList
          ref={flatListRef}
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id.toString()}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 32 : 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise((resolve) => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
        />
      </View>
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
        {...(errorModal?.goBack && {
          onGoBack: () => { setErrorModal(null); navigation.goBack(); },
          goBackLabel: 'Go Back',
        })}
      />
      <LockedMatchModal
        visible={!!lockedModal}
        message={lockedModal?.message ?? ''}
        onClose={() => setLockedModal(null)}
      />
      <MatchLegendModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
