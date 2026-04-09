import React from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Same as GroupsPage / ThirdPlacePage */
const STATUS_BAR_BG = '#0f172a';
const BG = '#1e293b';
const AMBER = '#f59e0b';

export type DemoTeam = { name: string; flagCode: string };

export type DemoMatch = { id: number; team1: DemoTeam; team2: DemoTeam };

export type Winner = 1 | 2;

const DEMO_MATCHES: DemoMatch[] = [
  { id: 1, team1: { name: 'South Africa', flagCode: 'za' }, team2: { name: 'Qatar', flagCode: 'qa' } },
  { id: 2, team1: { name: 'Germany', flagCode: 'de' }, team2: { name: 'Australia', flagCode: 'au' } },
  { id: 3, team1: { name: 'Netherlands', flagCode: 'nl' }, team2: { name: 'Morocco', flagCode: 'ma' } },
  { id: 4, team1: { name: 'Brazil', flagCode: 'br' }, team2: { name: 'Japan', flagCode: 'jp' } },
  { id: 5, team1: { name: 'France', flagCode: 'fr' }, team2: { name: 'Sweden', flagCode: 'se' } },
  { id: 6, team1: { name: 'Mexico', flagCode: 'mx' }, team2: { name: 'Norway', flagCode: 'no' } },
  { id: 7, team1: { name: 'England', flagCode: 'gb-eng' }, team2: { name: 'Canada', flagCode: 'ca' } },
  { id: 8, team1: { name: 'Spain', flagCode: 'es' }, team2: { name: 'Uruguay', flagCode: 'uy' } },
];

const PICK_SEQUENCE: { matchIndex: number; matchId: number; winner: Winner }[] = [
  { matchIndex: 0, matchId: 1, winner: 1 },
  { matchIndex: 1, matchId: 2, winner: 1 },
  { matchIndex: 2, matchId: 3, winner: 2 },
  { matchIndex: 3, matchId: 4, winner: 2 },
  { matchIndex: 4, matchId: 5, winner: 1 },
  { matchIndex: 5, matchId: 6, winner: 2 },
];

function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code}.png`;
}

function emptyWinners(): Record<number, Winner | null> {
  const r: Record<number, Winner | null> = {};
  DEMO_MATCHES.forEach((m) => {
    r[m.id] = null;
  });
  return r;
}

type KnockoutPageProps = { isActive: boolean };

export default function KnockoutPage({ isActive }: KnockoutPageProps) {
  const mountedRef = React.useRef(true);

  const tapScales = React.useRef(DEMO_MATCHES.map(() => new Animated.Value(1))).current;

  const scrollRef = React.useRef<ScrollView>(null);
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const [winners, setWinners] = React.useState<Record<number, Winner | null>>(() => emptyWinners());

  const resetAnimatedValues = React.useCallback(() => {
    tapScales.forEach((v) => {
      v.stopAnimation();
      v.setValue(1);
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tapScales]);

  React.useEffect(() => {
    if (!isActive) {
      setWinners(emptyWinners());
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

      setWinners(emptyWinners());
      resetAnimatedValues();

      await sleep(200);
      if (!mountedRef.current) return;

      const tapSelect = async (matchIndex: number, matchId: number, winner: Winner) => {
        await new Promise<void>((resolve) => {
          Animated.sequence([
            Animated.timing(tapScales[matchIndex], {
              toValue: 0.97,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(tapScales[matchIndex], {
              toValue: 1,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => resolve());
        });
        if (!mountedRef.current) return;
        setWinners((prev) => ({ ...prev, [matchId]: winner }));
      };

      for (let i = 0; i < PICK_SEQUENCE.length; i++) {
        const { matchIndex, matchId, winner } = PICK_SEQUENCE[i];
        await tapSelect(matchIndex, matchId, winner);
        if (!mountedRef.current) return;

        if (i === 2) {
          // After 3rd pick: scroll down to show matches 4-6
          await sleep(200);
          if (!mountedRef.current) return;
          await new Promise<void>((resolve) => {
            scrollRef.current?.scrollTo({ y: 290, animated: true });
            setTimeout(resolve, 600);
          });
          if (!mountedRef.current) return;
          await sleep(100);
          if (!mountedRef.current) return;
        } else if (i < PICK_SEQUENCE.length - 1) {
          await sleep(350);
          if (!mountedRef.current) return;
        }
      }
    };

    run();
    return () => {
      mountedRef.current = false;
    };
  }, [isActive, resetAnimatedValues, tapScales]);

  const renderMatch = (match: DemoMatch, index: number) => {
    const w = winners[match.id];
    const team1Win = w === 1;
    const team2Win = w === 2;

    return (
      <Animated.View
        key={match.id}
        style={[styles.matchCard, { transform: [{ scale: tapScales[index] }] }]}
      >
        <View style={styles.statsButtonDecor} pointerEvents="none">
          <Ionicons name="stats-chart" size={14} color="#7dd3fc" />
        </View>

        <View style={styles.halvesRow}>
          <View
            style={[
              styles.teamHalf,
              styles.teamHalfLeft,
              team1Win && styles.teamHalfWinner,
            ]}
          >
            <View style={styles.teamHalfContent}>
              <Image source={{ uri: flagUrl(match.team1.flagCode) }} style={styles.teamFlag} />
              <Text
                style={[styles.teamName, team1Win ? styles.teamNameWinner : styles.teamNameDefault]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.1}
              >
                {match.team1.name}
              </Text>
            </View>
          </View>
          <View style={[styles.teamHalf, team2Win && styles.teamHalfWinner]}>
            <View style={styles.teamHalfContent}>
              <Image source={{ uri: flagUrl(match.team2.flagCode) }} style={styles.teamFlag} />
              <Text
                style={[styles.teamName, team2Win ? styles.teamNameWinner : styles.teamNameDefault]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.1}
              >
                {match.team2.name}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.staticHeader}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText} allowFontScaling={false}>MULTI MODE</Text>
        </View>
        <Text style={styles.pageSubtitle} maxFontSizeMultiplier={1.15} numberOfLines={2} ellipsizeMode="tail">
          Pick the winning team in every knockout match round by round
        </Text>
      </View>

      <View style={styles.sectionPillWrap}>
        <Text style={styles.sectionPill} allowFontScaling={false}>ROUND OF 32</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={false}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {DEMO_MATCHES.map((m, i) => renderMatch(m, i))}
      </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 10,
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
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  sectionPillWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  matchCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    overflow: 'hidden',
  },
  statsButtonDecor: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(2,132,199,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(14,165,233,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halvesRow: {
    flexDirection: 'row',
    height: 90,
    alignItems: 'stretch',
  },
  teamHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#1e3a5f',
  },
  teamHalfLeft: {
    borderRightWidth: 1,
    borderRightColor: '#2d4a6e',
  },
  teamHalfWinner: {
    backgroundColor: 'rgba(22,163,74,0.18)',
  },
  teamHalfContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  teamFlag: {
    width: 44,
    height: 32,
    borderRadius: 6,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 13,
    textAlign: 'center',
  },
  teamNameDefault: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  teamNameWinner: {
    color: '#4ade80',
    fontWeight: '700',
  },
});
