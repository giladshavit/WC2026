import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ActivityIndicator, Platform, Dimensions, Keyboard } from 'react-native';
import { Match, apiService, MatchesResponse } from '../../services/api';
import MatchCard, { MatchCardHandle } from '../../components/MatchCard';
import { useAuth } from '../../contexts/AuthContext';

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

  const fetchMatches = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const data: MatchesResponse = await apiService.getMatches(userId);
      setMatches(data.matches);
      setMatchesScore(data.matches_score);
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('Error', 'Could not load matches. Please check that the server is running.');
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
    async (matchId: number, homeScore: number, awayScore: number) => {
      const userId = getCurrentUserId();
      if (!userId) return;

      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.status === 'live') {
        Alert.alert('Locked', 'This match has started and can no longer be edited.');
        return;
      }
      if (match.status === 'finished') {
        Alert.alert('Locked', 'This match has finished and can no longer be edited.');
        return;
      }

      try {
        await apiService.updateBatchMatchPredictions(userId, [
          { match_id: matchId, home_score: homeScore, away_score: awayScore },
        ]);
        await fetchMatches();
      } catch (error) {
        console.error('Error saving prediction:', error);
        Alert.alert('Error', 'Could not save prediction. Please try again.');
      }
    },
    [matches, getCurrentUserId, fetchMatches]
  );

  const handleScoreChange = useCallback(
    (matchId: number, homeScore: number | null, awayScore: number | null) => {
      const existingTimer = debounceTimersRef.current.get(matchId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(matchId);
      }

      if (homeScore !== null && awayScore !== null) {
        const timer = setTimeout(() => {
          debounceTimersRef.current.delete(matchId);
          saveMatch(matchId, homeScore, awayScore);
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
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.flex}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No matches available</Text>
          <Text style={styles.emptySubtext}>Check that the server is running and matches are created</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pointsBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
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
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
