import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  apiService,
  Match,
  MemberMatchPrediction,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { IS_RTL } from '../../utils/rtl';

interface RouteParams {
  leagueId: string | number;
  isGlobalLeague: boolean;
}

function getPredColor(
  p: MemberMatchPrediction | null,
  hasResult: boolean,
  actualResult?: { home_score: number; away_score: number } | null
): string {
  if (!p || p.home_score == null || p.away_score == null) return '#334155';
  if (p.prediction_status === 'exact') return '#16a34a';
  if (p.prediction_status === 'correct_outcome') return '#f59e0b';
  if (p.prediction_status === 'wrong') return '#ef4444';
  if (hasResult && actualResult) {
    const { home_score: ah, away_score: aa } = actualResult;
    if (p.home_score === ah && p.away_score === aa) return '#16a34a';
    const predWinner =
      p.home_score > p.away_score ? 'home' : p.home_score < p.away_score ? 'away' : 'draw';
    const actualWinner = ah > aa ? 'home' : ah < aa ? 'away' : 'draw';
    if (predWinner === actualWinner) return '#f59e0b';
    return '#ef4444';
  }
  return '#334155';
}

function BlinkingLiveDot() {
  const opacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        opacity,
      }}
    />
  );
}

const STATUS_ORDER: Record<string, number> = { exact: 0, correct_outcome: 1, wrong: 2 };

function sortPredictions(preds: MemberMatchPrediction[]): MemberMatchPrediction[] {
  return [...preds].sort((a, b) => {
    const ao = a.prediction_status != null ? (STATUS_ORDER[a.prediction_status] ?? 3) : 3;
    const bo = b.prediction_status != null ? (STATUS_ORDER[b.prediction_status] ?? 3) : 3;
    if (ao !== bo) return ao - bo;
    return (a.username || '').localeCompare(b.username || '');
  });
}

