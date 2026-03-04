import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService, LeagueStanding, LeagueStandingsResponse } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';
import { LeaveLeagueModal } from '../components/CustomModals';

type SortKey = 'total' | 'matches' | 'groups' | 'knockout' | 'penalty';

interface RouteParams {
  leagueId: string | number;
}

// Extended standing with optional penalty (API may not return it yet)
interface StandingWithPenalty extends LeagueStanding {
  penalty?: number;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'matches', label: 'Matches' },
  { key: 'groups', label: 'Groups' },
  { key: 'knockout', label: 'K/O' },
  { key: 'penalty', label: 'Pen' },
];

const PODIUM_MEDAL_CONFIG = [
  { size: 36, color: '#D4AF37' },
  { size: 32, color: '#A8A9AD' },
  { size: 32, color: '#AD6F3B' },
];

function PodiumSection({
  topThree,
  currentUserId,
  truncateName,
}: {
  topThree: StandingWithPenalty[];
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
}: {
  item: StandingWithPenalty;
  index: number;
  currentUserId: number | null;
  truncateName: (name: string) => string;
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
  const penaltyVal = item.penalty ?? 0;
  const groupsPlusThird = (item.groups_points ?? 0) + (item.third_place_points ?? 0);
  const rowBg = index % 2 === 0 ? '#0f172a' : '#111827';
  const rank = index + 1;

  const renderRankIcon = () => {
    if (rank === 1) return <Ionicons name="medal" size={14} color="#D4AF37" />;
    if (rank === 2) return <Ionicons name="medal" size={14} color="#A8A9AD" />;
    if (rank === 3) return <Ionicons name="medal" size={14} color="#AD6F3B" />;
    return <Text style={styles.rankNumber}>{rank}</Text>;
  };

  return (
    <Animated.View
      style={[
        styles.playerRow,
        { backgroundColor: rowBg },
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
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{item.matches_points ?? 0}</Text>
        </View>
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{groupsPlusThird}</Text>
        </View>
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{item.knockout_points ?? 0}</Text>
        </View>
        <View style={styles.colPen}>
          {penaltyVal > 0 ? (
            <View style={styles.penaltyBadge}>
              <Text style={styles.penaltyBadgeText}>{penaltyVal}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.colTotal}>
          <View style={[styles.ptsBadge, isCurrentUser && styles.ptsBadgeCurrentUser]}>
            <Text
              style={[
                styles.cellTotal,
                styles.cellCenter,
                isCurrentUser && styles.cellBold,
                (item.total_points ?? 0) >= 100 && styles.cellTotalLarge,
                (item.total_points ?? 0) >= 1000 && styles.cellTotalXLarge,
                (item.total_points ?? 0) < 0 && styles.cellTotalNegative,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}
            >
              {item.total_points ?? 0}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LeagueDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as RouteParams;
  const { getCurrentUserId } = useAuth();

  const [standingsData, setStandingsData] = useState<LeagueStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isGlobalLeague = leagueId === 'global';
  const currentUserId = getCurrentUserId();

  const fetchStandings = async () => {
    try {
      let data: LeagueStandingsResponse;

      if (isGlobalLeague) {
        data = await apiService.getGlobalStandings();
      } else {
        data = await apiService.getLeagueStandings(Number(leagueId));
      }

      setStandingsData(data);
    } catch (error) {
      console.error('Error fetching standings:', error);
      Alert.alert('Error', 'Failed to load league standings');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStandings();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStandings();
  }, [leagueId]);

  const leagueName = !standingsData ? 'League' : (isGlobalLeague ? 'Global League' : standingsData.league_info?.name || 'League');

  const handleCopyInviteCode = async () => {
    if (standingsData?.league_info?.invite_code) {
      await Clipboard.setStringAsync(standingsData.league_info.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleLeaveLeague = () => {
    setMenuVisible(false);
    const id = Number(leagueId);
    if (isNaN(id)) {
      Alert.alert('Error', 'Invalid league');
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
      Alert.alert('Error', 'Failed to leave league. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  const sortedStandings = useMemo(() => {
    if (!standingsData?.standings) return [];
    const standings = [...standingsData.standings] as StandingWithPenalty[];
    const penalty = (s: StandingWithPenalty) => s.penalty ?? 0;
    const groupsPlusThird = (s: StandingWithPenalty) =>
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
        case 'penalty':
          return penalty(a) - penalty(b);
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

  const renderPlayerRow = ({ item, index }: { item: StandingWithPenalty; index: number }) => (
    <AnimatedPlayerRow
      item={item}
      index={index}
      currentUserId={currentUserId}
      truncateName={truncateName}
    />
  );

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
      </SafeAreaView>
    );
  }

  const memberCount = standingsData.standings.length;

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
              <TouchableOpacity
                style={styles.invitePill}
                onPress={handleCopyInviteCode}
              >
                <Text style={styles.invitePillText}>{standingsData.league_info.invite_code}</Text>
                <Ionicons name="copy-outline" size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, sortBy === key && styles.filterChipActive]}
              onPress={() => setSortBy(key)}
            >
              <Text style={[styles.filterChipText, sortBy === key && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
          <View style={styles.tableHeader}>
            <View style={styles.colPlayer}>
              <Text style={[styles.headerCell, styles.cellLeft]}>Rank</Text>
            </View>
            <View style={[styles.colNum, styles.headerIconCell]}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="football-outline" size={14} color={sortBy === 'matches' ? '#ffffff' : '#94a3b8'} />
                <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'matches' ? '#ffffff' : 'transparent' }]} />
              </View>
            </View>
            <View style={[styles.colNum, styles.headerIconCell]}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="home-outline" size={14} color={sortBy === 'groups' ? '#ffffff' : '#94a3b8'} />
                <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'groups' ? '#ffffff' : 'transparent' }]} />
              </View>
            </View>
            <View style={[styles.colNum, styles.headerIconCell]}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="trophy-outline" size={14} color={sortBy === 'knockout' ? '#ffffff' : '#94a3b8'} />
                <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'knockout' ? '#ffffff' : 'transparent' }]} />
              </View>
            </View>
            <View style={[styles.colPen, styles.headerIconCell]}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="warning-outline" size={14} color={sortBy === 'penalty' ? '#ef4444' : 'rgba(239,68,68,0.4)'} />
                <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'penalty' ? '#ef4444' : 'transparent' }]} />
              </View>
            </View>
            <View style={[styles.colTotal, styles.headerIconCell]}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="star-outline" size={14} color={sortBy === 'total' ? '#fbbf24' : 'rgba(251,191,36,0.4)'} />
                <View style={[styles.headerIconUnderline, { backgroundColor: sortBy === 'total' ? '#fbbf24' : 'transparent' }]} />
              </View>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={restStandings}
            keyExtractor={(item) => item.user_id.toString()}
            renderItem={renderPlayerRow}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ffffff"
              />
            }
            style={styles.tableBody}
            contentContainerStyle={styles.tableBodyContent}
            showsVerticalScrollIndicator={true}
        />

        {currentUserStanding && currentUserRank && currentUserRank > 3 && (
          <View style={styles.stickyUserRow}>
            <View style={styles.playerRowContent}>
              <View style={styles.colPlayer}>
                <View style={styles.rankNameRow}>
                  <Text style={styles.stickyRankNumber}>{currentUserRank}</Text>
                  <Text style={[styles.cellName, styles.cellLeft, styles.cellBold]} numberOfLines={1}>
                    {truncateName(currentUserStanding.name ?? (currentUserStanding as any).username ?? 'You')}
                  </Text>
                </View>
              </View>
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
              <View style={styles.colPen}>
                {(currentUserStanding.penalty ?? 0) > 0 && (
                  <View style={styles.penaltyBadge}>
                    <Text style={styles.penaltyBadgeText}>
                      {currentUserStanding.penalty}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.colTotal}>
                <View style={[styles.ptsBadge, styles.ptsBadgeCurrentUser]}>
                  <Text style={[styles.cellTotal, styles.cellCenter, styles.cellBold]}>
                    {currentUserStanding.total_points ?? 0}
                  </Text>
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
  filterScroll: {
    maxHeight: 48,
    marginBottom: 8,
  },
  filterScrollContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#ffffff',
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
  },
  stickyUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: '#1a2744',
    borderTopWidth: 2,
    borderTopColor: '#3b82f6',
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
    minWidth: 80,
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
  colPen: {
    width: 32,
  },
  colTotal: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
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
  penaltyBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  penaltyBadgeText: {
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
