import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MatchCard from '../components/cards/MatchCard';
import {
  getUserProfile,
  getUserMatchPredictions,
  getUserGroupPredictions,
  getUserThirdPlacePredictions,
  getUserKnockoutPredictions,
  UserProfileView,
  UserMatchPredictionsView,
  UserGroupPredictionsView,
  UserThirdPlacePredictionsView,
  UserKnockoutPredictionsView,
  Match,
  GroupPrediction,
  KnockoutPrediction,
} from '../services/api';
import { ErrorModal } from '../components/modals/CustomModals';

type TabKey = 'matches' | 'groups' | 'third' | 'knockout';

interface RouteParams {
  userId: number;
  username: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'matches', label: 'Matches' },
  { key: 'groups', label: 'Groups' },
  { key: 'third', label: '3rd Place' },
  { key: 'knockout', label: 'Knockout' },
];

const POSITION_COLORS: Record<number, string> = {
  1: '#D4AF37', // gold
  2: '#A8A9AD', // silver
  3: '#AD6F3B', // bronze
  4: '#94a3b8', // gray
};

const STAGE_ORDER = ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'];

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { userId, username } = route.params as RouteParams;

  const [profileData, setProfileData] = useState<UserProfileView | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tabData, setTabData] = useState<Record<TabKey, any>>({
    matches: null,
    groups: null,
    third: null,
    knockout: null,
  });
  const [loadingTabs, setLoadingTabs] = useState<Record<TabKey, boolean>>({
    matches: false,
    groups: false,
    third: false,
    knockout: false,
  });
  const [activeTab, setActiveTab] = useState<TabKey>('matches');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setProfileLoading(true);
        setProfileError(null);
        const data = await getUserProfile(userId);
        if (!cancelled) setProfileData(data);
      } catch (e) {
        if (!cancelled) setProfileError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const fetchTabData = useCallback(async (tab: TabKey) => {
    if (tabData[tab] !== null) return;
    setLoadingTabs((prev) => ({ ...prev, [tab]: true }));
    try {
      let data: any;
      switch (tab) {
        case 'matches':
          data = await getUserMatchPredictions(userId);
          break;
        case 'groups':
          data = await getUserGroupPredictions(userId);
          break;
        case 'third':
          data = await getUserThirdPlacePredictions(userId);
          break;
        case 'knockout':
          data = await getUserKnockoutPredictions(userId);
          break;
        default:
          return;
      }
      setTabData((prev) => ({ ...prev, [tab]: data }));
    } catch (e) {
      console.warn(`Failed to fetch ${tab} data:`, e);
    } finally {
      setLoadingTabs((prev) => ({ ...prev, [tab]: false }));
    }
  }, [userId, tabData]);

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    fetchTabData(tab);
  }, [fetchTabData]);

  useEffect(() => {
    fetchTabData('matches');
  }, [fetchTabData]);

  const formatScore = (v: number | null | undefined) =>
    v != null ? String(v) : '—';

  const noop = useCallback(() => {}, []);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {username ? `${username}'s Results` : 'Results'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
    </View>
  );

  const renderScoreBar = () => {
    const p = profileData;
    const penalty = p?.penalty ?? 0;

    return (
      <View style={styles.scoreCard}>
        <View style={styles.scoreTotalBlock}>
          <Text style={styles.scoreTotalLabel}>Total Score</Text>
          <Text style={styles.scoreTotalValue}>{formatScore(p?.total_points)}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreBreakdownRow}>
          {[
            { label: 'Matches', value: p?.matches_score },
            { label: 'Groups', value: p?.groups_score },
            { label: '3rd', value: p?.third_place_score },
            { label: 'Knockout', value: p?.knockout_score },
          ].map(({ label, value }) => (
            <View key={label} style={styles.scoreBreakdownItem}>
              <Text style={styles.scoreBreakdownLabel}>{label}</Text>
              <Text style={styles.scoreBreakdownValue}>{formatScore(value)}</Text>
            </View>
          ))}
          {penalty !== 0 && (
            <View style={styles.scoreBreakdownItem}>
              <Text style={[styles.scoreBreakdownLabel, { color: '#ef4444' }]}>Fine</Text>
              <Text style={[styles.scoreBreakdownValue, { color: '#ef4444' }]}>
                {Math.abs(penalty)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {TABS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.tab, activeTab === key && styles.tabActive]}
          onPress={() => handleTabPress(key)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === key ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            {label}
          </Text>
          {activeTab === key && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMatchesTab = () => {
    const data = tabData.matches as UserMatchPredictionsView | null;
    const loading = loadingTabs.matches;

    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    const matches = data?.matches ?? [];
    if (matches.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="football-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>No completed matches yet</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onScoreChange={noop}
            onInputFocus={noop}
          />
        )}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderGroupsTab = () => {
    const data = tabData.groups as UserGroupPredictionsView | null;
    const loading = loadingTabs.groups;

    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    const groups = data?.groups ?? [];
    if (groups.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="people-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Group results not available yet</Text>
        </View>
      );
    }

    const getTeamById = (g: GroupPrediction, teamId: number) =>
      g.teams.find((t) => t.id === teamId);
    const getActualPosition = (g: GroupPrediction, teamId: number): number | null => {
      if (!g.result) return null;
      if (g.result.first_place === teamId) return 1;
      if (g.result.second_place === teamId) return 2;
      if (g.result.third_place === teamId) return 3;
      if (g.result.fourth_place === teamId) return 4;
      return null;
    };
    const getBadgeColor = (g: GroupPrediction, teamId: number | undefined, pos: number): string => {
      if (!g.result || !teamId) return POSITION_COLORS[pos] ?? '#94a3b8';
      const actual = getActualPosition(g, teamId);
      const isCorrect = actual !== null && actual === pos;
      return isCorrect ? '#16a34a' : '#ef4444';
    };

    return (
      <FlatList
        data={groups}
        keyExtractor={(item) => `group-${item.group_id}`}
        renderItem={({ item: g }) => {
          const hasPrediction = g.first_place != null || g.second_place != null;
          if (!hasPrediction) {
            return (
              <View style={styles.groupBlock}>
                <Text style={styles.groupBlockTitle}>Group {g.group_name}</Text>
                <Text style={styles.noPredictionText}>No prediction made</Text>
              </View>
            );
          }
          const teamIds: number[] = [
            g.first_place,
            g.second_place,
            g.third_place,
            g.fourth_place,
          ].filter((id): id is number => id != null);
          return (
            <View style={styles.groupBlock}>
              <View style={styles.groupBlockHeader}>
                <Text style={styles.groupBlockTitle}>Group {g.group_name}</Text>
                {g.points != null && (
                  <View
                    style={[
                      styles.groupScoreBadge,
                      { backgroundColor: g.points === 0 ? '#ef4444' : '#16a34a' },
                    ]}
                  >
                    <Text style={styles.groupScoreBadgeText}>{g.points} pts</Text>
                  </View>
                )}
              </View>
              {[1, 2, 3, 4].map((pos) => {
                const teamId = teamIds[pos - 1];
                const team = teamId ? getTeamById(g, teamId) : null;
                return (
                  <View key={pos} style={styles.groupRow}>
                    <View
                      style={[
                        styles.positionBadge,
                        { backgroundColor: getBadgeColor(g, teamId, pos) },
                      ]}
                    >
                      <Text style={styles.positionBadgeText}>{pos}</Text>
                    </View>
                    {team ? (
                      <>
                        {team.flag_url && (
                          <Image
                            source={{ uri: team.flag_url }}
                            style={styles.teamFlag}
                          />
                        )}
                        <Text style={styles.teamName}>{team.name}</Text>
                      </>
                    ) : (
                      <Text style={styles.teamNamePlaceholder}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        }}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderThirdPlaceTab = () => {
    const data = tabData.third as UserThirdPlacePredictionsView | null;
    const loading = loadingTabs.third;

    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    if (!data?.available) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>3rd place results not available yet</Text>
        </View>
      );
    }

    const eligibleTeams = data.eligible_teams ?? [];
    const selectedTeams = eligibleTeams.filter((t: any) => t.is_selected);

    if (selectedTeams.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>No picks made yet</Text>
        </View>
      );
    }
    const resultGroups: Set<string> = new Set(
      (data.result?.result_groups ?? []).filter((g: string | null) => g != null)
    );

    const isCorrect = (team: any) => resultGroups.has(team.group_name);

    const cardWidth = (width - 32 - 24) / 4;

    return (
      <ScrollView
        style={styles.thirdPlaceScroll}
        contentContainerStyle={styles.thirdPlaceGrid}
        showsVerticalScrollIndicator={false}
      >
        {selectedTeams.slice(0, 8).map((team: any) => (
          <View key={team.id} style={[styles.thirdPlaceCard, { width: cardWidth }]}>
            <Text style={styles.thirdPlaceGroupName}>{team.group_name}</Text>
            {team.flag_url && (
              <Image source={{ uri: team.flag_url }} style={styles.thirdPlaceFlag} />
            )}
            <View style={styles.thirdPlaceNameContainer}>
              <Text
                style={styles.thirdPlaceTeamName}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {team.name}
              </Text>
            </View>
            <View style={styles.thirdPlaceIconSlot}>
              {resultGroups.size > 0 && (
                <Ionicons
                  name={isCorrect(team) ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isCorrect(team) ? '#16a34a' : '#ef4444'}
                />
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderKnockoutTab = () => {
    const data = tabData.knockout as UserKnockoutPredictionsView | null;
    const loading = loadingTabs.knockout;

    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    const predictions = data?.predictions ?? [];
    if (predictions.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>No knockout results yet</Text>
        </View>
      );
    }

    const byStage = predictions.reduce<Record<string, KnockoutPrediction[]>>(
      (acc, p) => {
        const s = p.stage || 'other';
        if (!acc[s]) acc[s] = [];
        acc[s].push(p);
        return acc;
      },
      {}
    );

    const sortedStages = STAGE_ORDER.filter((s) => (byStage[s]?.length ?? 0) > 0);

    const getStatusIcon = (status: string): { name: string; color: string } => {
      switch (status) {
        case 'correct_full':
          return { name: 'checkmark-circle', color: '#16a34a' };
        case 'correct_partial':
          return { name: 'remove-circle', color: '#eab308' };
        case 'incorrect':
          return { name: 'close-circle', color: '#ef4444' };
        default:
          return { name: 'help-circle', color: '#94a3b8' };
      }
    };

    return (
      <FlatList
        data={sortedStages}
        keyExtractor={(s) => s}
        renderItem={({ item: stage }) => (
          <View style={styles.knockoutStage}>
            <Text style={styles.knockoutStageTitle}>
              {stage === 'round32' ? 'Round 32' : stage === 'round16' ? 'Round 16' : stage === 'third_place' ? 'Third Place' : stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, ' ')}
            </Text>
            {(byStage[stage] ?? []).map((p) => (
              <View key={p.id} style={styles.knockoutCard}>
                <View style={styles.knockoutTeamLeft}>
                  <Image
                    source={{ uri: p.team1_flag ?? 'https://flagcdn.com/w80/xx.png' }}
                    style={styles.knockoutFlag}
                  />
                  <Text
                    style={[
                      styles.knockoutTeamName,
                      p.winner_team_id === p.team1_id && styles.knockoutWinner,
                    ]}
                    numberOfLines={1}
                  >
                    {p.team1_name ?? 'TBD'}
                  </Text>
                </View>
                <Text style={styles.knockoutVs}>vs</Text>
                <View style={styles.knockoutTeamRight}>
                  <Text
                    style={[
                      styles.knockoutTeamName,
                      styles.knockoutTeamNameRight,
                      p.winner_team_id === p.team2_id && styles.knockoutWinner,
                    ]}
                    numberOfLines={1}
                  >
                    {p.team2_name ?? 'TBD'}
                  </Text>
                  <Image
                    source={{ uri: p.team2_flag ?? 'https://flagcdn.com/w80/xx.png' }}
                    style={styles.knockoutFlag}
                  />
                </View>
                {(() => {
                  const icon = getStatusIcon(p.status);
                  return (
                    <View style={styles.knockoutStatusIcon}>
                      <Ionicons name={icon.name as any} size={28} color={icon.color} />
                    </View>
                  );
                })()}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return renderMatchesTab();
      case 'groups':
        return renderGroupsTab();
      case 'third':
        return renderThirdPlaceTab();
      case 'knockout':
        return renderKnockoutTab();
      default:
        return null;
    }
  };

  if (profileError) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{profileError}</Text>
        </View>
        <ErrorModal
          visible={!!profileError}
          title="Error"
          message={profileError}
          onClose={() => setProfileError(null)}
          onGoBack={() => navigation.goBack()}
          goBackLabel="Go Back"
        />
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      {renderHeader()}
      {renderScoreBar()}
      {renderTabBar()}
      <View style={styles.tabContent}>{renderTabContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  scoreTotalBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreTotalLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreTotalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
  },
  scoreDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 10,
  },
  scoreBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreBreakdownItem: {
    alignItems: 'center',
  },
  scoreBreakdownLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  scoreBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#16a34a',
  },
  tabLabelInactive: {
    color: '#94a3b8',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#16a34a',
    borderRadius: 1,
  },
  tabContent: {
    flex: 1,
    marginTop: 12,
  },
  tabLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  groupBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  groupBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  groupScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  groupScoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  noPredictionText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  teamFlag: {
    width: 24,
    height: 18,
    marginRight: 8,
    borderRadius: 2,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  teamNamePlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  thirdPlaceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    height: 130,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  thirdPlaceFlag: {
    width: 44,
    height: 33,
    borderRadius: 4,
  },
  thirdPlaceGroupName: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  thirdPlaceNameContainer: {
    height: 30,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thirdPlaceTeamName: {
    fontSize: 11,
    color: '#1e293b',
    textAlign: 'center',
  },
  thirdPlaceIconSlot: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thirdPlaceScroll: {
    flex: 1,
  },
  thirdPlaceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  knockoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  knockoutTeamLeft: {
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  knockoutTeamRight: {
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  knockoutVs: {
    width: 26,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  knockoutFlag: {
    width: 26,
    height: 20,
    borderRadius: 2,
    flexShrink: 0,
  },
  knockoutTeamName: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },
  knockoutTeamNameRight: {
    textAlign: 'right',
  },
  knockoutWinner: {
    color: '#16a34a',
    fontWeight: '700',
  },
  knockoutStatusIcon: {
    width: 32,
    alignItems: 'center',
    marginLeft: 0,
  },
  knockoutStage: {
    marginBottom: 20,
  },
  knockoutStageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
  },
});
