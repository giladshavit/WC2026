import React from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const BG = '#1e293b';
const STATUS_BAR_BG = '#0f172a';
const AMBER = '#f59e0b';
const BLUE = '#38bdf8';

const DEMO_PLAYERS_CLASSIC = [
  { rank: 1, name: 'Messi10', exact: 5, correct: 4, wrong: 1, matches: 42, bonus: 24 },
  { rank: 2, name: 'CR7Fan', exact: 2, correct: 3, wrong: 4, matches: 20, bonus: 40 },
  { rank: 3, name: 'FootballKing', exact: 4, correct: 3, wrong: 3, matches: 34, bonus: 16 },
  { rank: 4, name: 'GoalMachine', exact: 1, correct: 2, wrong: 5, matches: 12, bonus: 32 },
  { rank: 5, name: 'You', exact: 3, correct: 2, wrong: 4, matches: 28, bonus: 8 },
  { rank: 6, name: 'OffsideTrap', exact: 0, correct: 5, wrong: 2, matches: 10, bonus: 24 },
  { rank: 7, name: 'TopStriker', exact: 2, correct: 1, wrong: 6, matches: 20, bonus: 8 },
  { rank: 8, name: 'RedCardRaj', exact: 0, correct: 2, wrong: 7, matches: 6, bonus: 16 },
  { rank: 9, name: 'TikiTaka9', exact: 1, correct: 1, wrong: 7, matches: 12, bonus: 0 },
  { rank: 10, name: 'BenchWarmer', exact: 0, correct: 1, wrong: 8, matches: 4, bonus: 0 },
] as const;

const DEMO_PLAYERS_MULTI = [
  { rank: 1, name: 'Messi10', matches: 42, groups: 24, knockout: 15, bonus: 24, fine: 0, total: 105 },
  { rank: 2, name: 'CR7Fan', matches: 18, groups: 28, knockout: 18, bonus: 32, fine: 2, total: 94 },
  { rank: 3, name: 'FootballKing', matches: 34, groups: 20, knockout: 10, bonus: 16, fine: 0, total: 80 },
  { rank: 4, name: 'GoalMachine', matches: 12, groups: 30, knockout: 20, bonus: 16, fine: 3, total: 75 },
  { rank: 5, name: 'You', matches: 28, groups: 14, knockout: 8, bonus: 8, fine: 1, total: 57 },
  { rank: 6, name: 'OffsideTrap', matches: 10, groups: 22, knockout: 12, bonus: 24, fine: 0, total: 68 },
  { rank: 7, name: 'TopStriker', matches: 20, groups: 10, knockout: 6, bonus: 8, fine: 2, total: 42 },
  { rank: 8, name: 'RedCardRaj', matches: 8, groups: 16, knockout: 4, bonus: 16, fine: 0, total: 44 },
  { rank: 9, name: 'TikiTaka9', matches: 14, groups: 6, knockout: 2, bonus: 8, fine: 1, total: 29 },
  { rank: 10, name: 'BenchWarmer', matches: 6, groups: 4, knockout: 0, bonus: 0, fine: 0, total: 10 },
] as const;

const DEMO_ORDER_CLASSIC = new Map(DEMO_PLAYERS_CLASSIC.map((r, i) => [r.name, i]));
const DEMO_ORDER_MULTI = new Map(DEMO_PLAYERS_MULTI.map((r, i) => [r.name, i]));

const C = {
  exact: '#22c55e',
  correct: '#f59e0b',
  wrong: '#ef4444',
  matches: '#60a5fa',
  bonus: '#4ade80',
  total: '#fbbf24',
  groups: '#c084fc',
  knockout: '#d4a017',
  fine: '#ef4444',
};

const COL_STAT = 32;
const COL_TOTAL = 52;
const COL_RANK = 38;

type ClassicRow = (typeof DEMO_PLAYERS_CLASSIC)[number];
type MultiRow = (typeof DEMO_PLAYERS_MULTI)[number];

function classicPodiumTotal(p: ClassicRow) {
  return p.matches + p.bonus;
}

function classicSortValue(row: ClassicRow, key: string): number {
  switch (key) {
    case 'exact':
      return row.exact;
    case 'correct':
      return row.correct;
    case 'wrong':
      return row.wrong;
    case 'matches':
      return row.matches;
    case 'bonus':
      return row.bonus;
    case 'total':
      return row.matches + row.bonus;
    default:
      return 0;
  }
}

