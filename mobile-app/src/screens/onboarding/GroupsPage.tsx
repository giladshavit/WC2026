import React from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Same as BonusPage `staticHeader` — matches OnboardingScreen StatusBar (`#0f172a`) */
const STATUS_BAR_BG = '#0f172a';
const BG = '#1e293b';
const AMBER = '#f59e0b';

export type DemoTeam = {
  id: number;
  name: string;
  flagCode: string;
  rank: number | null;
};

const GROUP_A_TEAMS: DemoTeam[] = [
  { id: 1, name: 'South Africa', flagCode: 'za', rank: null },
  { id: 2, name: 'Czech Republic', flagCode: 'cz', rank: null },
  { id: 3, name: 'Mexico', flagCode: 'mx', rank: null },
  { id: 4, name: 'South Korea', flagCode: 'kr', rank: null },
];

const GROUP_B_TEAMS: DemoTeam[] = [
  { id: 5, name: 'Qatar', flagCode: 'qa', rank: null },
  { id: 6, name: 'Canada', flagCode: 'ca', rank: null },
  { id: 7, name: 'Bosnia Herzegovina', flagCode: 'ba', rank: null },
  { id: 8, name: 'Switzerland', flagCode: 'ch', rank: null },
];

function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code}.png`;
}

function badgeColor(rank: number): string {
  return rank === 4 ? '#64748b' : '#2563eb';
}

type GroupsPageProps = { isActive: boolean };

export default function GroupsPage({ isActive }: GroupsPageProps) {
  const mountedRef = React.useRef(true);

  const tapScales = React.useRef(
    Array.from({ length: 4 }, () => new Animated.Value(1))
  ).current;

  const [teams, setTeams] = React.useState<DemoTeam[]>(() => [...GROUP_A_TEAMS]);

  const resetAnimatedValues = React.useCallback(() => {
    tapScales.forEach((v) => {
      v.stopAnimation();
      v.setValue(1);
    });
  }, [tapScales]);

  React.useEffect(() => {
    if (!isActive) {
      setTeams(GROUP_A_TEAMS.map((t) => ({ ...t })));
      resetAnimatedValues();
      mountedRef.current = false;
    }
  }, [isActive, resetAnimatedValues]);

  React.useEffect(() => {
    if (!isActive) return;

    mountedRef.current = true;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const run = async () => {
      if (!mountedRef.current) return;

      setTeams(GROUP_A_TEAMS.map((t) => ({ ...t })));
      resetAnimatedValues();

      await sleep(200);
      if (!mountedRef.current) return;

      const tapRank = async (teamIndex: number, rank: number) => {
        await new Promise<void>((resolve) => {
          Animated.sequence([
            Animated.timing(tapScales[teamIndex], {
              toValue: 0.96,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(tapScales[teamIndex], {
              toValue: 1,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => resolve());
        });
        if (!mountedRef.current) return;
        setTeams((prev) =>
          prev.map((t, i) => (i === teamIndex ? { ...t, rank } : t))
        );
      };

      await tapRank(2, 1);
      if (!mountedRef.current) return;
      await sleep(400);
      if (!mountedRef.current) return;

      await tapRank(0, 2);
      if (!mountedRef.current) return;
      await sleep(400);
      if (!mountedRef.current) return;

      await tapRank(3, 3);
      if (!mountedRef.current) return;
      await sleep(400);
      if (!mountedRef.current) return;

      await tapRank(1, 4);
      if (!mountedRef.current) return;

      // Sort teams by rank after all 4 are filled
      setTeams((prev) => [...prev].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)));
    };

    run();
    return () => {
      mountedRef.current = false;
    };
  }, [isActive, resetAnimatedValues, tapScales]);

  return (
    <View style={styles.root}>
      <View style={styles.staticHeader}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>MULTI MODE</Text>
        </View>
        <Text style={styles.pageSubtitle}>Rank all 4 teams in each group</Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          style={styles.cardsScroll}
          contentContainerStyle={styles.cardsScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.groupCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardGroupLabel}>Group A</Text>
              <Text style={styles.cardHint}>Tap to rank</Text>
            </View>

            {teams.map((team, index) => (
              <React.Fragment key={team.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <Animated.View
                  style={[styles.teamRow, { transform: [{ scale: tapScales[index] }] }]}
                >
                  <View
                    style={[
                      styles.positionBadge,
                      team.rank != null
                        ? { backgroundColor: badgeColor(team.rank) }
                        : styles.positionBadgeEmpty,
                    ]}
                  >
                    {team.rank != null ? (
                      <Text style={styles.positionBadgeText}>{team.rank}</Text>
                    ) : null}
                  </View>
                  <Image source={{ uri: flagUrl(team.flagCode) }} style={styles.flag} />
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                </Animated.View>
              </React.Fragment>
            ))}
          </View>

          <View style={[styles.groupCard, styles.groupCardDeemphasized]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardGroupLabel}>Group B</Text>
              <View style={styles.cardHeaderRightSpacer} />
            </View>

            {GROUP_B_TEAMS.map((team, index) => (
              <React.Fragment key={team.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <View style={styles.teamRow}>
                  <View style={[styles.positionBadge, styles.positionBadgeEmpty]} />
                  <Image source={{ uri: flagUrl(team.flagCode) }} style={styles.flag} />
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  staticHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: STATUS_BAR_BG,
  },
  modeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
  },
  modeBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: AMBER,
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cardsScroll: {
    flex: 1,
  },
  cardsScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  groupCardDeemphasized: {
    opacity: 0.7,
  },
  cardHeaderRightSpacer: {
    minWidth: 1,
  },
  groupCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardGroupLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cardHint: {
    fontSize: 11,
    color: '#64748b',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionBadgeEmpty: {
    borderWidth: 1.5,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  flag: {
    width: 32,
    height: 22,
    borderRadius: 3,
  },
  teamName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
  },
});