export default function LeagueMatchBrowserScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { getCurrentUserId } = useAuth();
  const { leagueId, isGlobalLeague } = route.params as RouteParams;
  const currentUserId = getCurrentUserId();

  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [matchData, setMatchData] = useState<{ actual_result: { home_score: number; away_score: number } | null; match_status: string; predictions: MemberMatchPrediction[] } | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingPreds, setLoadingPreds] = useState(false);
  // Prevents stale response from overwriting state if user navigates quickly
  const fetchingMatchIdRef = React.useRef<number | null>(null);

  const currentMatch = currentIndex >= 0 && currentIndex < matches.length ? matches[currentIndex] : null;
  const predictions = matchData ? sortPredictions(matchData.predictions) : [];
  const hasResult = !!matchData?.actual_result;
  const actualResult = matchData?.actual_result ?? null;
  const isLive = matchData?.match_status === 'live';

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const userId = currentUserId ?? 0;
      const data = await apiService.getMatches(userId);
      const played = data.matches.filter(
        (m) => m.status === 'live' || m.status === 'finished'
      );
      setMatches(played);
      if (played.length > 0) {
        let idx = played.length - 1;
        const liveMatches = played.map((m, i) => ({ m, i })).filter(({ m }) => m.status === 'live');
        if (liveMatches.length > 0) {
          idx = liveMatches[liveMatches.length - 1].i;
        }
        setCurrentIndex(idx);
        await fetchPredictions(played[idx].id);
      }
    } catch (e) {
      console.warn('LeagueMatchBrowser: failed to load matches', e);
    } finally {
      setLoadingInit(false);
    }
  };

  const fetchPredictions = async (matchId: number) => {
    fetchingMatchIdRef.current = matchId;
    setLoadingPreds(true);
    setMatchData(null);
    try {
      const data = isGlobalLeague
        ? await apiService.getGlobalMatchPredictions(matchId)
        : await apiService.getLeagueMatchPredictions(Number(leagueId), matchId);
      if (fetchingMatchIdRef.current !== matchId) return;
      setMatchData(data);
    } catch (e) {
      console.warn('LeagueMatchBrowser: failed to load predictions', e);
    } finally {
      if (fetchingMatchIdRef.current === matchId) setLoadingPreds(false);
    }
  };

  const goToMatch = useCallback(
    async (dir: -1 | 1) => {
      const newIdx = currentIndex + dir;
      if (newIdx < 0 || newIdx >= matches.length || loadingPreds) return;
      setCurrentIndex(newIdx);
      await fetchPredictions(matches[newIdx].id);
    },
    [currentIndex, matches, loadingPreds, isGlobalLeague, leagueId]
  );

  const renderPredItem = ({ item, index }: { item: MemberMatchPrediction; index: number }) => {
    const isMe = item.user_id === currentUserId;
    const hasPred = item.home_score != null && item.away_score != null;
    const predColor = getPredColor(item, hasResult, actualResult);
    const scoreText = hasPred ? `${item.home_score}:${item.away_score}` : '—';
    const bgColor = index % 2 === 0 ? '#0f172a' : '#111827';

    return (
      <View
        style={[
          styles.predRow,
          { backgroundColor: isMe ? '#1a2744' : bgColor },
          isMe && styles.predRowMe,
        ]}
      >
        <View style={styles.predNameCol}>
          <Text
            style={[styles.predName, isMe && styles.predNameBold]}
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.1}
          >
            {(item as any).username ?? item.name ?? 'Player'}
          </Text>
          {item.name && item.name !== (item as any).username && (
            <Text style={styles.predSubName} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.predBadge,
            { backgroundColor: predColor },
            item.is_tempted && styles.predBadgeTempted,
          ]}
        >
          <Text style={styles.predBadgeText}>{scoreText}</Text>
        </View>
      </View>
    );
  };

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#0f172a']}
          locations={[0, 0.5, 1]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backBtn, IS_RTL && { left: undefined, right: 0 }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name={IS_RTL ? 'chevron-forward' : 'chevron-back'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('matchBrowser.title')}</Text>
          </View>
        </LinearGradient>
        <View style={styles.centerBox}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        locations={[0, 0.5, 1]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, IS_RTL && { left: undefined, right: 0 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name={IS_RTL ? 'chevron-forward' : 'chevron-back'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('matchBrowser.title')}</Text>
        </View>
      </LinearGradient>

      {matches.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="football-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>{t('matchBrowser.noMatches')}</Text>
        </View>
      ) : (
        <>
          {/* Match navigation bar */}
          <View style={styles.matchNavBar}>
            <TouchableOpacity
              style={[styles.navArrow, currentIndex === 0 && styles.navArrowDisabled]}
              onPress={() => goToMatch(-1)}
              disabled={currentIndex === 0 || loadingPreds}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentIndex === 0 ? '#1e293b' : '#94a3b8'}
              />
            </TouchableOpacity>

            <View style={styles.matchInfoBlock}>
              {currentMatch && (
                <>
                  {/* Teams row — always LTR for sport convention */}
                  <View style={[styles.matchTeamsRow, { direction: 'ltr' }]}>
                    <View style={styles.teamBlock}>
                      {currentMatch.home_team.flag_url ? (
                        <Image
                          source={{ uri: currentMatch.home_team.flag_url }}
                          style={styles.teamFlag}
                        />
                      ) : null}
                      <Text
                        style={styles.teamName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        maxFontSizeMultiplier={1}
                      >
                        {currentMatch.home_team.name}
                      </Text>
                    </View>

                    <View style={styles.scoreBlock}>
                      {actualResult ? (
                        <Text style={styles.scoreText}>
                          {actualResult.home_score}:{actualResult.away_score}
                        </Text>
                      ) : (
                        <Text style={styles.vsText}>vs</Text>
                      )}
                    </View>

                    <View style={[styles.teamBlock, styles.teamBlockAway]}>
                      {currentMatch.away_team.flag_url ? (
                        <Image
                          source={{ uri: currentMatch.away_team.flag_url }}
                          style={styles.teamFlag}
                        />
                      ) : null}
                      <Text
                        style={styles.teamName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        maxFontSizeMultiplier={1}
                      >
                        {currentMatch.away_team.name}
                      </Text>
                    </View>
                  </View>

                  {/* Status + counter */}
                  <View style={styles.matchMeta}>
                    {isLive ? (
                      <View style={styles.statusBadgeLive}>
                        <BlinkingLiveDot />
                        <Text style={styles.statusTextLive}>LIVE</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>FT</Text>
                      </View>
                    )}
                    <Text style={styles.matchCounter}>
                      {currentIndex + 1} / {matches.length}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.navArrow,
                currentIndex === matches.length - 1 && styles.navArrowDisabled,
              ]}
              onPress={() => goToMatch(1)}
              disabled={currentIndex === matches.length - 1 || loadingPreds}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentIndex === matches.length - 1 ? '#1e293b' : '#94a3b8'}
              />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Predictions list */}
          <View style={styles.listWrapper}>
            {loadingPreds ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : (
              <FlatList
                data={predictions}
                keyExtractor={(item) => String(item.user_id)}
                renderItem={renderPredItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.centerBox}>
                    <Text style={styles.emptyText}>{t('matchBrowser.noPredictions')}</Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  headerGradient: {
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    position: 'relative',
    minHeight: 36,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 4,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  matchNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  navArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  navArrowDisabled: {
    backgroundColor: 'transparent',
  },
  matchInfoBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  teamBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamBlockAway: {
    alignItems: 'center',
  },
  teamFlag: {
    width: 36,
    height: 24,
    borderRadius: 4,
    resizeMode: 'cover',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  scoreBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(100,116,139,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.4)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  statusBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  statusTextLive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  matchCounter: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  listWrapper: {
    flex: 1,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  listContent: {
    paddingBottom: 24,
  },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  predRowMe: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    paddingLeft: 13,
  },
  predNameCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  predName: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  predNameBold: {
    fontWeight: '700',
  },
  predSubName: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  predBadge: {
    width: 52,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  predBadgeTempted: {
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  predBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
