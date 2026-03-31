import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getUserBonusPrediction,
  UserProfileView,
  UserMatchPredictionsView,
  UserGroupPredictionsView,
  UserThirdPlacePredictionsView,
  UserKnockoutPredictionsView,
  Match,
  GroupPrediction,
  KnockoutPrediction,
  BonusPrediction,
} from '../services/api';
import { ErrorModal } from '../components/modals/CustomModals';
import { useTournament } from '../contexts/TournamentContext';

type TabKey = 'matches' | 'groups' | 'third' | 'knockout' | 'bonus';

interface RouteParams {
  userId: number;
  username: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'matches', label: 'Matches' },
  { key: 'groups', label: 'Groups' },
  { key: 'third', label: '3rd Place' },
  { key: 'knockout', label: 'Knockout' },
  { key: 'bonus', label: 'Bonus' },
];

const BONUS_QUESTION_LABELS: Record<string, string> = {
  g1: 'Total goals scored in Group Stage',
  g2: 'Top scoring group',
  g3: 'Top scoring team in Group Stage',
  g4: 'Teams finishing with 9/9 points',
  g5: 'Teams with clean sheets in group stage',
  g6: 'Scoreless draws (0:0) in the Group Stage',
  k1: 'Total goals scored in Knockout Stage',
  k2: 'Matches decided by penalty shootout',
  k3: '3rd-place teams reaching Quarter Finals',
  t1: 'Total goals in the tournament',
  t2: 'Who will win the Tournament?',
  t3: 'Who will be the top scorer?',
};

const BONUS_FIELD_TO_API: Record<string, keyof BonusPrediction> = {
  g1: 'g1_total_goals_group',
  g2: 'g2_top_group_id',
  g3: 'g3_top_team_id',
  g4: 'g4_perfect_teams',
  g5: 'g5_clean_sheet_teams',
  g6: 'g6_scoreless_draws_group',
  k1: 'k1_total_goals_knockout',
  k2: 'k2_penalty_shootouts',
  k3: 'k3_third_place_quarters',
  t1: 't1_total_goals_tournament',
  t2: 't2_champion_team_id',
  t3: 't3_top_scorer',
};

