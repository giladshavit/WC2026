import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  apiService,
  LeagueStanding,
  LeagueStandingsResponse,
  LeagueMatchPredictionsResponse,
  MemberMatchPrediction,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';
import { LeaveLeagueModal, ErrorModal } from '../../components/modals/CustomModals';
import { useToast } from '../../components/toast/Toast';

type SortKey = 'total' | 'matches' | 'groups' | 'knockout' | 'fine';

interface RouteParams {
  leagueId: string | number;
}

// Extended standing with optional fine (point deduction; API returns as penalty)
interface StandingWithFine extends LeagueStanding {
  penalty?: number; // API field
}

const PODIUM_MEDAL_CONFIG = [
  { size: 36, color: '#D4AF37' },
  { size: 32, color: '#A8A9AD' },
  { size: 32, color: '#AD6F3B' },
];

function getLivePredBadgeColor(
  p: MemberMatchPrediction | null,
  hasActualResult: boolean,
  actualResult?: { home_score: number; away_score: number } | null
): string {
  if (!p) return '#334155';
  // Use backend prediction_status when available (exact, correct_outcome, wrong)
  if (p.prediction_status === 'exact') return '#16a34a';
  if (p.prediction_status === 'correct_outcome') return '#f59e0b';
  if (p.prediction_status === 'wrong') return '#ef4444';
  // For live/pending: compute client-side from actual result
  if (hasActualResult && actualResult && p.home_score != null && p.away_score != null) {
    const { home_score: ah, away_score: aa } = actualResult;
    const { home_score: ph, away_score: pa } = p;
    if (ph === ah && pa === aa) return '#16a34a';
    const predWinner = ph > pa ? 'home' : ph < pa ? 'away' : 'draw';
    const actualWinner = ah > aa ? 'home' : ah < aa ? 'away' : 'draw';
    if (predWinner === actualWinner) return '#f59e0b';
    return '#ef4444';
  }
  return '#334155';
}

