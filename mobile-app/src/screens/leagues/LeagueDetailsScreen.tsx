import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

type SortKey = 'total' | 'matches' | 'groups' | 'knockout' | 'bonus' | 'fine' | 'exact' | 'correct' | 'wrong';

interface RouteParams {
  leagueId: string | number;
}

// Extended standing with optional fine (point deduction; API returns as penalty)
interface StandingWithFine extends LeagueStanding {
  penalty?: number; // API field
}

/** Sentinel for the column-header row; FlashList stickyHeaderIndices apply to `data` indices, not ListHeaderComponent. */
type StandingsTableHeaderRow = { readonly _standingsTableHeader: true };
const STANDINGS_TABLE_HEADER: StandingsTableHeaderRow = { _standingsTableHeader: true };
type StandingsListEntry = StandingWithFine | StandingsTableHeaderRow;

function isStandingsTableHeaderRow(item: StandingsListEntry): item is StandingsTableHeaderRow {
  return '_standingsTableHeader' in item && (item as StandingsTableHeaderRow)._standingsTableHeader === true;
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
  // No prediction at all, or scores are null — always gray
  if (!p || p.home_score == null || p.away_score == null) return '#334155';

  // Use backend status when available
  if (p.prediction_status === 'exact') return '#16a34a';
  if (p.prediction_status === 'correct_outcome') return '#f59e0b';
  if (p.prediction_status === 'wrong') return '#ef4444';

  // Client-side calculation when actual result is available
  if (hasActualResult && actualResult) {
    const { home_score: ah, away_score: aa } = actualResult;
    const { home_score: ph, away_score: pa } = p;
    if (ph === ah && pa === aa) return '#16a34a';
    const predWinner = ph > pa ? 'home' : ph < pa ? 'away' : 'draw';
    const actualWinner = ah > aa ? 'home' : ah < aa ? 'away' : 'draw';
    if (predWinner === actualWinner) return '#f59e0b';
    return '#ef4444';
  }

  // Live but no result yet — gray
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
  scoreMode,
  scoreModeLoading,
  onPressPlayer,
}: {
  topThree: StandingWithFine[];
  currentUserId: number | null;
  truncateName: (name: string) => string;
  scoreMode: 'classic' | 'multi';
  scoreModeLoading: boolean;
  onPressPlayer: (userId: number, username: string) => void;
}) {
  // Podium order: 2nd (left), 1st (center), 3rd (right)
  const ordered = [
    topThree[1] ?? null,
    topThree[0] ?? null,
    topThree[2] ?? null,
  ];
  const stageColors = ['#D4AF37', '#A8A9AD', '#AD6F3B'];

  return (
    <View style={[styles.podiumSection, { maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
      {ordered.map((item, displayIdx) => {
        if (!item) return null;
        const rankIdx = displayIdx === 0 ? 1 : displayIdx === 1 ? 0 : 2;
        const isCenter = displayIdx === 1;
        const isCurrentUser = currentUserId !== null && item.user_id === currentUserId;
        const medalConfig = PODIUM_MEDAL_CONFIG[rankIdx];

        return (
          <TouchableOpacity
            key={item.user_id}
            style={styles.podiumCard}
            activeOpacity={0.75}
            onPress={() => {
              onPressPlayer(item.user_id, item.username || item.name || `User ${item.user_id}`);
            }}
          >
            <View style={[styles.podiumCardInner, isCenter && styles.podiumCardInnerGold]}>
              <Ionicons name="medal" size={medalConfig.size} color={medalConfig.color} style={styles.podiumMedalIcon} />
              <Text
                style={[styles.podiumName, isCurrentUser && styles.podiumNameBold]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {scoreModeLoading ? '' : truncateName((item as any).username ?? item.name ?? 'Player')}
              </Text>
              {!scoreModeLoading && item.name && item.name !== ((item as any).username ?? item.name) && (
                <Text style={styles.podiumSubName} numberOfLines={1} ellipsizeMode="tail">
                  {item.name}
                </Text>
              )}
              <Text style={styles.podiumPts}>
                {scoreModeLoading ? '' : scoreMode === 'classic'
                  ? (item.matches_points ?? 0) + (item.bonus_points ?? 0)
                  : (item.total_points ?? 0)}
              </Text>
            </View>
            <View style={[styles.podiumStageBar, { backgroundColor: stageColors[rankIdx] }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AnimatedPlayerRow({
  item,
  index,
  rank: rankProp,
  currentUserId,
  truncateName,
  liveMatchPredictionsList,
  side,
  scoreMode,
  showOnlyTotalColumn,
  liveNamesNoShrink,
  onRowPress,
}: {
  item: StandingWithFine;
  index: number;
  rank?: number;
  currentUserId: number | null;
  truncateName: (name: string) => string;
  liveMatchPredictionsList: LeagueMatchPredictionsResponse[];
  side: 'left' | 'middle' | 'right';
  scoreMode?: 'multi' | 'classic';
  showOnlyTotalColumn?: boolean;
  /** Live table: keep full font size; truncate with ellipsis instead of shrinking */
  liveNamesNoShrink?: boolean;
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
  const rank = rankProp ?? index + 1;

  const renderRankIcon = () => {
    if (rank === 1) return <View style={styles.rankIconContainer}><Ionicons name="medal" size={14} color="#D4AF37" /></View>;
    if (rank === 2) return <View style={styles.rankIconContainer}><Ionicons name="medal" size={14} color="#A8A9AD" /></View>;
    if (rank === 3) return <View style={styles.rankIconContainer}><Ionicons name="medal" size={14} color="#AD6F3B" /></View>;
    return (
      <View style={styles.rankIconContainer}>
        <Text
          style={styles.rankNumber}
          numberOfLines={1}
          {...(liveNamesNoShrink
            ? {}
            : { adjustsFontSizeToFit: true, minimumFontScale: 0.7 })}
        >
          {rank}
        </Text>
      </View>
    );
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
                {...(liveNamesNoShrink
                  ? { adjustsFontSizeToFit: true, minimumFontScale: 0.75 }
                  : {})}
              >
                {truncateName((item as any).username ?? item.name ?? 'Player')}
              </Text>
            </View>
            {item.name && item.name !== (item as any).username && (
              <Text style={styles.cellSubName} numberOfLines={1} ellipsizeMode="tail">
                {item.name}
              </Text>
            )}
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
          {scoreMode === 'classic' ? (
            <>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#4b7c5e' }]}>
                  {item.matches_exact_count ?? 0}
                </Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#7a6230' }]}>
                  {item.matches_correct_count ?? 0}
                </Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#7a3535' }]}>
                  {item.matches_wrong_count ?? 0}
                </Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#93c5fd' }]}>{item.matches_points ?? 0}</Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#86efac' }]}>{item.bonus_points ?? 0}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#60a5fa' }]}>{item.matches_points ?? 0}</Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#c084fc' }]}>{groupsPlusThird}</Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#d4a017' }]}>{item.knockout_points ?? 0}</Text>
              </View>
              <View style={styles.colNum}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#4ade80' }]}>{item.bonus_points ?? 0}</Text>
              </View>
              <View style={styles.colFine}>
                <Text style={[styles.cellText, styles.cellCenter, { color: '#ef4444' }]}>
                  {fineVal > 0 ? fineVal : 0}
                </Text>
              </View>
            </>
          )}
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
                (scoreMode === 'classic'
                  ? (item.matches_points ?? 0) + (item.bonus_points ?? 0)
                  : (item.total_points ?? 0)) >= 100 && styles.cellTotalLarge,
                (scoreMode === 'classic'
                  ? (item.matches_points ?? 0) + (item.bonus_points ?? 0)
                  : (item.total_points ?? 0)) >= 1000 && styles.cellTotalXLarge,
                (scoreMode === 'classic'
                  ? (item.matches_points ?? 0) + (item.bonus_points ?? 0)
                  : (item.total_points ?? 0)) < 0 && styles.cellTotalNegative,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}
            >
              {scoreMode === 'classic'
                ? (item.matches_points ?? 0) + (item.bonus_points ?? 0)
                : (item.total_points ?? 0)}
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

interface ColumnLegendModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode: 'classic' | 'multi';
}

function ColumnLegendModal({ visible, onClose, initialMode }: ColumnLegendModalProps) {
  const [activeMode, setActiveMode] = React.useState<'classic' | 'multi'>(initialMode);

  React.useEffect(() => {
    if (visible) setActiveMode(initialMode);
  }, [visible, initialMode]);

  const classicRows = [
    { icon: 'checkmark-circle-outline', color: '#22c55e', label: 'Exact', desc: 'Predicted the exact scoreline' },
    { icon: 'remove-circle-outline', color: '#f59e0b', label: 'Correct', desc: 'Right outcome, wrong score' },
    { icon: 'close-circle-outline', color: '#ef4444', label: 'Wrong', desc: 'Wrong outcome' },
    { icon: 'football-outline', color: '#60a5fa', label: 'Matches', desc: 'Points from match predictions' },
    { icon: 'gift-outline', color: '#4ade80', label: 'Bonus', desc: 'Points from bonus questions' },
    { icon: 'star-outline', color: '#fbbf24', label: 'Total', desc: 'Total points (Matches + Bonus)' },
  ];

  const multiRows = [
    { icon: 'football-outline', color: '#60a5fa', label: 'Matches', desc: 'Points from match predictions' },
    { icon: 'home-outline', color: '#c084fc', label: 'Groups', desc: 'Points from group stage + 3rd place predictions' },
    { icon: 'trophy-outline', color: '#d4a017', label: 'Knockout', desc: 'Points from knockout bracket predictions' },
    { icon: 'gift-outline', color: '#4ade80', label: 'Bonus', desc: 'Points from bonus questions' },
    { icon: 'warning-outline', color: '#ef4444', label: 'Fines', desc: 'Point deductions for prediction changes' },
    { icon: 'star-outline', color: '#fbbf24', label: 'Total', desc: 'Total points (all categories minus fines)' },
  ];

  const rows = activeMode === 'classic' ? classicRows : multiRows;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={legendStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={legendStyles.card} onPress={() => {}}>

          <View style={legendStyles.titleRow}>
            <Ionicons name="information-circle" size={18} color="#94a3b8" />
            <Text style={legendStyles.title}>Column Guide</Text>
          </View>

          <View style={legendStyles.toggleRow}>
            <TouchableOpacity
              style={[
                legendStyles.toggleBtn,
                activeMode === 'classic' && {
                  backgroundColor: 'rgba(56,189,248,0.15)',
                  borderColor: '#38bdf8',
                },
              ]}
              onPress={() => setActiveMode('classic')}
              activeOpacity={0.8}
            >
              <Text style={[
                legendStyles.toggleBtnText,
                activeMode === 'classic' && { color: '#38bdf8', fontWeight: '700' },
              ]}>
                Classic
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                legendStyles.toggleBtn,
                activeMode === 'multi' && {
                  backgroundColor: 'rgba(251,191,36,0.15)',
                  borderColor: '#f59e0b',
                },
              ]}
              onPress={() => setActiveMode('multi')}
              activeOpacity={0.8}
            >
              <Text style={[
                legendStyles.toggleBtnText,
                activeMode === 'multi' && { color: '#f59e0b', fontWeight: '700' },
              ]}>
                Multi
              </Text>
            </TouchableOpacity>
          </View>

          {rows.map((row) => (
            <View key={row.label} style={legendStyles.row}>
              <View style={[legendStyles.iconBox, { backgroundColor: row.color + '22' }]}>
                <Ionicons name={row.icon as any} size={16} color={row.color} />
              </View>
              <View style={legendStyles.rowText}>
                <Text style={[legendStyles.rowLabel, { color: row.color }]}>{row.label}</Text>
                <Text style={legendStyles.rowDesc}>{row.desc}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={legendStyles.closeBtn} onPress={onClose}>
            <Text style={legendStyles.closeBtnText}>Got it</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const legendStyles = StyleSheet.create({
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
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  rowDesc: {
    fontSize: 12,
    color: '#94a3b8',
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

export default function LeagueDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as RouteParams;
  const { getCurrentUserId } = useAuth();
  const { showToast } = useToast();

  const [standingsData, setStandingsData] = useState<LeagueStandingsResponse | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const [page, setPage] = useState(1);
  const [allStandings, setAllStandings] = useState<StandingWithFine[]>([]);
  const [podiumStandings, setPodiumStandings] = useState<StandingWithFine[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentUserEntry, setCurrentUserEntry] = useState<StandingWithFine | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [liveMatchPredictionsList, setLiveMatchPredictionsList] = useState<LeagueMatchPredictionsResponse[]>([]);
  const liveRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveMatchIdsRef = useRef<number[]>([]);
  const flashListRef = useRef<any>(null);
  const scoreModeInitializedRef = useRef(false);
  const skipNextFetchRef = useRef(false);
  const [scoreMode, setScoreMode] = useState<'multi' | 'classic'>('classic');
  const [scoreModeLoading, setScoreModeLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [userDismissedLive, setUserDismissedLive] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const SORT_COLORS: Record<string, string> = {
    exact: '#22c55e',
    correct: '#f59e0b',
    wrong: '#ef4444',
    matches: '#60a5fa',
    groups: '#c084fc',
    knockout: '#d4a017',
    bonus: '#4ade80',
    fine: '#ef4444',
    total: '#fbbf24',
  };

  const handleSortByChange = (newSortBy: SortKey) => {
    if (newSortBy === sortBy) return;
    skipNextFetchRef.current = true;
    setPage(1);
    setSortBy(newSortBy);
    setTimeout(() => {
      fetchStandings(false, 1, newSortBy);
    }, 0);
  };

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

  const fetchStandings = async (append: boolean, pageOverride?: number, sortByOverride?: SortKey, scoreModeOverride?: 'multi' | 'classic') => {
    if (append) {
      setLoadingMore(true);
    }
    const currentPage = pageOverride ?? page;
    const currentSortBy = sortByOverride ?? sortBy;
    try {
      const data = isGlobalLeague
        ? await apiService.getGlobalStandings({ sort_by: currentSortBy, page: currentPage, page_size: PAGE_SIZE })
        : await apiService.getLeagueStandings(Number(leagueId), { sort_by: currentSortBy, page: currentPage, page_size: PAGE_SIZE });

      setStandingsData(data);
      setTotalCount(data.total_count);
      setCurrentUserEntry((data.current_user_entry as StandingWithFine) ?? null);
      const effectiveScoreMode = scoreModeOverride ?? (scoreModeInitializedRef.current ? scoreMode : (data.league_info?.score_mode ?? 'multi'));
      if (!scoreModeInitializedRef.current) {
        const leagueMode = data.league_info?.score_mode;
        if (leagueMode === 'classic') {
          setScoreMode('classic');
          setSortBy('total');
        } else {
          setScoreMode('multi');
        }
        scoreModeInitializedRef.current = true;
      }
      const activeSortKey = sortByOverride ?? sortBy;
      let processedStandings = data.standings as StandingWithFine[];
      if (effectiveScoreMode === 'classic' && activeSortKey === 'total') {
        processedStandings = [...processedStandings].sort((a, b) => {
          const scoreA = (a.matches_points ?? 0) + (a.bonus_points ?? 0);
          const scoreB = (b.matches_points ?? 0) + (b.bonus_points ?? 0);
          return scoreB - scoreA;
        });
      }
      if (!append) {
        processedStandings = processedStandings.map((s, i) => ({ ...s, rank: i + 1 }));
      }
      if (append) {
        setAllStandings((prev) => [...prev, ...processedStandings]);
      } else {
        setAllStandings(processedStandings);
        // Only update podium on total sort, page 1 — podium always shows top 3 by total
        if (currentSortBy === 'total' && currentPage === 1) {
          setPodiumStandings(processedStandings.slice(0, 3));
        }
      }
      await fetchAndSetupLiveMatches();
    } catch (error) {
      console.error('Error fetching standings:', error);
      setErrorModal({
        title: 'Failed to Load',
        message: 'Could not load league standings. Please try again.',
        goBack: true,
      });
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setScoreModeLoading(false);
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
    setPage(1);
    setAllStandings([]);
    await fetchStandings(false, 1);
    setRefreshing(false);
  };

  useEffect(() => {
    setPage(1);
    setAllStandings([]);
    setPodiumStandings([]);
    setSortBy('total');
    setStandingsData(null);
    scoreModeInitializedRef.current = false;
  }, [leagueId]);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchStandings(page !== 1, page);
  }, [leagueId, sortBy, page]);

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

  const truncateName = (name: string) => name;

  const topThree = podiumStandings.length >= 3 ? podiumStandings : allStandings.slice(0, 3);
  const restStandings = allStandings;

  const standingsListData = useMemo(
    (): StandingsListEntry[] => [STANDINGS_TABLE_HEADER, ...allStandings],
    [allStandings]
  );

  if (initialLoading) {
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

  const memberCount = totalCount;
  const effectiveLiveList = isLiveMode ? liveMatchPredictionsList : [];
  const showOnlyTotalColumn = isLiveMode;

  // Fixed widths
  const COL_NUM_W = 30;
  const COL_FINE_W = 30;
  const COL_TOTAL_W = 50;

  const middleWidth = scoreMode === 'classic'
    ? COL_NUM_W * 5           // exact, correct, wrong, matches, bonus
    : COL_NUM_W * 4 + COL_FINE_W; // matches, groups, knockout, bonus, fine

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

          <TouchableOpacity
            style={[styles.infoButton, { right: isGlobalLeague ? 0 : 36 }]}
            onPress={() => setInfoModalVisible(true)}
          >
            <Ionicons name="information-circle" size={22} color="#e2e8f0" />
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
            style={[
              styles.scoreModeBtn,
              scoreMode === 'multi' && {
                backgroundColor: 'rgba(251,191,36,0.18)',
                borderWidth: 1,
                borderColor: '#f59e0b',
              },
            ]}
            onPress={() => {
              if (scoreMode === 'multi') return;
              skipNextFetchRef.current = true;
              setPage(1);
              setAllStandings([]);
              setSortBy('total');
              setScoreMode('multi');
              setScoreModeLoading(true);
              setTimeout(() => fetchStandings(false, 1, 'total', 'multi'), 0);
            }}
          >
            <Text
              style={[
                styles.scoreModeBtnText,
                scoreMode === 'multi' && { color: '#f59e0b', fontWeight: '700' },
              ]}
            >
              Multi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.scoreModeBtn,
              scoreMode === 'classic' && {
                backgroundColor: 'rgba(56,189,248,0.18)',
                borderWidth: 1,
                borderColor: '#38bdf8',
              },
            ]}
            onPress={() => {
              if (scoreMode === 'classic') return;
              skipNextFetchRef.current = true;
              setPage(1);
              setAllStandings([]);
              setSortBy('total');
              setScoreMode('classic');
              setScoreModeLoading(true);
              setTimeout(() => fetchStandings(false, 1, 'total', 'classic'), 0);
            }}
          >
            <Text
              style={[
                styles.scoreModeBtnText,
                scoreMode === 'classic' && { color: '#38bdf8', fontWeight: '700' },
              ]}
            >
              Classic
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.tableSection, { maxWidth: 520, alignSelf: 'center', width: '100%' }]}>
          <FlashList
            drawDistance={800}
            maintainVisibleContentPosition={{ disabled: true }}
            key={String(leagueId) + '-' + scoreMode + '-' + String(isLiveMode)}
            ref={flashListRef}
            data={standingsListData}
            extraData={sortBy + scoreMode + String(page)}
            keyExtractor={(item) => (isStandingsTableHeaderRow(item) ? '__standings_header' : String(item.user_id))}
            getItemType={(item) => (isStandingsTableHeaderRow(item) ? 'header' : 'row')}
            onEndReached={() => {
              if (!loadingMore && allStandings.length < totalCount) {
                setPage((p) => p + 1);
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator color="#fff" style={{ padding: 12 }} /> : null}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ffffff"
              />
            }
            stickyHeaderIndices={[0]}
            ListHeaderComponent={
              <>
                {topThree.length >= 3 && (
                  <PodiumSection
                    topThree={topThree}
                    currentUserId={currentUserId}
                    truncateName={truncateName}
                    scoreMode={scoreMode}
                    scoreModeLoading={scoreModeLoading}
                    onPressPlayer={(userId, username) =>
                      (navigation as any).navigate('PublicProfile', { userId, username })
                    }
                  />
                )}

                {topThree.length < 3 && topThree.length > 0 && (
                  <View style={[styles.podiumSection, { maxWidth: 520, alignSelf: 'center', width: '100%' }]}>
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
                              {truncateName((item as any).username ?? item.name ?? 'Player')}
                            </Text>
                            <Text style={styles.podiumPts}>{item.total_points ?? 0}</Text>
                          </View>
                          <View style={[styles.podiumStageBar, { backgroundColor: stageColors[idx] ?? '#A8A9AD' }]} />
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            }
            renderItem={({ item, index }) => {
              if (isStandingsTableHeaderRow(item)) {
                return (
                  <View style={[styles.tableRowContainer, isLiveMode && styles.tableRowContainerLive]}>
                    <View style={[styles.tableFixedLeft, isLiveMode && styles.tableFixedLeftLive]}>
                      <View style={[styles.tableHeader, { height: 46, backgroundColor: '#334155' }]}>
                        <View style={styles.colPlayer}>
                          <Text style={[styles.headerCell, styles.cellLeft]}>Rank</Text>
                        </View>
                      </View>
                    </View>
                    {!isLiveMode && (
                      <View style={[styles.tableScrollMiddle, styles.tableMiddleFixed, { width: middleWidth }]}>
                        <View style={[styles.tableHeader, styles.tableHeaderMiddle, { height: 46, backgroundColor: '#334155' }]}>
                          {scoreMode === 'classic' ? (
                            <>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} activeOpacity={0.7} onPress={() => handleSortByChange('exact')}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'exact' ? 'checkmark-circle' : 'checkmark-circle-outline'} size={14} color={sortBy === 'exact' ? SORT_COLORS.exact : SORT_COLORS.exact + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'exact' ? SORT_COLORS.exact : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} activeOpacity={0.7} onPress={() => handleSortByChange('correct')}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'correct' ? 'remove-circle' : 'remove-circle-outline'} size={14} color={sortBy === 'correct' ? SORT_COLORS.correct : SORT_COLORS.correct + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'correct' ? SORT_COLORS.correct : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} activeOpacity={0.7} onPress={() => handleSortByChange('wrong')}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'wrong' ? 'close-circle' : 'close-circle-outline'} size={14} color={sortBy === 'wrong' ? SORT_COLORS.wrong : SORT_COLORS.wrong + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'wrong' ? SORT_COLORS.wrong : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('matches')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'matches' ? 'football' : 'football-outline'} size={14} color={sortBy === 'matches' ? SORT_COLORS.matches : SORT_COLORS.matches + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'matches' ? SORT_COLORS.matches : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('bonus')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'bonus' ? 'gift' : 'gift-outline'} size={14} color={sortBy === 'bonus' ? SORT_COLORS.bonus : SORT_COLORS.bonus + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'bonus' ? SORT_COLORS.bonus : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('matches')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'matches' ? 'football' : 'football-outline'} size={14} color={sortBy === 'matches' ? SORT_COLORS.matches : SORT_COLORS.matches + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'matches' ? SORT_COLORS.matches : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('groups')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'groups' ? 'home' : 'home-outline'} size={14} color={sortBy === 'groups' ? SORT_COLORS.groups : SORT_COLORS.groups + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'groups' ? SORT_COLORS.groups : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('knockout')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'knockout' ? 'trophy' : 'trophy-outline'} size={14} color={sortBy === 'knockout' ? SORT_COLORS.knockout : SORT_COLORS.knockout + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'knockout' ? SORT_COLORS.knockout : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colNum, styles.headerIconCell]} onPress={() => handleSortByChange('bonus')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'bonus' ? 'gift' : 'gift-outline'} size={14} color={sortBy === 'bonus' ? SORT_COLORS.bonus : SORT_COLORS.bonus + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'bonus' ? SORT_COLORS.bonus : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.colFine, styles.headerIconCell]} onPress={() => handleSortByChange('fine')} activeOpacity={0.7}>
                                <View style={styles.headerIconWrapper}>
                                  <Ionicons name={sortBy === 'fine' ? 'warning' : 'warning-outline'} size={14} color={sortBy === 'fine' ? SORT_COLORS.fine : SORT_COLORS.fine + '55'} />
                                  <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'fine' ? SORT_COLORS.fine : 'transparent' }]} />
                                </View>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    )}
                    <View
                      style={[
                        styles.tableFixedRight,
                        { flex: isLiveMode ? 1 : undefined, backgroundColor: '#0f172a' },
                        isLiveMode && styles.tableFixedRightLive,
                      ]}
                    >
                      <View style={[styles.tableHeader, styles.tableHeaderRight, { height: 46, backgroundColor: '#334155' }, showOnlyTotalColumn && { justifyContent: 'flex-end' }]}>
                        {effectiveLiveList.map((liveData) => (
                          <View key={liveData.match_id} style={[styles.colLive, styles.headerIconCell]}>
                            <LiveHeaderCell liveMatchPredictions={liveData} />
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[styles.colTotal, styles.headerIconCell]}
                          onPress={() => handleSortByChange('total')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.headerIconWrapper}>
                            <Ionicons
                              name={sortBy === 'total' ? 'star' : 'star-outline'}
                              size={14}
                              color={sortBy === 'total' ? SORT_COLORS.total : SORT_COLORS.total + '55'}
                            />
                            <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'total' ? SORT_COLORS.total : 'transparent' }]} />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }
              const row = item as StandingWithFine;
              const rowIndex = index - 1;
              return (
              <View style={[styles.tableRowContainer, isLiveMode && styles.tableRowContainerLive]}>
                <View style={[styles.tableFixedLeft, isLiveMode && styles.tableFixedLeftLive]}>
                  <AnimatedPlayerRow
                    item={row}
                    index={rowIndex}
                    rank={row.rank}
                    currentUserId={currentUserId}
                    truncateName={truncateName}
                    liveMatchPredictionsList={liveMatchPredictionsList}
                    side="left"
                    scoreMode={scoreMode}
                    liveNamesNoShrink={isLiveMode}
                    onRowPress={() => (navigation as any).navigate('PublicProfile', { userId: row.user_id, username: row.username || row.name || `User ${row.user_id}` })}
                  />
                </View>
                {!isLiveMode && (
                  <View style={[styles.tableMiddleFixed, { width: middleWidth, backgroundColor: '#0f172a' }]}>
                    <AnimatedPlayerRow
                      item={row}
                      index={rowIndex}
                      rank={row.rank}
                      currentUserId={currentUserId}
                      truncateName={truncateName}
                      liveMatchPredictionsList={liveMatchPredictionsList}
                      side="middle"
                      scoreMode={scoreMode}
                      onRowPress={() => (navigation as any).navigate('PublicProfile', { userId: row.user_id, username: row.username || row.name || `User ${row.user_id}` })}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.tableFixedRight,
                    { flex: isLiveMode ? 1 : undefined, backgroundColor: '#0f172a' },
                    isLiveMode && styles.tableFixedRightLive,
                  ]}
                >
                  <AnimatedPlayerRow
                    item={row}
                    index={rowIndex}
                    rank={row.rank}
                    currentUserId={currentUserId}
                    truncateName={truncateName}
                    liveMatchPredictionsList={effectiveLiveList}
                    side="right"
                    scoreMode={scoreMode}
                    showOnlyTotalColumn={showOnlyTotalColumn}
                    onRowPress={() => (navigation as any).navigate('PublicProfile', { userId: row.user_id, username: row.username || row.name || `User ${row.user_id}` })}
                  />
                </View>
              </View>
            );
            }}
            style={StyleSheet.flatten([styles.tableBody, { flex: 1 }])}
            contentContainerStyle={styles.tableBodyContent}
          />

          {currentUserEntry && currentUserEntry.rank != null && currentUserEntry.rank > 3 && (
            <View style={[styles.stickyUserRow, isLiveMode && styles.tableRowContainerLive]}>
              <View
                style={[
                  styles.tableFixedLeft,
                  { backgroundColor: '#1a2744' },
                  isLiveMode && styles.tableFixedLeftLive,
                ]}
              >
                <View style={[styles.playerRow, styles.playerRowContent, { minHeight: 52, borderBottomWidth: 0 }]}>
                  <View style={styles.colPlayer}>
                    <View style={styles.rankNameRow}>
                      <View style={styles.rankIconContainer}>
                        <Text
                          style={styles.stickyRankNumber}
                          numberOfLines={1}
                          {...(isLiveMode
                            ? {}
                            : { adjustsFontSizeToFit: true, minimumFontScale: 0.7 })}
                        >
                          {currentUserEntry.rank}
                        </Text>
                      </View>
                      <Text
                        style={[styles.cellName, styles.cellLeft, styles.cellBold]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {truncateName((currentUserEntry as any).username ?? currentUserEntry.name ?? 'You')}
                      </Text>
                    </View>
                    {currentUserEntry.name && currentUserEntry.name !== (currentUserEntry as any).username && (
                      <Text style={styles.cellSubName} numberOfLines={1} ellipsizeMode="tail">
                        {currentUserEntry.name}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {!isLiveMode && (
              <View style={[styles.tableScrollMiddle, styles.tableMiddleFixed, { width: middleWidth }]}>
                <View style={[styles.playerRow, styles.playerRowContent, { minHeight: 52, borderBottomWidth: 0, paddingHorizontal: 0, backgroundColor: '#1a2744' }]}>
                  {scoreMode === 'classic' ? (
                    <>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#4b7c5e' }]}>
                          {currentUserEntry.matches_exact_count ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#7a6230' }]}>
                          {currentUserEntry.matches_correct_count ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#7a3535' }]}>
                          {currentUserEntry.matches_wrong_count ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#93c5fd' }]}>
                          {currentUserEntry.matches_points ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#86efac' }]}>
                          {currentUserEntry.bonus_points ?? 0}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#60a5fa' }]}>
                          {currentUserEntry.matches_points ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#c084fc' }]}>
                          {(currentUserEntry.groups_points ?? 0) + (currentUserEntry.third_place_points ?? 0)}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#d4a017' }]}>
                          {currentUserEntry.knockout_points ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#4ade80' }]}>
                          {currentUserEntry.bonus_points ?? 0}
                        </Text>
                      </View>
                      <View style={styles.colFine}>
                        <Text style={[styles.cellText, styles.cellCenter, { color: '#ef4444' }]}>
                          {(currentUserEntry.penalty ?? 0) > 0 ? (currentUserEntry.penalty ?? 0) : 0}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
              )}
              <View
                style={[
                  styles.tableFixedRight,
                  styles.stickyUserRowRight,
                  { flex: isLiveMode ? 1 : undefined, backgroundColor: '#1a2744' },
                  isLiveMode && styles.tableFixedRightLive,
                ]}
              >
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
                      const memberPred = liveData.predictions.find((p) => p.user_id === currentUserEntry.user_id) ?? null;
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
                          {scoreMode === 'classic'
                            ? (currentUserEntry.matches_points ?? 0) + (currentUserEntry.bonus_points ?? 0)
                            : (currentUserEntry.total_points ?? 0)}
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
      <ColumnLegendModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        initialMode={scoreMode}
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
  infoButton: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  scoreModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 17,
  },
  scoreModeBtn_multi_active: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  scoreModeBtn_classic_active: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  scoreModeBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  scoreModeBtnText_multi_active: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  scoreModeBtnText_classic_active: {
    color: '#38bdf8',
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
    paddingHorizontal: 0,
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
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    textAlign: 'center',
    width: '100%',
  },
  playerRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  colPlayer: {
    flex: 1,
    paddingLeft: 8,
  },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  /** Bounds name Text so ellipsis works; keeps stat columns aligned with header on narrow screens */
  playerNameTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  cellSubName: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    marginLeft: 30,
  },
  podiumSubName: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  rankIconContainer: {
    minWidth: 24,
    width: 'auto',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 1,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
    width: '100%',
  },
  colNum: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colFine: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLive: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colClassicNum: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colTotal: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 4,
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
    borderColor: '#a855f7',
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
    alignSelf: 'stretch',
    width: '100%',
  },
  tableRowContainerLive: {
    position: 'relative',
  },
  tableFixedLeft: {
    flex: 1,
    minWidth: 0,
    maxWidth: 520,
    overflow: 'hidden',
  },
  /** Live mode: names column stays behind; keep narrow so match columns get space */
  tableFixedLeftLive: {
    zIndex: 0,
    elevation: 0,
    flex: 0,
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 168,
    maxWidth: 210,
    minWidth: 88,
  },
  /** Live mode: scores + total draw above the name column so pills are not clipped */
  tableFixedRightLive: {
    zIndex: 2,
    elevation: 4,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  tableScrollMiddle: {
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  tableMiddleFixed: {
    flexShrink: 0,
  },
  tableScrollMiddleContent: {
    flexGrow: 1,
  },
  tableHeaderMiddle: {
    backgroundColor: '#334155',
  },
  tableHeaderRight: {
    paddingHorizontal: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 0,
  },
  tableFixedRight: {
    width: 74,
    overflow: 'hidden',
    flexShrink: 0,
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
    width: 46,
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 2,
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