const G1_OPTIONS = [
  { value: 'under_120', label: '0–119' }, { value: '120_139', label: '120–139' },
  { value: '140_159', label: '140–159' }, { value: '160_179', label: '160–179' },
  { value: '180_199', label: '180–199' }, { value: '200_plus', label: '200+' },
];
const G4_OPTIONS = [
  { value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' },
  { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5_plus', label: '5+' },
];
const G5_OPTIONS = [
  { value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' },
  { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5_plus', label: '5+' },
];
const G6_OPTIONS = [
  { value: '0_2', label: '0–2' }, { value: '3_4', label: '3–4' }, { value: '5_6', label: '5–6' },
  { value: '7_8', label: '7–8' }, { value: '9_10', label: '9–10' }, { value: '11_plus', label: '11+' },
];
const K1_OPTIONS = [
  { value: 'under_30', label: '0–29' }, { value: '30_39', label: '30–39' }, { value: '40_49', label: '40–49' },
  { value: '50_59', label: '50–59' }, { value: '60_69', label: '60–69' }, { value: '70_79', label: '70–79' },
  { value: '80_plus', label: '80+' },
];
const K2_OPTIONS = [
  { value: '0_3', label: '0–3' }, { value: '4_5', label: '4–5' }, { value: '6_7', label: '6–7' },
  { value: '8_9', label: '8–9' }, { value: '10_11', label: '10–11' }, { value: '12_plus', label: '12+' },
];
const K3_OPTIONS = [
  { value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' },
  { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' },
  { value: '6', label: '6' }, { value: '7', label: '7' }, { value: '8', label: '8' },
];
const T1_OPTIONS = [
  { value: 'under_160', label: '0–159' }, { value: '160_189', label: '160–189' },
  { value: '190_219', label: '190–219' }, { value: '220_249', label: '220–249' },
  { value: '250_280', label: '250–280' }, { value: '280_plus', label: '280+' },
];
const T3_OPTIONS = [
  { value: 'messi', label: 'Lionel Messi' }, { value: 'ronaldo', label: 'Cristiano Ronaldo' },
  { value: 'mbappe', label: 'Kylian Mbappé' }, { value: 'haaland', label: 'Erling Haaland' },
  { value: 'neymar', label: 'Neymar Jr.' }, { value: 'kane', label: 'Harry Kane' },
  { value: 'vinicius', label: 'Vinícius Jr.' }, { value: 'salah', label: 'Mohamed Salah' },
  { value: 'bellingham', label: 'Jude Bellingham' }, { value: 'pedri', label: 'Pedri' },
  { value: 'other', label: 'Other' },
];

const BONUS_SECTION_ICONS: Record<string, string> = {
  'Group Stage': 'home',
  Knockout: 'trophy',
  Tournament: 'medal',
};

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
  const { currentStage } = useTournament();
  const tournamentStarted = currentStage !== null && currentStage !== 'PRE_GROUP_STAGE';
  // Show knockout predictions during active stages (group cycles + active knockout rounds)
  // Hide during pre-stage windows where users can still edit their bracket
  const PRE_STAGE_WINDOWS = ['PRE_GROUP_STAGE', 'PRE_ROUND32'];
  const knockoutVisible =
    currentStage !== null &&
    !PRE_STAGE_WINDOWS.includes(currentStage);

  const { userId, username } = route.params as RouteParams;

  const [profileData, setProfileData] = useState<UserProfileView | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tabData, setTabData] = useState<Record<TabKey, any>>({
    matches: null,
    groups: null,
    third: null,
    knockout: null,
    bonus: null,
  });
  const [loadingTabs, setLoadingTabs] = useState<Record<TabKey, boolean>>({
    matches: false,
    groups: false,
    third: false,
    knockout: false,
    bonus: false,
  });
  const [activeTab, setActiveTab] = useState<TabKey>(tournamentStarted ? 'matches' : 'bonus');
  const fetchedTabs = useRef<Set<TabKey>>(new Set());

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
    if (fetchedTabs.current.has(tab)) return;
    if (tab !== 'bonus' && !tournamentStarted) return;
    if (tab === 'knockout' && !knockoutVisible) return;

    fetchedTabs.current.add(tab);
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
        case 'bonus':
          data = await getUserBonusPrediction(userId);
          break;
        default:
          return;
      }
      setTabData((prev) => ({ ...prev, [tab]: data }));
    } catch (e) {
      fetchedTabs.current.delete(tab);
      console.warn(`Failed to fetch ${tab} data:`, e);
    } finally {
      setLoadingTabs((prev) => ({ ...prev, [tab]: false }));
    }
  }, [userId, tournamentStarted, knockoutVisible]);

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    fetchTabData(tab);
  }, [fetchTabData]);

  useEffect(() => {
    if (tournamentStarted) {
      fetchTabData('matches');
    }
  }, [tournamentStarted, fetchTabData]);

  useEffect(() => {
    fetchedTabs.current = new Set();
  }, [userId]);

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
    const breakdownItems: { label: string; value: number | null | undefined }[] = [
      { label: 'Matches', value: p?.matches_score },
      { label: 'Groups', value: p?.groups_score },
      { label: '3rd', value: p?.third_place_score },
      { label: 'Knockout', value: p?.knockout_score },
    ];
    if (p?.bonus_score != null) {
      breakdownItems.push({ label: 'Bonus', value: p.bonus_score });
    }

    return (
      <View style={styles.scoreCard}>
        <View style={styles.scoreTotalBlock}>
          <Text style={styles.scoreTotalLabel}>Total Score</Text>
          <Text style={styles.scoreTotalValue}>{formatScore(p?.total_points)}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreBreakdownRow}>
          {breakdownItems.map(({ label, value }) => (
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

  const visibleTabs = tournamentStarted ? TABS : TABS.filter((t) => t.key === 'bonus');

  const renderTabBar = () => (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarScroll}>
        {visibleTabs.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => handleTabPress(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === key ? styles.tabLabelActive : styles.tabLabelInactive]}>
              {label}
            </Text>
            {activeTab === key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderMatchesTab = () => {
    if (!tournamentStarted) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Available when the tournament begins</Text>
        </View>
      );
    }
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
            hideStats
            hideTemptation
            compact
          />
        )}
        contentContainerStyle={[styles.flatListContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderGroupsTab = () => {
    if (!tournamentStarted) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Available when the tournament begins</Text>
        </View>
      );
    }
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
      if (!g.result || !teamId) {
        const neutralColors: Record<number, string> = {
          1: '#475569',
          2: '#475569',
          3: '#475569',
          4: '#334155',
        };
        return neutralColors[pos] ?? '#334155';
      }
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
        contentContainerStyle={[styles.flatListContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderThirdPlaceTab = () => {
    if (!tournamentStarted) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Available when the tournament begins</Text>
        </View>
      );
    }
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
    const resultGroups: Set<string> = new Set(
      (data.result?.result_groups ?? []).filter((g: string | null) => g != null)
    );
    const cardWidth = (width - 32 - 24) / 4;

    return (
      <ScrollView
        style={styles.thirdPlaceScroll}
        contentContainerStyle={[styles.thirdPlaceGrid, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {eligibleTeams.map((team: any) => {
          const isSelected = team.is_selected;
          const isCorrect = resultGroups.size > 0 && resultGroups.has(team.group_name);

          return (
            <View
              key={team.id}
              style={[
                styles.thirdPlaceCard,
                { width: cardWidth },
                !isSelected && styles.thirdPlaceCardUnselected,
              ]}
            >
              <Text style={styles.thirdPlaceGroupName}>{team.group_name}</Text>
              {team.flag_url && (
                <Image source={{ uri: team.flag_url }} style={styles.thirdPlaceFlag} />
              )}
              <View style={styles.thirdPlaceNameContainer}>
                <Text
                  style={[styles.thirdPlaceTeamName]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {team.name}
                </Text>
              </View>
              <View style={styles.thirdPlaceIconSlot}>
                {isSelected && resultGroups.size > 0 && (
                  <Ionicons
                    name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={isCorrect ? '#16a34a' : '#ef4444'}
                  />
                )}
                {isSelected && resultGroups.size === 0 && (
                  <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderKnockoutTab = () => {
    if (!knockoutVisible) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Available during active match stages</Text>
        </View>
      );
    }
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
    // Only show predictions for stages that have already started
    // (hide future stages that the user is still editing)
    const STAGE_VISIBILITY: Record<string, string[]> = {
      // Group cycles — show all knockout predictions (bracket is locked, all visible)
      GROUP_CYCLE_1:  ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      GROUP_CYCLE_2:  ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      GROUP_CYCLE_3:  ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      // Pre-stage windows — show only completed stages (up to but not including next editable stage)
      PRE_ROUND32:    [],
      PRE_ROUND16:    ['round32'],
      PRE_QUARTER:    ['round32', 'round16'],
      PRE_SEMI:       ['round32', 'round16', 'quarter'],
      // Active knockout rounds — show everything
      ROUND32:        ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      ROUND16:        ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      QUARTER:        ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      SEMI:           ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      THIRD_PLACE:    ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
      FINAL:          ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'],
    };
    const visibleStages = currentStage ? (STAGE_VISIBILITY[currentStage] ?? []) : [];
    const filteredPredictions = currentStage && STAGE_VISIBILITY[currentStage] !== undefined
      ? predictions.filter((p) => visibleStages.includes(p.stage))
      : predictions;

    if (filteredPredictions.length === 0) {
      const isPreWindow = currentStage != null && ['PRE_ROUND16', 'PRE_QUARTER', 'PRE_SEMI'].includes(currentStage);
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>
            {isPreWindow ? 'Previous round results will appear here once available' : 'No knockout results yet'}
          </Text>
        </View>
      );
    }

    const byStage = filteredPredictions.reduce<Record<string, KnockoutPrediction[]>>(
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
        contentContainerStyle={[styles.flatListContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const getBonusAnswerLabel = (
    field: string,
    value: string | number | null,
    groups: GroupPrediction[] | undefined
  ): string => {
    if (value == null) return '';
    if (field === 'g2') {
      const g = groups?.find((gr) => gr.group_id === Number(value));
      return g ? `Group ${g.group_name}` : String(value);
    }
    if (field === 'g3' || field === 't2') {
      const allTeams = groups?.flatMap((g) => g.teams || []) ?? [];
      const t = allTeams.find((t) => t.id === Number(value));
      return t?.name ?? String(value);
    }
    if (field === 't3') {
      return T3_OPTIONS.find((o) => o.value === String(value))?.label ?? String(value);
    }
    const optMap: Record<string, Array<{ value: string; label: string }>> = {
      g1: G1_OPTIONS, g4: G4_OPTIONS, g5: G5_OPTIONS, g6: G6_OPTIONS,
      k1: K1_OPTIONS, k2: K2_OPTIONS, k3: K3_OPTIONS, t1: T1_OPTIONS,
    };
    const opt = (optMap[field] ?? []).find((o) => o.value === String(value));
    return opt?.label ?? String(value);
  };

  const renderBonusSection = (
    title: string,
    icon: string,
    fields: string[],
    pred: any,
    groups: GroupPrediction[] | undefined
  ) => {
    const isLocked =
      (title === 'Group Stage' && !pred?.groups_is_editable) ||
      (title === 'Knockout' && !pred?.knockout_is_editable) ||
      (title === 'Tournament' && !pred?.tournament_is_editable);

    const getStatus = (field: string): 'correct' | 'incorrect' | 'pending' => {
      const statusKey = `q_${field}_status`;
      const val = pred?.[statusKey];
      if (val === 'correct') return 'correct';
      if (val === 'incorrect' || val === 'wrong') return 'incorrect';
      return 'pending';
    };

    const getValue = (field: string) => {
      const apiKey = BONUS_FIELD_TO_API[field];
      return pred?.[apiKey] ?? null;
    };

    return (
      <View style={styles.bonusSectionCard} key={title}>
        <View style={styles.bonusSectionHeader}>
          <Ionicons name={icon as any} size={20} color="#16a34a" />
          <Text style={styles.bonusSectionTitle}>{title}</Text>
          {isLocked && (
            <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={{ marginLeft: 8 }} />
          )}
        </View>
        {fields.map((field, idx) => {
          const val = getValue(field);
          const answered = val != null && val !== '';
          const status = getStatus(field);
          const label = getBonusAnswerLabel(field, val, groups);
          const isLast = idx === fields.length - 1;
          return (
            <View
              key={field}
              style={[
                styles.bonusRow,
                { backgroundColor: idx % 2 === 0 ? '#1e3a5f' : '#162c4a' },
                !isLast && styles.bonusRowBorder,
              ]}
            >
              <Text style={styles.bonusRowLabel} numberOfLines={2}>
                {BONUS_QUESTION_LABELS[field]}
              </Text>
              <View style={styles.bonusRowRight}>
                {!answered ? (
                  <Text style={styles.bonusRowPlaceholder}>—</Text>
                ) : status === 'pending' ? (
                  <Text style={styles.bonusRowValuePending}>{label}</Text>
                ) : status === 'correct' ? (
                  <>
                    <Text style={styles.bonusRowValueCorrect}>{label}</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" style={{ marginLeft: 6 }} />
                  </>
                ) : (
                  <>
                    <Text style={styles.bonusRowValueIncorrect}>{label}</Text>
                    <Ionicons name="close-circle" size={20} color="#ef4444" style={{ marginLeft: 6 }} />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderBonusTab = () => {
    if (!tournamentStarted) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Available when the tournament begins</Text>
        </View>
      );
    }
    const data = tabData.bonus as (BonusPrediction & { groups?: GroupPrediction[] }) | null;
    const loading = loadingTabs.bonus;

    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    if (!data) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Bonus data not available</Text>
        </View>
      );
    }

    const groups = data.groups ?? [];
    return (
      <ScrollView
        style={styles.bonusScroll}
        contentContainerStyle={[styles.bonusScrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderBonusSection(
          'Group Stage',
          BONUS_SECTION_ICONS['Group Stage'],
          ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'],
          data,
          groups
        )}
        {renderBonusSection(
          'Knockout',
          BONUS_SECTION_ICONS.Knockout,
          ['k1', 'k2', 'k3'],
          data,
          groups
        )}
        {renderBonusSection(
          'Tournament',
          BONUS_SECTION_ICONS.Tournament,
          ['t1', 't2', 't3'],
          data,
          groups
        )}
      </ScrollView>
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
      case 'bonus':
        return renderBonusTab();
      default:
        return null;
    }
  };

  if (profileError) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
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

  if (!tournamentStarted) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        {renderHeader()}
        {renderScoreBar()}
        <View style={styles.emptyTab}>
          <Ionicons name="time-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>
            {username ? `${username}'s predictions will be visible once the tournament begins` : 'Predictions will be visible once the tournament begins'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
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
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#1e293b',
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
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#152a45',
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
    color: '#f1f5f9',
  },
  scoreDivider: {
    height: 1,
    backgroundColor: '#2d4a6e',
    marginBottom: 10,
  },
  scoreBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
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
    color: '#f1f5f9',
  },
  tabBarWrapper: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  tabBarScroll: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  tabActive: {},
  tabLabel: {
    fontSize: 11,
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
    backgroundColor: '#0f172a',
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
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  groupBlock: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#152a45',
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
    color: '#f1f5f9',
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
    color: '#f1f5f9',
  },
  teamNamePlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  thirdPlaceCard: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#152a45',
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
  thirdPlaceCardUnselected: {
    opacity: 0.45,
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
    color: '#f1f5f9',
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
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#152a45',
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
    color: '#94a3b8',
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
    color: '#f1f5f9',
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
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
  bonusScroll: {
    flex: 1,
  },
  bonusScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bonusSectionCard: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#152a45',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  bonusSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#152a45',
  },
  bonusSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginLeft: 8,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bonusRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
  },
  bonusRowLabel: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    marginRight: 12,
  },
  bonusRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusRowPlaceholder: {
    fontSize: 14,
    color: '#64748b',
  },
  bonusRowValueCorrect: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  bonusRowValueIncorrect: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  bonusRowValuePending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
});