function sortClassicByKey(key: string): ClassicRow[] {
  const arr = [...DEMO_PLAYERS_CLASSIC];
  arr.sort((a, b) => {
    const diff = classicSortValue(b, key) - classicSortValue(a, key);
    if (diff !== 0) return diff;
    return DEMO_ORDER_CLASSIC.get(a.name)! - DEMO_ORDER_CLASSIC.get(b.name)!;
  });
  return arr.map((row, idx) => ({ ...row, rank: idx + 1 })) as ClassicRow[];
}

function multiSortValue(row: MultiRow, key: string): number {
  switch (key) {
    case 'matches':
      return row.matches;
    case 'groups':
      return row.groups;
    case 'knockout':
      return row.knockout;
    case 'bonus':
      return row.bonus;
    case 'fine':
      return row.fine;
    case 'total':
      return row.total;
    default:
      return 0;
  }
}

function sortMultiByKey(key: string): MultiRow[] {
  const arr = [...DEMO_PLAYERS_MULTI];
  arr.sort((a, b) => {
    const diff = multiSortValue(b, key) - multiSortValue(a, key);
    if (diff !== 0) return diff;
    return DEMO_ORDER_MULTI.get(a.name)! - DEMO_ORDER_MULTI.get(b.name)!;
  });
  return arr.map((row, idx) => ({ ...row, rank: idx + 1 })) as MultiRow[];
}

function podiumTopThreeClassic(): [ClassicRow, ClassicRow, ClassicRow] {
  const sorted = [...DEMO_PLAYERS_CLASSIC].sort((a, b) => classicPodiumTotal(b) - classicPodiumTotal(a));
  return [sorted[0], sorted[1], sorted[2]];
}

function podiumTopThreeMulti(): [MultiRow, MultiRow, MultiRow] {
  const sorted = [...DEMO_PLAYERS_MULTI].sort((a, b) => b.total - a.total);
  return [sorted[0], sorted[1], sorted[2]];
}

const MEDAL_COLORS = {
  gold: '#D4AF37',
  silver: '#A8A9AD',
  bronze: '#AD6F3B',
} as const;

type PodiumSlot = 'silver' | 'gold' | 'bronze';

function PodiumClassic() {
  const [first, second, third] = podiumTopThreeClassic();
  const order: { player: ClassicRow; slot: PodiumSlot; medalSize: number }[] = [
    { player: second, slot: 'silver', medalSize: 24 },
    { player: first, slot: 'gold', medalSize: 28 },
    { player: third, slot: 'bronze', medalSize: 24 },
  ];

  return (
    <View style={styles.podiumRow}>
      {order.map(({ player, slot, medalSize }) => {
        const isCenter = slot === 'gold';
        const barColor = MEDAL_COLORS[slot === 'gold' ? 'gold' : slot === 'silver' ? 'silver' : 'bronze'];
        const total = classicPodiumTotal(player);
        return (
          <View
            key={player.name}
            style={[
              styles.podiumCard,
              isCenter ? styles.podiumCardCenter : styles.podiumCardSide,
              isCenter && { borderColor: MEDAL_COLORS.gold, borderWidth: 1 },
            ]}
          >
            <Ionicons name="medal" size={medalSize} color={barColor} />
            <Text style={styles.podiumName} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.podiumScorePill}>
              <Text style={styles.podiumScoreText}>{total}</Text>
            </View>
            <View style={[styles.podiumBar, { backgroundColor: barColor }]} />
          </View>
        );
      })}
    </View>
  );
}

