import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, Dimensions, Keyboard, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Match, apiService, MatchesResponse } from '../../services/api';
import MatchCard, { MatchCardHandle } from '../../components/cards/MatchCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal, LockedMatchModal } from '../../components/modals/CustomModals';

const DEBOUNCE_MS = 800;

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

  const fetchMatches = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
        setLoading(false);
        return;
      }

      const data: MatchesResponse = await apiService.getMatches(userId);
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

      try {
        await apiService.updateBatchMatchPredictions(userId, [
          { match_id: matchId, home_score: homeScore, away_score: awayScore, is_tempted: isTempted },
        ]);
        await fetchMatches();
      } catch (error) {
        console.error('Error saving prediction:', error);
        showToast('Could not save prediction. Please try again.', 'error');
        setResetCount(prev => prev + 1);
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
    fetchMatches();
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
    <View style={styles.flex}>
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
