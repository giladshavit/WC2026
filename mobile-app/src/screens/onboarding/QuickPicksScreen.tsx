import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../../contexts/AuthContext';
import type { MainStackParamList } from '../../navigation/MainStackParamList';
import { apiService, GroupPrediction } from '../../services/api';

type NavProp = StackNavigationProp<MainStackParamList>;

const BG = '#0f172a';
const { width: screenWidth } = Dimensions.get('window');

export default function QuickPicksScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { getCurrentUserId } = useAuth();

  const [loading, setLoading] = React.useState(true);
  // step state removed — t3 is now a separate screen
  const [groups, setGroups] = React.useState<GroupPrediction[]>([]);
  const [selectedT2, setSelectedT2] = React.useState<number | null>(null);
  // selectedT3 moved to QuickPicksT3Screen
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDone = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    await AsyncStorage.setItem('quick_picks_done', 'true');
  };

  const allTeams = React.useMemo(
    () => groups.flatMap((g) => (g.teams || []).map((t) => ({ ...t, groupId: g.group_id }))),
    [groups]
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const config = await apiService.getAppConfig();
        if (config.current_stage !== 'PRE_GROUP_STAGE') {
          await markDone();
          if (!cancelled) navigation.replace('Home');
          return;
        }

        const qpDone = await AsyncStorage.getItem('quick_picks_done');
        if (qpDone === 'true') {
          await markDone();
          if (!cancelled) navigation.replace('Home');
          return;
        }

        const userId = getCurrentUserId() ?? 1;
        const [pred, gr] = await Promise.all([
          apiService.getBonusPrediction(),
          apiService.getGroups(userId).catch(() => [] as GroupPrediction[]),
        ]);

        if (cancelled) return;

        setGroups(gr);
        if (pred.t2_champion_team_id != null) setSelectedT2(pred.t2_champion_team_id);
      } catch {
        await markDone();
        if (!cancelled) navigation.replace('Home');
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [getCurrentUserId, navigation]);

  const savePartial = React.useCallback(async () => {
    if (selectedT2 == null) return;
    try {
      await apiService.updateBonusPrediction({ t2_champion_team_id: selectedT2 });
    } catch {}
  }, [selectedT2]);

  const onGoPredictMatches = React.useCallback(async () => {
    await savePartial();
    await markDone();
    navigation.replace('MatchPredictions');
  }, [navigation, savePartial]);

  const onMaybeLater = React.useCallback(async () => {
    await savePartial();
    await markDone();
    navigation.replace('Home');
  }, [navigation, savePartial]);

  const onSkipForNow = React.useCallback(async () => {
    await markDone();
    navigation.replace('Home');
  }, [navigation]);

  const onSelectT2 = React.useCallback(
    (teamId: number) => {
      setSelectedT2(teamId);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        navigation.navigate('QuickPicksT3', { selectedT2: teamId });
      }, 300);
    },
    [navigation]
  );

  const renderT2Grid = () => {
    const PARENT_PADDING = 40;
    const G3_COL_GAP = 4;
    const availableWidth = screenWidth - PARENT_PADDING * 2 - G3_COL_GAP * 5;
    const teamCellWidth = Math.floor(availableWidth / 6);
    const flagW = teamCellWidth - 6;
    const flagH = flagW * 0.67;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollFill}
        contentContainerStyle={styles.t2ScrollContent}
      >
        {allTeams.map((t) => {
          const selected = selectedT2 === t.id;
          const flagWrapperStyle = selected
            ? { borderWidth: 2 as const, borderColor: '#16a34a' as const, borderRadius: 5, padding: 1 }
            : undefined;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.teamCell, { width: teamCellWidth }]}
              onPress={() => onSelectT2(t.id)}
              activeOpacity={0.7}
            >
              <View style={styles.flagWrap}>
                <View style={flagWrapperStyle}>
                  {t.flag_url ? (
                    <Image source={{ uri: t.flag_url }} style={{ width: flagW, height: flagH, borderRadius: 3 }} />
                  ) : (
                    <View style={[styles.flagPlaceholder, { width: flagW, height: flagH, borderRadius: 3 }]} />
                  )}
                </View>
              </View>
              <Text
                style={[styles.teamName, { width: teamCellWidth - 2 }, selected && styles.teamNameSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onMaybeLater}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#94a3b8" />
        </TouchableOpacity>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <View style={styles.questionBlock}>
        <Text style={styles.questionTitle}>Who will win the tournament?</Text>
      </View>

      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.body}>{renderT2Grid()}</View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity onPress={onSkipForNow} style={styles.skipBtn} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 36,
  },
  questionBlock: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  dotActive: {
    backgroundColor: '#38bdf8',
    width: 22,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollFill: {
    flex: 1,
  },
  t2ScrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 4,
    rowGap: 6,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  teamCell: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  flagWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagPlaceholder: {
    backgroundColor: '#475569',
  },
  teamName: {
    fontSize: 7,
    marginTop: 2,
    color: '#64748b',
    textAlign: 'center',
  },
  teamNameSelected: {
    color: '#ffffff',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
    backgroundColor: BG,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  primaryBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  ghostBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  ghostBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