function PodiumMulti() {
  const [first, second, third] = podiumTopThreeMulti();
  const order: { player: MultiRow; slot: PodiumSlot; medalSize: number }[] = [
    { player: second, slot: 'silver', medalSize: 24 },
    { player: first, slot: 'gold', medalSize: 28 },
    { player: third, slot: 'bronze', medalSize: 24 },
  ];

  return (
    <View style={styles.podiumRow}>
      {order.map(({ player, slot, medalSize }) => {
        const isCenter = slot === 'gold';
        const barColor = MEDAL_COLORS[slot === 'gold' ? 'gold' : slot === 'silver' ? 'silver' : 'bronze'];
        return (
          <View
            key={player.name}
            style={[
              styles.podiumCard,
              isCenter ? styles.podiumCardCenter : styles.podiumCardSide,
              isCenter && { borderColor: MEDAL_COLORS.gold, borderWidth: 1 },
            ]}
          >
            <Ionicons name="medal" size={medalSize} color={barColor} />
            <Text style={styles.podiumName} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.podiumScorePill}>
              <Text style={styles.podiumScoreText}>{player.total}</Text>
            </View>
            <View style={[styles.podiumBar, { backgroundColor: barColor }]} />
          </View>
        );
      })}
    </View>
  );
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={[styles.rankCell, styles.rankMedal]}>
        <Ionicons name="medal" size={16} color={MEDAL_COLORS.gold} />
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[styles.rankCell, styles.rankMedal]}>
        <Ionicons name="medal" size={14} color={MEDAL_COLORS.silver} />
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[styles.rankCell, styles.rankMedal]}>
        <Ionicons name="medal" size={14} color={MEDAL_COLORS.bronze} />
      </View>
    );
  }
  return (
    <View style={styles.rankCell}>
      <Text style={styles.rankNum}>{rank}</Text>
    </View>
  );
}

function iconColor(active: boolean, hex: string) {
  return active ? hex : `${hex}55`;
}

type ClassicHeaderKey = 'exact' | 'correct' | 'wrong' | 'matches' | 'bonus' | 'total';

type StatHeaderClassicProps = {
  sortKey: string;
  setSortKey: (k: string) => void;
  headerScales: Record<ClassicHeaderKey, Animated.Value>;
};

