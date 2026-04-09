import React from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Same as GroupsPage / BonusPage — header strip matches OnboardingScreen StatusBar */
const STATUS_BAR_BG = '#0f172a';
const BG = '#1e293b';
const AMBER = '#f59e0b';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BODY_H_PAD = 16;
const CARD_MARGIN = 4;
const NUM_COLUMNS = 3;
const LIST_INNER_WIDTH = SCREEN_WIDTH - BODY_H_PAD * 2;
/** Three columns with horizontal margin on each card */
const CARD_WIDTH = LIST_INNER_WIDTH / NUM_COLUMNS - CARD_MARGIN * 2;

export type DemoThirdPlaceTeam = {
  id: number;
  name: string;
  flagCode: string;
  group: string;
};

const DEMO_TEAMS: DemoThirdPlaceTeam[] = [
  { id: 1, name: 'Mexico', flagCode: 'mx', group: 'A' },
  { id: 2, name: 'Canada', flagCode: 'ca', group: 'B' },
  { id: 3, name: 'Scotland', flagCode: 'gb-sct', group: 'C' },
  { id: 4, name: 'Australia', flagCode: 'au', group: 'D' },
  { id: 5, name: 'Germany', flagCode: 'de', group: 'E' },
  { id: 6, name: 'Sweden', flagCode: 'se', group: 'F' },
  { id: 7, name: 'Egypt', flagCode: 'eg', group: 'G' },
  { id: 8, name: 'Uruguay', flagCode: 'uy', group: 'H' },
  { id: 9, name: 'Norway', flagCode: 'no', group: 'I' },
  { id: 10, name: 'Austria', flagCode: 'at', group: 'J' },
  { id: 11, name: 'Congo', flagCode: 'cd', group: 'K' },
  { id: 12, name: 'England', flagCode: 'gb-eng', group: 'L' },
];

const INITIAL_SELECTED_IDS = [1, 2, 3, 4, 5] as const;

function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code}.png`;
}

type ThirdPlacePageProps = { isActive: boolean };

export default function ThirdPlacePage({ isActive }: ThirdPlacePageProps) {
  const mountedRef = React.useRef(true);

  const tapScaleRefs = React.useRef(DEMO_TEAMS.map(() => new Animated.Value(1))).current;

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(
    () => new Set(INITIAL_SELECTED_IDS)
  );

  const resetAnimatedValues = React.useCallback(() => {
    tapScaleRefs.forEach((v) => {
      v.stopAnimation();
      v.setValue(1);
    });
  }, [tapScaleRefs]);

  React.useEffect(() => {
    if (!isActive) {
      setSelectedIds(new Set(INITIAL_SELECTED_IDS));
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

      setSelectedIds(new Set(INITIAL_SELECTED_IDS));
      resetAnimatedValues();

      await sleep(200);
      if (!mountedRef.current) return;

      const tapSelect = async (teamIndex: number, teamId: number) => {
        await new Promise<void>((resolve) => {
          Animated.sequence([
            Animated.timing(tapScaleRefs[teamIndex], {
              toValue: 0.93,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(tapScaleRefs[teamIndex], {
              toValue: 1,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => resolve());
        });
        if (!mountedRef.current) return;
        setSelectedIds((prev) => new Set([...prev, teamId]));
      };

      // Egypt id 7 → index 6
      await tapSelect(6, 7);
      if (!mountedRef.current) return;
      await sleep(400);
      if (!mountedRef.current) return;

      // Norway id 9 → index 8
      await tapSelect(8, 9);
      if (!mountedRef.current) return;
      await sleep(400);
      if (!mountedRef.current) return;

      // England id 12 → index 11
      await tapSelect(11, 12);
      if (!mountedRef.current) return;
    };

    run();
    return () => {
      mountedRef.current = false;
    };
  }, [isActive, resetAnimatedValues, tapScaleRefs]);

  const selectedCount = selectedIds.size;

  const renderItem = ({ item }: { item: DemoThirdPlaceTeam }) => {
    const idx = DEMO_TEAMS.indexOf(item);
    const selected = selectedIds.has(item.id);
    return (
      <Animated.View
        style={[
          styles.card,
          selected && styles.cardSelected,
          { width: CARD_WIDTH, transform: [{ scale: tapScaleRefs[idx] }] },
        ]}
      >
        {selected ? (
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color="#48bb78"
            style={styles.cardCheck}
          />
        ) : null}
        <Image source={{ uri: flagUrl(item.flagCode) }} style={styles.flag} />
        <Text style={styles.teamName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {item.name}
        </Text>
        <Text style={styles.groupLabel} maxFontSizeMultiplier={1.2}>Group {item.group}</Text>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.staticHeader}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText} allowFontScaling={false} numberOfLines={1}>MULTI MODE</Text>
        </View>
        <Text style={styles.pageSubtitle} maxFontSizeMultiplier={1.1} numberOfLines={2} ellipsizeMode="tail">
          Pick the 8 third-place groups that advance to the knockouts
        </Text>
      </View>

      <View style={styles.counterWrap}>
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeText}>Selected: {selectedCount}/8</Text>
        </View>
      </View>

      <View style={styles.listWrap}>
        <FlatList
          data={DEMO_TEAMS}
          renderItem={renderItem}
          keyExtractor={(t) => t.id.toString()}
          numColumns={NUM_COLUMNS}
          scrollEnabled={false}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
  counterWrap: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  counterBadge: {
    backgroundColor: '#152a45',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: BODY_H_PAD,
    paddingTop: 2,
  },
  listContent: {
    paddingBottom: 4,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  card: {
    height: 78,
    margin: CARD_MARGIN,
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#48bb78',
    backgroundColor: 'rgba(72,187,120,0.1)',
  },
  cardCheck: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  flag: {
    width: 30,
    height: 21,
    borderRadius: 3,
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  groupLabel: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
});