function BlinkingDot({ active }: { active: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(0.3);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  return (
    <Animated.View style={[styles.liveDot, { opacity }, !active && { backgroundColor: '#64748b' }]} />
  );
}

function LiveHeaderCell({ liveMatchPredictions }: { liveMatchPredictions: LeagueMatchPredictionsResponse }) {
  const scoreText = liveMatchPredictions.actual_result
    ? `${liveMatchPredictions.actual_result.home_score}:${liveMatchPredictions.actual_result.away_score}`
    : '—';

  return (
    <View style={styles.headerIconWrapper}>
      <View style={styles.matchScorePill}>
        <Text style={styles.matchScoreText}>{scoreText}</Text>
      </View>
    </View>
  );
}

function PodiumSection({
  topThree,
  currentUserId,
  truncateName,
}: {
  topThree: StandingWithFine[];
  currentUserId: number | null;
  truncateName: (name: string) => string;
}) {
  // Podium order: 2nd (left), 1st (center), 3rd (right)
  const ordered = [
    topThree[1] ?? null,
    topThree[0] ?? null,
    topThree[2] ?? null,
  ];
  const stageColors = ['#D4AF37', '#A8A9AD', '#AD6F3B'];

  return (
    <View style={styles.podiumSection}>
      {ordered.map((item, displayIdx) => {
        if (!item) return null;
        const rankIdx = displayIdx === 0 ? 1 : displayIdx === 1 ? 0 : 2;
        const isCenter = displayIdx === 1;
        const isCurrentUser = currentUserId !== null && item.user_id === currentUserId;
        const medalConfig = PODIUM_MEDAL_CONFIG[rankIdx];

        return (
          <View
            key={item.user_id}
            style={styles.podiumCard}
          >
            <View style={[styles.podiumCardInner, isCenter && styles.podiumCardInnerGold]}>
              <Ionicons name="medal" size={medalConfig.size} color={medalConfig.color} style={styles.podiumMedalIcon} />
              <Text
                style={[styles.podiumName, isCurrentUser && styles.podiumNameBold]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {truncateName(item.name ?? (item as any).username ?? 'Player')}
              </Text>
              <Text style={styles.podiumPts}>{item.total_points ?? 0}</Text>
            </View>
            <View style={[styles.podiumStageBar, { backgroundColor: stageColors[rankIdx] }]} />
          </View>
        );
      })}
    </View>
  );
}

function AnimatedPlayerRow({
  item,
  index,
  currentUserId,
  truncateName,
  liveMatchPredictionsList,
  side,
  scoreMode,
  showOnlyTotalColumn,
  onRowPress,
}: {
  item: StandingWithFine;
  index: number;
  currentUserId: number | null;
  truncateName: (name: string) => string;
  liveMatchPredictionsList: LeagueMatchPredictionsResponse[];
  side: 'left' | 'middle' | 'right';
  scoreMode?: 'weighted' | 'matches';
  showOnlyTotalColumn?: boolean;
  onRowPress?: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const isCurrentUser = currentUserId !== null && item.user_id === currentUserId;
  const fineVal = item.penalty ?? 0; // API returns penalty
  const groupsPlusThird = (item.groups_points ?? 0) + (item.third_place_points ?? 0);
  const rowBg = index % 2 === 0 ? '#0f172a' : '#111827';
  const rank = index + 1;

  const renderRankIcon = () => {
    if (rank === 1) return <Ionicons name="medal" size={14} color="#D4AF37" />;
    if (rank === 2) return <Ionicons name="medal" size={14} color="#A8A9AD" />;
    if (rank === 3) return <Ionicons name="medal" size={14} color="#AD6F3B" />;
    return <Text style={styles.rankNumber}>{rank}</Text>;
  };

  if (side === 'left') {
    const leftContent = (
      <Animated.View
        style={[
          styles.playerRow,
          { backgroundColor: isCurrentUser ? '#1a2744' : rowBg },
          isCurrentUser && styles.playerRowCurrentUser,
          { opacity: fadeAnim },
        ]}
      >
        <View style={styles.playerRowContent}>
          <View style={styles.colPlayer}>
            <View style={styles.rankNameRow}>
              {renderRankIcon()}
              <Text
                style={[styles.cellName, styles.cellLeft, isCurrentUser && styles.cellBold]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {truncateName(item.name ?? (item as any).username ?? 'Player')}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
    if (onRowPress) {
      return (
        <TouchableOpacity onPress={onRowPress} activeOpacity={0.8}>
          {leftContent}
        </TouchableOpacity>
      );
    }
    return leftContent;
  }

  if (side === 'middle') {
    const middleContent = (
      <Animated.View
        style={[
          styles.playerRow,
          { backgroundColor: rowBg },
          isCurrentUser && { backgroundColor: '#1a2744' },
          { opacity: fadeAnim },
        ]}
      >
        <View style={styles.playerRowContent}>
          <View style={styles.colNum}>
            <Text style={[styles.cellText, styles.cellCenter]}>{item.matches_points ?? 0}</Text>
          </View>
          <View style={styles.colNum}>
            <Text style={[styles.cellText, styles.cellCenter]}>{groupsPlusThird}</Text>
          </View>
          <View style={styles.colNum}>
            <Text style={[styles.cellText, styles.cellCenter]}>{item.knockout_points ?? 0}</Text>
          </View>
          <View style={styles.colFine}>
            {fineVal > 0 ? (
              <View style={styles.fineBadge}>
                <Text style={styles.fineBadgeText}>{fineVal}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    );
    if (onRowPress) {
      return (
        <TouchableOpacity onPress={onRowPress} activeOpacity={0.8}>
          {middleContent}
        </TouchableOpacity>
      );
    }
    return middleContent;
  }

  const rightContent = (
    <Animated.View
      style={[
        styles.playerRow,
        styles.playerRowRight,
        { backgroundColor: rowBg },
        isCurrentUser && { backgroundColor: '#1a2744' },
        { opacity: fadeAnim },
      ]}
    >
      <View style={[
        styles.playerRowContent,
        styles.playerRowContentRight,
        showOnlyTotalColumn && { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
      ]}>
        {liveMatchPredictionsList.map((liveData) => {
          const memberPred = liveData.predictions.find((p) => p.user_id === item.user_id) ?? null;
          const scoreDisplay =
            memberPred && memberPred.home_score != null && memberPred.away_score != null
              ? `${memberPred.home_score}:${memberPred.away_score}`
              : '—';
          const liveBadgeColor = getLivePredBadgeColor(memberPred, !!liveData.actual_result, liveData.actual_result ?? undefined);
          return (
            <View key={liveData.match_id} style={styles.colLive}>
              <View
                style={[
                  styles.livePredBadge,
                  { backgroundColor: liveBadgeColor },
                  memberPred?.is_tempted && styles.livePredBadgeTempted,
                ]}
              >
                <Text style={styles.livePredText}>{scoreDisplay}</Text>
              </View>
            </View>
          );
        })}
        <View style={styles.colTotal}>
          <View style={[styles.ptsBadge, isCurrentUser && styles.ptsBadgeCurrentUser]}>
            <Text
              style={[
                styles.cellTotal,
                styles.cellCenter,
                isCurrentUser && styles.cellBold,
                ((scoreMode === 'matches' ? item.matches_points : item.total_points) ?? 0) >= 100 && styles.cellTotalLarge,
                ((scoreMode === 'matches' ? item.matches_points : item.total_points) ?? 0) >= 1000 && styles.cellTotalXLarge,
                ((scoreMode === 'matches' ? item.matches_points : item.total_points) ?? 0) < 0 && styles.cellTotalNegative,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}
            >
              {scoreMode === 'matches' ? (item.matches_points ?? 0) : (item.total_points ?? 0)}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
  if (onRowPress) {
    return (
      <TouchableOpacity onPress={onRowPress} activeOpacity={0.8}>
        {rightContent}
      </TouchableOpacity>
    );
  }
  return rightContent;
}

export default function LeagueDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as RouteParams;
  const { getCurrentUserId } = useAuth();
  const { showToast } = useToast();

  const [standingsData, setStandingsData] = useState<LeagueStandingsResponse | null>(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [liveMatchPredictionsList, setLiveMatchPredictionsList] = useState<LeagueMatchPredictionsResponse[]>([]);
  const liveRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveMatchIdsRef = useRef<number[]>([]);
  const [scoreMode, setScoreMode] = useState<'weighted' | 'matches'>('weighted');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [userDismissedLive, setUserDismissedLive] = useState(false);

  const isGlobalLeague = leagueId === 'global';
  const currentUserId = getCurrentUserId();

  const fetchAndSetupLiveMatches = async () => {
    if (!currentUserId) return;
    try {
      const matchesData = await apiService.getMatches(currentUserId);
      const liveMatches = matchesData.matches.filter((m) => m.status === 'live');
      if (liveMatches.length === 0) {
        setLiveMatchPredictionsList([]);
        liveMatchIdsRef.current = [];
      } else {
        liveMatchIdsRef.current = liveMatches.map((m) => m.id);
        const results = await Promise.all(
          liveMatches.map(async (m) => {
            try {
              return isGlobalLeague
                ? await apiService.getGlobalMatchPredictions(m.id)
                : await apiService.getLeagueMatchPredictions(Number(leagueId), m.id);
            } catch (err) {
              console.warn('Failed to fetch live match predictions for match', m.id, err);
              return null;
            }
          })
        );
        setLiveMatchPredictionsList(results.filter((r): r is LeagueMatchPredictionsResponse => r !== null));
      }
    } catch (err) {
      console.warn('Failed to fetch live matches:', err);
    }
  };

  const refreshLiveMatchPredictions = async () => {
    if (liveMatchIdsRef.current.length === 0) return;
    try {
      const results = await Promise.all(
        liveMatchIdsRef.current.map(async (matchId) => {
          try {
            return isGlobalLeague
              ? await apiService.getGlobalMatchPredictions(matchId)
              : await apiService.getLeagueMatchPredictions(Number(leagueId), matchId);
          } catch (err) {
            console.warn('Failed to fetch live match predictions for match', matchId, err);
            return null;
          }
        })
      );
      setLiveMatchPredictionsList(results.filter((r): r is LeagueMatchPredictionsResponse => r !== null));
    } catch (err) {
      console.warn('Failed to refresh live match predictions:', err);
    }
  };

  const fetchStandings = async () => {
    try {
      let data: LeagueStandingsResponse;

      if (isGlobalLeague) {
        data = await apiService.getGlobalStandings();
      } else {
        data = await apiService.getLeagueStandings(Number(leagueId));
      }

      setStandingsData(data);
      await fetchAndSetupLiveMatches();
      setLoading(false);
    } catch (error) {
      console.error('Error fetching standings:', error);
      setLoading(false);
      setErrorModal({
        title: 'Failed to Load',
        message: 'Could not load league standings. Please try again.',
        goBack: true,
      });
      return;
    }
  };

  useEffect(() => {
    if (liveMatchIdsRef.current.length === 0) return;
    liveRefreshIntervalRef.current = setInterval(refreshLiveMatchPredictions, 60000);
    return () => {
      if (liveRefreshIntervalRef.current) {
        clearInterval(liveRefreshIntervalRef.current);
        liveRefreshIntervalRef.current = null;
      }
    };
  }, [isGlobalLeague, liveMatchPredictionsList.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStandings();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStandings();
  }, [leagueId]);

  useEffect(() => {
    if (liveMatchPredictionsList.length > 0 && !userDismissedLive) {
      setIsLiveMode(true);
    } else if (liveMatchPredictionsList.length === 0) {
      setIsLiveMode(false);
      setUserDismissedLive(false);
    }
  }, [liveMatchPredictionsList.length]);

  const leagueName = !standingsData ? 'League' : (isGlobalLeague ? 'Global League' : standingsData.league_info?.name || 'League');

  const handleCopyInviteCode = async () => {
    if (standingsData?.league_info?.invite_code) {
      await Clipboard.setStringAsync(standingsData.league_info.invite_code);
      showToast('Invite code copied!', 'success');
    }
  };

  const handleLeaveLeague = () => {
    setMenuVisible(false);
    const id = Number(leagueId);
    if (isNaN(id)) {
      setErrorModal({ title: 'Invalid League', message: 'Could not identify this league.' });
      return;
    }
    setLeaveModalVisible(true);
  };

  const handleLeaveConfirm = async () => {
    const id = Number(leagueId);
    setLeaveModalVisible(false);
    setLeaving(true);
    try {
      await apiService.leaveLeague(id);
      (navigation as any).navigate('LeaguesMain', { showToast: 'Left league successfully' });
    } catch (error) {
      setErrorModal({
        title: 'Failed to Leave',
        message: 'Could not leave the league. Please try again.',
      });
    } finally {
      setLeaving(false);
    }
  };

  const sortedStandings = useMemo(() => {
    if (!standingsData?.standings) return [];
    const standings = [...standingsData.standings] as StandingWithFine[];
    const fine = (s: StandingWithFine) => s.penalty ?? 0; // API returns penalty
    const groupsPlusThird = (s: StandingWithFine) =>
      (s.groups_points ?? 0) + (s.third_place_points ?? 0);

    standings.sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return (b.total_points ?? 0) - (a.total_points ?? 0);
        case 'matches':
          return (b.matches_points ?? 0) - (a.matches_points ?? 0);
        case 'groups':
          return groupsPlusThird(b) - groupsPlusThird(a);
        case 'knockout':
          return (b.knockout_points ?? 0) - (a.knockout_points ?? 0);
        case 'fine':
          return fine(b) - fine(a);
        default:
          return 0;
      }
    });
    return standings;
  }, [standingsData?.standings, sortBy]);

  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const idx = sortedStandings.findIndex((s) => s.user_id === currentUserId);
    return idx >= 0 ? idx + 1 : null;
  }, [sortedStandings, currentUserId]);

  const currentUserStanding = useMemo(() => {
    if (!currentUserId) return null;
    return sortedStandings.find((s) => s.user_id === currentUserId) ?? null;
  }, [sortedStandings, currentUserId]);

  const truncateName = (name: string, maxLen: number = 12) =>
    name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name;

  const topThree = sortedStandings.slice(0, 3);
  const restStandings = sortedStandings;


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading standings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!standingsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load league data</Text>
        </View>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title}
          message={errorModal?.message ?? ''}
          onClose={() => {
            setErrorModal(null);
            navigation.goBack();
          }}
          onGoBack={() => {
            setErrorModal(null);
            navigation.goBack();
          }}
          goBackLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  const memberCount = standingsData.standings.length;
  const effectiveLiveList = isLiveMode ? liveMatchPredictionsList : [];
  const showOnlyTotalColumn = isLiveMode || scoreMode === 'matches';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        locations={[0, 0.5, 1]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>

          {!isGlobalLeague && (
            <>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible((v) => !v)}
                disabled={leaving}
              >
                <Ionicons name="ellipsis-vertical" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.headerContent}>
            <Text style={styles.title}>{leagueName}</Text>
            <View style={[styles.titleUnderline, { backgroundColor: isGlobalLeague ? '#3b82f6' : '#D4AF37' }]} />
            <Text style={styles.memberCount}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
            {!isGlobalLeague && standingsData.league_info?.invite_code && (
              <TouchableOpacity style={styles.invitePill} onPress={handleCopyInviteCode}>
                <Text style={styles.invitePillText}>{standingsData.league_info.invite_code}</Text>
                <Ionicons name="copy-outline" size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.headerControlsBar}>
        {liveMatchPredictionsList.length > 0 && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              borderWidth: 1,
              backgroundColor: isLiveMode ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.12)',
              borderColor: isLiveMode ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.3)',
            }}
            onPress={() => {
              if (isLiveMode) {
                setIsLiveMode(false);
                setUserDismissedLive(true);
              } else {
                setIsLiveMode(true);
                setUserDismissedLive(false);
              }
            }}
          >
            <BlinkingDot active={isLiveMode} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: isLiveMode ? '#ef4444' : '#cbd5e1' }}>
              Live
            </Text>
          </TouchableOpacity>
        )}
        {liveMatchPredictionsList.length === 0 && <View />}
        <View style={styles.scoreModeToggle}>
          <TouchableOpacity
            style={[styles.scoreModeBtn, scoreMode === 'weighted' && styles.scoreModeBtnActive]}
            onPress={() => { setSortBy('total'); setScoreMode('weighted'); }}
          >
            <Text style={[styles.scoreModeBtnText, scoreMode === 'weighted' && styles.scoreModeBtnTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scoreModeBtn, scoreMode === 'matches' && styles.scoreModeBtnActive]}
            onPress={() => { setSortBy('matches'); setScoreMode('matches'); }}
          >
            <Text style={[styles.scoreModeBtnText, scoreMode === 'matches' && styles.scoreModeBtnTextActive]}>
              Matches
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {topThree.length >= 3 && (
          <PodiumSection
            topThree={topThree}
            currentUserId={currentUserId}
            truncateName={truncateName}
          />
        )}

        {topThree.length < 3 && topThree.length > 0 && (
          <View style={styles.podiumSection}>
            {topThree.map((item, idx) => {
              const isCurrentUser = currentUserId !== null && item.user_id === currentUserId;
              const medalConfig = PODIUM_MEDAL_CONFIG[idx];
              const stageColors = ['#D4AF37', '#A8A9AD', '#AD6F3B'];
              const isCenter = idx === 0;
              return (
                <View key={item.user_id} style={styles.podiumCard}>
                  <View style={[styles.podiumCardInner, isCenter && styles.podiumCardInnerGold]}>
                    <Ionicons name="medal" size={medalConfig.size} color={medalConfig.color} style={styles.podiumMedalIcon} />
                    <Text
                      style={[styles.podiumName, isCurrentUser && styles.podiumNameBold]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {truncateName(item.name ?? (item as any).username ?? 'Player')}
                    </Text>
                    <Text style={styles.podiumPts}>{item.total_points ?? 0}</Text>
                  </View>
                  <View style={[styles.podiumStageBar, { backgroundColor: stageColors[idx] ?? '#A8A9AD' }]} />
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.tableSection}>
          <ScrollView
            style={[styles.tableBody, { flex: 1 }]}
            contentContainerStyle={styles.tableBodyContent}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ffffff"
              />
            }
          >
            <View style={styles.tableRowContainer}>
              <View style={styles.tableFixedLeft}>
                <View style={[styles.tableHeader, { height: 46, backgroundColor: '#334155' }]}>
                  <View style={styles.colPlayer}>
                    <Text style={[styles.headerCell, styles.cellLeft]}>Rank</Text>
                  </View>
                </View>
                {restStandings.map((item, index) => (
                  <AnimatedPlayerRow
                    key={item.user_id}
                    item={item}
                    index={index}
                    currentUserId={currentUserId}
                    truncateName={truncateName}
                    liveMatchPredictionsList={liveMatchPredictionsList}
                    side="left"
                    scoreMode={scoreMode}
                    onRowPress={item.user_id !== currentUserId ? () => (navigation as any).navigate('UserProfile', { userId: item.user_id, username: item.username || item.name || `User ${item.user_id}` }) : undefined}
                  />
                ))}
              </View>
              {!isLiveMode && scoreMode === 'weighted' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tableScrollMiddle}
                contentContainerStyle={styles.tableScrollMiddleContent}
              >
                <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
                  <View style={[styles.tableHeader, styles.tableHeaderMiddle, { height: 46, backgroundColor: '#334155' }]}>
                    <TouchableOpacity
                      style={[styles.colNum, styles.headerIconCell]}
                      onPress={() => setSortBy('matches')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name={sortBy === 'matches' ? 'football' : 'football-outline'} size={14} color={sortBy === 'matches' ? '#ffffff' : '#94a3b8'} />
                        <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'matches' ? '#ffffff' : 'transparent' }]} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.colNum, styles.headerIconCell]}
                      onPress={() => setSortBy('groups')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name={sortBy === 'groups' ? 'home' : 'home-outline'} size={14} color={sortBy === 'groups' ? '#ffffff' : '#94a3b8'} />
                        <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'groups' ? '#ffffff' : 'transparent' }]} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.colNum, styles.headerIconCell]}
                      onPress={() => setSortBy('knockout')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name={sortBy === 'knockout' ? 'trophy' : 'trophy-outline'} size={14} color={sortBy === 'knockout' ? '#ffffff' : '#94a3b8'} />
                        <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'knockout' ? '#ffffff' : 'transparent' }]} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.colFine, styles.headerIconCell]}
                      onPress={() => setSortBy('fine')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name={sortBy === 'fine' ? 'warning' : 'warning-outline'} size={14} color={sortBy === 'fine' ? '#ef4444' : 'rgba(239,68,68,0.4)'} />
                        <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'fine' ? '#ef4444' : 'transparent' }]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                  {restStandings.map((item, index) => (
                    <AnimatedPlayerRow
                      key={item.user_id}
                      item={item}
                      index={index}
                      currentUserId={currentUserId}
                      truncateName={truncateName}
                      liveMatchPredictionsList={liveMatchPredictionsList}
                      side="middle"
                      scoreMode={scoreMode}
                      onRowPress={item.user_id !== currentUserId ? () => (navigation as any).navigate('UserProfile', { userId: item.user_id, username: item.username || item.name || `User ${item.user_id}` }) : undefined}
                    />
                  ))}
                </View>
              </ScrollView>
              )}
              <View style={[
                styles.tableFixedRight,
                showOnlyTotalColumn
                  ? { flex: 1, backgroundColor: '#0f172a' }
                  : { width: 54 + effectiveLiveList.length * 50, backgroundColor: '#0f172a', alignSelf: 'stretch' }
              ]}>
                <View style={[
                  styles.tableHeader,
                  styles.tableHeaderRight,
                  { height: 46, backgroundColor: '#334155' },
                  showOnlyTotalColumn && { justifyContent: 'flex-end' },
                ]}>
                  {effectiveLiveList.map((liveData) => (
                    <View key={liveData.match_id} style={[styles.colLive, styles.headerIconCell]}>
                      <LiveHeaderCell liveMatchPredictions={liveData} />
                    </View>
                  ))}
                  {scoreMode === 'matches' ? (
                    <View style={[styles.colTotal, styles.headerIconCell]}>
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.colTotal, styles.headerIconCell]}
                      onPress={() => setSortBy('total')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerIconWrapper}>
                        <Ionicons name={sortBy === 'total' ? 'star' : 'star-outline'} size={14} color={sortBy === 'total' ? '#fbbf24' : 'rgba(251,191,36,0.4)'} />
                        <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'total' ? '#fbbf24' : 'transparent' }]} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                {restStandings.map((item, index) => (
                  <AnimatedPlayerRow
                    key={item.user_id}
                    item={item}
                    index={index}
                    currentUserId={currentUserId}
                    truncateName={truncateName}
                    liveMatchPredictionsList={effectiveLiveList}
                    side="right"
                    scoreMode={scoreMode}
                    showOnlyTotalColumn={showOnlyTotalColumn}
                    onRowPress={item.user_id !== currentUserId ? () => (navigation as any).navigate('UserProfile', { userId: item.user_id, username: item.username || item.name || `User ${item.user_id}` }) : undefined}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {currentUserStanding && currentUserRank && currentUserRank > 3 && (
            <View style={styles.stickyUserRow}>
              <View style={[styles.tableFixedLeft, { backgroundColor: '#1a2744' }]}>
                <View style={[styles.playerRow, styles.playerRowContent, { minHeight: 52, borderBottomWidth: 0 }]}>
                  <View style={styles.colPlayer}>
                    <View style={styles.rankNameRow}>
                      <Text style={styles.stickyRankNumber}>{currentUserRank}</Text>
                      <Text style={[styles.cellName, styles.cellLeft, styles.cellBold]} numberOfLines={1}>
                        {truncateName(currentUserStanding.name ?? (currentUserStanding as any).username ?? 'You')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              {!isLiveMode && scoreMode === 'weighted' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tableScrollMiddle}
                contentContainerStyle={styles.tableScrollMiddleContent}
              >
                <View style={[styles.playerRow, styles.playerRowContent, { minHeight: 52, borderBottomWidth: 0, paddingHorizontal: 14, backgroundColor: '#1a2744' }]}>
                  <View style={styles.colNum}>
                    <Text style={[styles.cellText, styles.cellCenter]}>
                      {currentUserStanding.matches_points ?? 0}
                    </Text>
                  </View>
                  <View style={styles.colNum}>
                    <Text style={[styles.cellText, styles.cellCenter]}>
                      {(currentUserStanding.groups_points ?? 0) + (currentUserStanding.third_place_points ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.colNum}>
                    <Text style={[styles.cellText, styles.cellCenter]}>
                      {currentUserStanding.knockout_points ?? 0}
                    </Text>
                  </View>
                  <View style={styles.colFine}>
                    {(currentUserStanding.penalty ?? 0) > 0 ? (
                      <View style={styles.fineBadge}>
                        <Text style={styles.fineBadgeText}>-{currentUserStanding.penalty}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.cellText, styles.cellCenter]}>0</Text>
                    )}
                  </View>
                </View>
              </ScrollView>
              )}
              <View style={[
                styles.tableFixedRight,
                styles.stickyUserRowRight,
                showOnlyTotalColumn
                  ? { flex: 1, backgroundColor: '#1a2744' }
                  : { width: 54 + effectiveLiveList.length * 50, backgroundColor: '#1a2744' }
              ]}>
                <View style={[
                  styles.playerRow,
                  styles.playerRowRight,
                  { minHeight: 52, borderBottomWidth: 0, backgroundColor: '#1a2744' },
                  showOnlyTotalColumn && { flex: 1, justifyContent: 'flex-end' },
                ]}>
                  <View style={[
                    styles.playerRowContent,
                    styles.playerRowContentRight,
                    showOnlyTotalColumn && { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
                  ]}>
                    {effectiveLiveList.map((liveData) => {
                      const memberPred = liveData.predictions.find((p) => p.user_id === currentUserStanding.user_id) ?? null;
                      const hasScore = memberPred && memberPred.home_score != null && memberPred.away_score != null;
                      const scoreDisplay = hasScore ? `${memberPred!.home_score}:${memberPred!.away_score}` : '—';
                      return (
                        <View key={liveData.match_id} style={styles.colLive}>
                          <View
                            style={[
                              styles.livePredBadge,
                              { backgroundColor: getLivePredBadgeColor(memberPred, !!liveData.actual_result, liveData.actual_result ?? undefined) },
                              memberPred?.is_tempted && styles.livePredBadgeTempted,
                            ]}
                          >
                            <Text style={styles.livePredText}>{scoreDisplay}</Text>
                          </View>
                        </View>
                      );
                    })}
                    <View style={styles.colTotal}>
                      <View style={[styles.ptsBadge, styles.ptsBadgeCurrentUser]}>
                        <Text
                          style={[styles.cellTotal, styles.cellCenter, styles.cellBold]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.5}
                        >
                          {scoreMode === 'matches' ? (currentUserStanding.matches_points ?? 0) : (currentUserStanding.total_points ?? 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {menuVisible && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        />
      )}
      {menuVisible && !isGlobalLeague && (
        <View style={styles.menuDropdownFloating}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLeaveLeague}
          >
            <Ionicons name="exit-outline" size={14} color="#ef4444" />
            <Text style={styles.menuItemText}>Leave League</Text>
          </TouchableOpacity>
        </View>
      )}
      <LeaveLeagueModal
        visible={leaveModalVisible}
        leagueName={leagueName}
        onConfirm={handleLeaveConfirm}
        onCancel={() => setLeaveModalVisible(false)}
      />
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
        onGoBack={errorModal?.goBack ? () => { setErrorModal(null); navigation.goBack(); } : undefined}
        goBackLabel="Go Back"
      />
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
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  header: {
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
    padding: 4,
  },
  menuButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 0,
  },
  menuDropdown: {
    position: 'absolute',
    right: 0,
    top: 36,
    zIndex: 100,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuDropdownFloating: {
    position: 'absolute',
    right: 16,
    top: 90,
    zIndex: 101,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 2,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 11,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  titleUnderline: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    alignSelf: 'center',
  },
  memberCount: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
  },
  invitePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    backgroundColor: '#0f172a',
    marginTop: -4,
  },
  podiumSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  podiumCard: {
    flex: 1,
    maxWidth: 110,
  },
  podiumCardInner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 108,
  },
  podiumCardInnerGold: {
    minHeight: 130,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  podiumMedalIcon: {
    marginBottom: 4,
  },
  podiumStageBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    width: '100%',
  },
  podiumName: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '500',
    marginBottom: 4,
    width: '100%',
    textAlign: 'center',
  },
  podiumNameBold: {
    fontWeight: 'bold',
  },
  podiumPts: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
  },
  scoreModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  scoreModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 17,
  },
  scoreModeBtnActive: {
    backgroundColor: '#475569',
  },
  scoreModeBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  scoreModeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  tableSection: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: '#334155',
  },
  headerIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconUnderline: {
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    width: '80%',
    alignSelf: 'center',
  },
  headerIconCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  tableBody: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  tableBodyContent: {
    paddingBottom: 24,
    backgroundColor: '#0f172a',
    flexGrow: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  playerRowCurrentUser: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    marginLeft: -3,
  },
  stickyUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: '#1a2744',
    borderTopWidth: 2,
    borderTopColor: '#3b82f6',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  stickyRankNumber: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: 'bold',
    width: 22,
    textAlign: 'center',
  },
  playerRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colPlayer: {
    flex: 1,
  },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankNumber: {
    fontSize: 12,
    color: '#94a3b8',
    width: 22,
    textAlign: 'center',
  },
  colNum: {
    width: 36,
  },
  colFine: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLive: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colTotal: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePredBadge: {
    width: 46,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePredBadgeTempted: {
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  livePredText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  matchScorePill: {
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  tableRowContainer: {
    flexDirection: 'row',
    flex: 1,
    alignSelf: 'stretch',
  },
  tableFixedLeft: {
    width: 130,
    overflow: 'hidden',
  },
  tableScrollMiddle: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  tableScrollMiddleContent: {
    flexGrow: 1,
    minWidth: 140,
  },
  tableHeaderMiddle: {
    backgroundColor: '#334155',
  },
  tableHeaderRight: {
    paddingHorizontal: 0,
  },
  tableFixedRight: {
    overflow: 'hidden',
  },
  playerRowContentRight: {
    flex: 0,
  },
  playerRowRight: {
    paddingHorizontal: 0,
  },
  stickyUserRowRight: {
    paddingHorizontal: 0,
  },
  cellText: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  cellName: {
    fontSize: 13,
    color: '#e2e8f0',
  },
  cellTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cellTotalLarge: {
    fontSize: 13,
  },
  cellTotalXLarge: {
    fontSize: 11,
  },
  cellTotalNegative: {
    fontSize: 11,
  },
  ptsBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    width: 50,
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  ptsBadgeCurrentUser: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  cellCenter: {
    textAlign: 'center',
  },
  cellLeft: {
    textAlign: 'left',
  },
  cellBold: {
    fontWeight: 'bold',
  },
  fineBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'center',
  },
  fineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fca5a5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#94a3b8',
  },
});