function StatHeaderClassic({ sortKey, setSortKey, headerScales }: StatHeaderClassicProps) {
  const col = (key: ClassicHeaderKey, iconEl: React.ReactNode) => {
    return (
      <Pressable
        style={[styles.colStat, styles.headerIconCell]}
        onPress={() => setSortKey(key)}
        hitSlop={6}
      >
        <Animated.View style={{ transform: [{ scale: headerScales[key] }] }}>
          <View style={styles.headerIconWrapper}>{iconEl}</View>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={styles.tableHeaderRow}>
      <View style={[styles.colRank, styles.headerCell]}>
        <Text style={styles.headerRankText}>Rank</Text>
      </View>
      <View style={styles.colNameSpacer} />
      {col(
        'exact',
        <View style={styles.classicDimWrap}>
          <Ionicons
            name={sortKey === 'exact' ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={14}
            color={iconColor(sortKey === 'exact', C.exact)}
          />
        </View>
      )}
      {col(
        'correct',
        <View style={styles.classicDimWrap}>
          <Ionicons
            name={sortKey === 'correct' ? 'remove-circle' : 'remove-circle-outline'}
            size={14}
            color={iconColor(sortKey === 'correct', C.correct)}
          />
        </View>
      )}
      {col(
        'wrong',
        <View style={styles.classicDimWrap}>
          <Ionicons
            name={sortKey === 'wrong' ? 'close-circle' : 'close-circle-outline'}
            size={14}
            color={iconColor(sortKey === 'wrong', C.wrong)}
          />
        </View>
      )}
      {col(
        'matches',
        <Ionicons
          name={sortKey === 'matches' ? 'football' : 'football-outline'}
          size={14}
          color={iconColor(sortKey === 'matches', C.matches)}
        />
      )}
      {col(
        'bonus',
        <Ionicons
          name={sortKey === 'bonus' ? 'gift' : 'gift-outline'}
          size={14}
          color={iconColor(sortKey === 'bonus', C.bonus)}
        />
      )}
      <Pressable
        style={[styles.colTotal, styles.headerIconCell]}
        onPress={() => setSortKey('total')}
        hitSlop={6}
      >
        <Animated.View style={{ transform: [{ scale: headerScales.total }] }}>
          <View style={styles.headerIconWrapper}>
            <Ionicons
              name={sortKey === 'total' ? 'star' : 'star-outline'}
              size={14}
              color={iconColor(sortKey === 'total', C.total)}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

type MultiHeaderKey = 'matches' | 'groups' | 'knockout' | 'bonus' | 'fine' | 'total';

type StatHeaderMultiProps = {
  sortKey: string;
  setSortKey: (k: string) => void;
  headerScales: Record<MultiHeaderKey, Animated.Value>;
};

function StatHeaderMulti({ sortKey, setSortKey, headerScales }: StatHeaderMultiProps) {
  const col = (key: MultiHeaderKey, iconEl: React.ReactNode) => {
    return (
      <Pressable
        style={[styles.colStat, styles.headerIconCell]}
        onPress={() => setSortKey(key)}
        hitSlop={6}
      >
        <Animated.View style={{ transform: [{ scale: headerScales[key] }] }}>
          <View style={styles.headerIconWrapper}>{iconEl}</View>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={styles.tableHeaderRow}>
      <View style={[styles.colRank, styles.headerCell]}>
        <Text style={styles.headerRankText}>Rank</Text>
      </View>
      <View style={styles.colNameSpacer} />
      {col(
        'matches',
        <Ionicons
          name={sortKey === 'matches' ? 'football' : 'football-outline'}
          size={14}
          color={iconColor(sortKey === 'matches', C.matches)}
        />
      )}
      {col(
        'groups',
        <Ionicons
          name={sortKey === 'groups' ? 'home' : 'home-outline'}
          size={14}
          color={iconColor(sortKey === 'groups', C.groups)}
        />
      )}
      {col(
        'knockout',
        <Ionicons
          name={sortKey === 'knockout' ? 'trophy' : 'trophy-outline'}
          size={14}
          color={iconColor(sortKey === 'knockout', C.knockout)}
        />
      )}
      {col(
        'bonus',
        <Ionicons
          name={sortKey === 'bonus' ? 'gift' : 'gift-outline'}
          size={14}
          color={iconColor(sortKey === 'bonus', C.bonus)}
        />
      )}
      {col(
        'fine',
        <Ionicons
          name={sortKey === 'fine' ? 'warning' : 'warning-outline'}
          size={14}
          color={iconColor(sortKey === 'fine', C.fine)}
        />
      )}
      <Pressable
        style={[styles.colTotal, styles.headerIconCell]}
        onPress={() => setSortKey('total')}
        hitSlop={6}
      >
        <Animated.View style={{ transform: [{ scale: headerScales.total }] }}>
          <View style={styles.headerIconWrapper}>
            <Ionicons
              name={sortKey === 'total' ? 'star' : 'star-outline'}
              size={14}
              color={iconColor(sortKey === 'total', C.total)}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function TotalBadge({ value, isYou }: { value: number; isYou: boolean }) {
  return (
    <View style={[styles.totalBadge, isYou && styles.totalBadgeYou]}>
      <Text style={styles.totalBadgeText}>{value}</Text>
    </View>
  );
}

function TableClassic({
  rows,
  opacities,
  translates,
  sortKey,
  setSortKey,
  headerScales,
}: {
  rows: ClassicRow[];
  opacities: Animated.Value[];
  translates: Animated.Value[];
  sortKey: string;
  setSortKey: (k: string) => void;
  headerScales: Record<ClassicHeaderKey, Animated.Value>;
}) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderSticky}>
        <StatHeaderClassic sortKey={sortKey} setSortKey={setSortKey} headerScales={headerScales} />
      </View>
      {rows.map((row, index) => {
        const isYou = row.name === 'You';
        const total = row.matches + row.bonus;
        const bg = index % 2 === 0 ? '#0f172a' : '#111827';
        return (
          <Animated.View
            key={row.name}
            style={[
              styles.tableDataRow,
              {
                backgroundColor: isYou ? '#1a2744' : bg,
                borderLeftWidth: isYou ? 3 : 0,
                borderLeftColor: isYou ? '#3b82f6' : 'transparent',
                opacity: opacities[index],
                transform: [{ translateY: translates[index] }],
              },
            ]}
          >
            <RankCell rank={row.rank} />
            <Text style={styles.colName} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={[styles.colStatText, styles.classicDimStat, { color: C.exact }]}>{row.exact}</Text>
            <Text style={[styles.colStatText, styles.classicDimStat, { color: C.correct }]}>{row.correct}</Text>
            <Text style={[styles.colStatText, styles.classicDimStat, { color: C.wrong }]}>{row.wrong}</Text>
            <Text style={[styles.colStatText, { color: C.matches }]}>{row.matches}</Text>
            <Text style={[styles.colStatText, { color: C.bonus }]}>{row.bonus}</Text>
            <View style={styles.colTotalCell}>
              <TotalBadge value={total} isYou={isYou} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function TableMulti({
  rows,
  opacities,
  translates,
  sortKey,
  setSortKey,
  headerScales,
}: {
  rows: MultiRow[];
  opacities: Animated.Value[];
  translates: Animated.Value[];
  sortKey: string;
  setSortKey: (k: string) => void;
  headerScales: Record<MultiHeaderKey, Animated.Value>;
}) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderSticky}>
        <StatHeaderMulti sortKey={sortKey} setSortKey={setSortKey} headerScales={headerScales} />
      </View>
      {rows.map((row, index) => {
        const isYou = row.name === 'You';
        const bg = index % 2 === 0 ? '#0f172a' : '#111827';
        return (
          <Animated.View
            key={row.name}
            style={[
              styles.tableDataRow,
              {
                backgroundColor: isYou ? '#1a2744' : bg,
                borderLeftWidth: isYou ? 3 : 0,
                borderLeftColor: isYou ? '#3b82f6' : 'transparent',
                opacity: opacities[index],
                transform: [{ translateY: translates[index] }],
              },
            ]}
          >
            <RankCell rank={row.rank} />
            <Text style={styles.colName} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={[styles.colStatText, { color: C.matches }]}>{row.matches}</Text>
            <Text style={[styles.colStatText, { color: C.groups }]}>{row.groups}</Text>
            <Text style={[styles.colStatText, { color: C.knockout }]}>{row.knockout}</Text>
            <Text style={[styles.colStatText, { color: C.bonus }]}>{row.bonus}</Text>
            <Text style={[styles.colStatText, { color: C.fine }]}>{row.fine}</Text>
            <View style={styles.colTotalCell}>
              <TotalBadge value={row.total} isYou={isYou} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const ROW_COUNT = DEMO_PLAYERS_CLASSIC.length;

/** Onboarding sort tap: 1 → 0.85 (100ms) → 1.1 → 1 (75ms + 75ms = 150ms release) */
function sortHeaderTapScale(scale: Animated.Value, onDone: () => void) {
  scale.setValue(1);
  Animated.sequence([
    Animated.timing(scale, { toValue: 0.85, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.timing(scale, { toValue: 1.1, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.timing(scale, { toValue: 1, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
  ]).start(() => onDone());
}

function useClassicLeagueAnimations(
  isActive: boolean,
  setSortKey: React.Dispatch<React.SetStateAction<string>>,
  headerScales: Record<ClassicHeaderKey, Animated.Value>
) {
  const mountedRef = React.useRef(true);

  const opacities = React.useRef(Array.from({ length: ROW_COUNT }, () => new Animated.Value(0))).current;
  const translates = React.useRef(Array.from({ length: ROW_COUNT }, () => new Animated.Value(12))).current;

  const resetAnimatedValues = React.useCallback(() => {
    opacities.forEach((v) => {
      v.stopAnimation();
      v.setValue(0);
    });
    translates.forEach((v) => {
      v.stopAnimation();
      v.setValue(12);
    });
    (Object.keys(headerScales) as ClassicHeaderKey[]).forEach((k) => {
      headerScales[k].stopAnimation();
      headerScales[k].setValue(1);
    });
  }, [headerScales, opacities, translates]);

  React.useEffect(() => {
    if (!isActive) {
      resetAnimatedValues();
      mountedRef.current = false;
    }
  }, [isActive, resetAnimatedValues]);

  React.useEffect(() => {
    if (!isActive) return;

    mountedRef.current = true;
    resetAnimatedValues();

    let postStaggerTimeout: ReturnType<typeof setTimeout> | undefined;
    let secondSortChainTimeout: ReturnType<typeof setTimeout> | undefined;

    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      const anims = opacities.map((op, i) =>
        Animated.parallel([
          Animated.timing(op, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translates[i], {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      Animated.stagger(120, anims).start(({ finished }) => {
        if (!finished || !mountedRef.current) return;
        postStaggerTimeout = setTimeout(() => {
          if (!mountedRef.current) return;
          sortHeaderTapScale(headerScales.matches, () => {
            if (!mountedRef.current) return;
            setSortKey('matches');
            secondSortChainTimeout = setTimeout(() => {
              if (!mountedRef.current) return;
              sortHeaderTapScale(headerScales.bonus, () => {
                if (!mountedRef.current) return;
                setSortKey('bonus');
              });
            }, 1000);
          });
        }, 1200);
      });
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (postStaggerTimeout) clearTimeout(postStaggerTimeout);
      if (secondSortChainTimeout) clearTimeout(secondSortChainTimeout);
    };
  }, [isActive, resetAnimatedValues, setSortKey, headerScales, opacities, translates]);

  return { opacities, translates };
}

function useMultiLeagueAnimations(
  isActive: boolean,
  setSortKey: React.Dispatch<React.SetStateAction<string>>,
  headerScales: Record<MultiHeaderKey, Animated.Value>
) {
  const mountedRef = React.useRef(true);

  const opacities = React.useRef(Array.from({ length: ROW_COUNT }, () => new Animated.Value(0))).current;
  const translates = React.useRef(Array.from({ length: ROW_COUNT }, () => new Animated.Value(12))).current;

  const resetAnimatedValues = React.useCallback(() => {
    opacities.forEach((v) => {
      v.stopAnimation();
      v.setValue(0);
    });
    translates.forEach((v) => {
      v.stopAnimation();
      v.setValue(12);
    });
    (Object.keys(headerScales) as MultiHeaderKey[]).forEach((k) => {
      headerScales[k].stopAnimation();
      headerScales[k].setValue(1);
    });
  }, [headerScales, opacities, translates]);

  React.useEffect(() => {
    if (!isActive) {
      resetAnimatedValues();
      mountedRef.current = false;
    }
  }, [isActive, resetAnimatedValues]);

  React.useEffect(() => {
    if (!isActive) return;

    mountedRef.current = true;
    resetAnimatedValues();

    let postStaggerTimeout: ReturnType<typeof setTimeout> | undefined;
    let secondSortChainTimeout: ReturnType<typeof setTimeout> | undefined;

    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      const anims = opacities.map((op, i) =>
        Animated.parallel([
          Animated.timing(op, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translates[i], {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      Animated.stagger(120, anims).start(({ finished }) => {
        if (!finished || !mountedRef.current) return;
        postStaggerTimeout = setTimeout(() => {
          if (!mountedRef.current) return;
          sortHeaderTapScale(headerScales.bonus, () => {
            if (!mountedRef.current) return;
            setSortKey('bonus');
            secondSortChainTimeout = setTimeout(() => {
              if (!mountedRef.current) return;
              sortHeaderTapScale(headerScales.groups, () => {
                if (!mountedRef.current) return;
                setSortKey('groups');
              });
            }, 1000);
          });
        }, 1200);
      });
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (postStaggerTimeout) clearTimeout(postStaggerTimeout);
      if (secondSortChainTimeout) clearTimeout(secondSortChainTimeout);
    };
  }, [isActive, resetAnimatedValues, setSortKey, headerScales, opacities, translates]);

  return { opacities, translates };
}

function createClassicHeaderScales() {
  return {
    exact: new Animated.Value(1),
    correct: new Animated.Value(1),
    wrong: new Animated.Value(1),
    matches: new Animated.Value(1),
    bonus: new Animated.Value(1),
    total: new Animated.Value(1),
  };
}

function createMultiHeaderScales() {
  return {
    matches: new Animated.Value(1),
    groups: new Animated.Value(1),
    knockout: new Animated.Value(1),
    bonus: new Animated.Value(1),
    fine: new Animated.Value(1),
    total: new Animated.Value(1),
  };
}

export function ClassicLeaguePage({ isActive }: { isActive: boolean }) {
  const [sortKey, setSortKey] = React.useState('total');
  const headerScalesRef = React.useRef<ReturnType<typeof createClassicHeaderScales> | null>(null);
  if (!headerScalesRef.current) {
    headerScalesRef.current = createClassicHeaderScales();
  }
  const headerScales = headerScalesRef.current;

  React.useEffect(() => {
    if (!isActive) {
      setSortKey('total');
      (Object.keys(headerScales) as ClassicHeaderKey[]).forEach((k) => headerScales[k].setValue(1));
    }
  }, [isActive, headerScales]);

  const sortedRows = React.useMemo(() => sortClassicByKey(sortKey), [sortKey]);

  const { opacities, translates } = useClassicLeagueAnimations(isActive, setSortKey, headerScales);

  return (
    <View style={styles.root}>
      <View style={styles.staticHeader}>
        <View style={styles.modeBadgeClassic}>
          <Text style={styles.modeBadgeTextClassic}>CLASSIC MODE</Text>
        </View>
        <Text style={styles.pageSubtitle}>
          Your league standings - sorted by total points from matches + bonus questions
        </Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PodiumClassic />
          <TableClassic
            rows={sortedRows}
            opacities={opacities}
            translates={translates}
            sortKey={sortKey}
            setSortKey={setSortKey}
            headerScales={headerScales}
          />
        </ScrollView>
      </View>
    </View>
  );
}

export function MultiLeaguePage({ isActive }: { isActive: boolean }) {
  const [sortKey, setSortKey] = React.useState('total');
  const headerScalesRef = React.useRef<ReturnType<typeof createMultiHeaderScales> | null>(null);
  if (!headerScalesRef.current) {
    headerScalesRef.current = createMultiHeaderScales();
  }
  const headerScales = headerScalesRef.current;

  React.useEffect(() => {
    if (!isActive) {
      setSortKey('total');
      (Object.keys(headerScales) as MultiHeaderKey[]).forEach((k) => headerScales[k].setValue(1));
    }
  }, [isActive, headerScales]);

  const sortedRows = React.useMemo(() => sortMultiByKey(sortKey), [sortKey]);

  const { opacities, translates } = useMultiLeagueAnimations(isActive, setSortKey, headerScales);

  return (
    <View style={styles.root}>
      <View style={styles.staticHeader}>
        <View style={styles.modeBadgeMulti}>
          <Text style={styles.modeBadgeTextMulti}>MULTI MODE</Text>
        </View>
        <Text style={styles.pageSubtitle}>
          Total = Matches + Groups & 3rd Place + Knockout + Bonus − Fines
        </Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PodiumMulti />
          <TableMulti
            rows={sortedRows}
            opacities={opacities}
            translates={translates}
            sortKey={sortKey}
            setSortKey={setSortKey}
            headerScales={headerScales}
          />
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
  modeBadgeClassic: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
  },
  modeBadgeTextClassic: {
    fontSize: 22,
    fontWeight: '800',
    color: BLUE,
    letterSpacing: 0.5,
  },
  modeBadgeMulti: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
  },
  modeBadgeTextMulti: {
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
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  classicDimWrap: {
    opacity: 0.45,
  },
  classicDimStat: {
    opacity: 0.45,
  },
  headerIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  podiumCard: {
    flex: 1,
    maxWidth: 112,
    marginHorizontal: 4,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#152a45',
    paddingTop: 10,
    paddingHorizontal: 6,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  podiumCardCenter: {
    minHeight: 110,
  },
  podiumCardSide: {
    minHeight: 90,
  },
  podiumName: {
    fontSize: 11,
    color: '#e2e8f0',
    textAlign: 'center',
    marginTop: 4,
  },
  podiumScorePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  podiumScoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  podiumBar: {
    width: '100%',
    height: 5,
    marginTop: 8,
  },
  tableWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  tableHeaderSticky: {
    backgroundColor: '#334155',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 6,
  },
  headerCell: {
    justifyContent: 'center',
  },
  headerRankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  headerIconCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  colRank: {
    width: COL_RANK,
  },
  colNameSpacer: {
    flex: 1,
    minWidth: 0,
  },
  colName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    minWidth: 0,
  },
  colStat: {
    width: COL_STAT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colStatText: {
    width: COL_STAT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  colTotal: {
    width: COL_TOTAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colTotalCell: {
    width: COL_TOTAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  rankCell: {
    width: COL_RANK,
    minWidth: COL_RANK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankMedal: {
    paddingVertical: 2,
  },
  rankNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  totalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    minWidth: 44,
    alignItems: 'center',
  },
  totalBadgeYou: {
    backgroundColor: 'rgba(59,130,246,0.3)',
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
});
