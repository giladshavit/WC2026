import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { MainStackParamList } from '../../navigation/MainStackParamList';
import { apiService, BonusOptions, BonusPrediction } from '../../services/api';

type NavProp = StackNavigationProp<MainStackParamList>;

const BG = '#0f172a';
const { width: screenWidth } = Dimensions.get('window');

const FLAG_CODE_TO_EMOJI: Record<string, string> = {
  fr: '🇫🇷',
  'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  no: '🇳🇴',
  es: '🇪🇸',
  ar: '🇦🇷',
  pt: '🇵🇹',
  be: '🇧🇪',
  br: '🇧🇷',
  nl: '🇳🇱',
  de: '🇩🇪',
  eg: '🇪🇬',
  sn: '🇸🇳',
  uy: '🇺🇾',
  'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  us: '🇺🇸',
  mx: '🇲🇽',
  ma: '🇲🇦',
  jp: '🇯🇵',
  hr: '🇭🇷',
};

const markDone = async () => {
  await AsyncStorage.setItem('onboarding_completed', 'true');
  await AsyncStorage.setItem('quick_picks_done', 'true');
};

export default function QuickPicksT3Screen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'QuickPicksT3'>>();
  const insets = useSafeAreaInsets();

  const selectedT2 = route.params?.selectedT2 ?? null;

  const [loading, setLoading] = React.useState(true);
  const [options, setOptions] = React.useState<BonusOptions | null>(null);
  const [selectedT3, setSelectedT3] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts, pred] = await Promise.all([
          apiService.getBonusOptions(),
          apiService.getBonusPrediction(),
        ]);
        if (cancelled) return;
        setOptions(opts);
        if (pred.t3_top_scorer) setSelectedT3(pred.t3_top_scorer);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAndGo = React.useCallback(
    async (dest: 'MatchPredictions' | 'Home') => {
      const payload: Partial<BonusPrediction> = {};
      if (selectedT2 != null) payload.t2_champion_team_id = selectedT2;
      if (selectedT3) payload.t3_top_scorer = selectedT3;
      if (Object.keys(payload).length > 0) {
        try {
          await apiService.updateBonusPrediction(payload);
        } catch {
          // ignore
        }
      }
      await markDone();
      navigation.replace(dest);
    },
    [navigation, selectedT2, selectedT3]
  );

  const onSkip = React.useCallback(async () => {
    if (selectedT2 != null) {
      try {
        await apiService.updateBonusPrediction({ t2_champion_team_id: selectedT2 });
      } catch {
        // ignore
      }
    }
    await markDone();
    navigation.replace('Home');
  }, [navigation, selectedT2]);

  const t3Opts = options?.t3 ?? [];
  const GAP = 10;
  const pillW = (screenWidth - 80 - GAP) / 2;

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
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
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color="#94a3b8" />
        </TouchableOpacity>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <View style={styles.questionBlock}>
        <Text style={styles.questionTitle}>Who will be the top scorer?</Text>
      </View>

      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.t3ScrollContent, { gap: GAP }]}
        >
          {t3Opts.map((opt) => {
            const selected = selectedT3 === opt.value;
            const flag = (opt as { flag?: string }).flag;
            const emoji = flag ? FLAG_CODE_TO_EMOJI[flag] ?? null : null;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.t3Pill, { width: pillW }, selected && styles.t3PillSelected]}
                onPress={async () => {
                  setSelectedT3(opt.value);
                  const payload: Partial<BonusPrediction> = {};
                  if (selectedT2 != null) payload.t2_champion_team_id = selectedT2;
                  payload.t3_top_scorer = opt.value;
                  try { await apiService.updateBonusPrediction(payload); } catch {}
                  await markDone();
                  navigation.replace('QuickPicksDone');
                }}
                activeOpacity={0.7}
              >
                {emoji ? (
                  <Text style={styles.t3Emoji}>{emoji}</Text>
                ) : (
                  <View style={styles.t3EmojiPlaceholder} />
                )}
                <Text
                  style={[styles.t3PillText, selected && styles.t3PillTextSelected]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 36, alignItems: 'flex-start', justifyContent: 'center' },
  backBtnPlaceholder: { width: 36 },
  questionBlock: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  questionTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(148,163,184,0.35)' },
  dotActive: { backgroundColor: '#38bdf8', width: 22 },
  body: { flex: 1, paddingHorizontal: 20 },
  t3ScrollContent: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 16, justifyContent: 'center' },
  t3Pill: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#152a45',
    borderWidth: 1,
    borderColor: '#2d4a6e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  t3PillSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  t3Emoji: { fontSize: 18, lineHeight: 22 },
  t3EmojiPlaceholder: { width: 22, height: 16, borderRadius: 2, backgroundColor: '#334155' },
  t3PillText: { fontSize: 13, fontWeight: '600', color: '#94a3b8', flex: 1 },
  t3PillTextSelected: { color: '#fff', fontWeight: '700' },
  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 12, backgroundColor: BG },
  skipBtn: { alignSelf: 'center', paddingVertical: 4 },
  skipText: { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  primaryBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  ghostBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  ghostBtnText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
});
