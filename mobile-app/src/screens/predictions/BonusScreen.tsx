import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Dimensions,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { IS_RTL } from '../../utils/rtl';
import { apiService, BonusPrediction, BonusOptions, GroupPrediction } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import { useToast } from '../../components/toast/Toast';
import StatsAdGateModal from '../../components/stats/StatsAdGateModal';
import { useStatsAccess } from '../../hooks/useStatsAccess';
import ConfirmExitModal from '../../components/modals/ConfirmExitModal';
import { ErrorModal } from '../../components/modals/CustomModals';

// ─── In-memory caches ───────────────────────────────────────────────
interface BonusOptionsCache {
  data: BonusOptions;
  cachedAt: number;
}
interface GroupsCache {
  data: GroupPrediction[];
  cachedAt: number;
}
interface BonusPredictionCache {
  data: BonusPrediction;
  cachedAt: number;
}

let _bonusOptionsCache: BonusOptionsCache | null = null;
let _groupsCache: GroupsCache | null = null;
let _bonusPredictionCache: BonusPredictionCache | null = null;

const OPTIONS_TTL_MS  = 6 * 60 * 60 * 1000;  // 6 hours — static data
const GROUPS_TTL_MS   = 5 * 60 * 1000;        // 5 minutes
const PREDICTION_TTL_MS = 30 * 1000;          // 30 seconds

function isCacheValid(cachedAt: number, ttl: number): boolean {
  return Date.now() - cachedAt < ttl;
}

export function clearBonusPredictionCache(): void {
  _bonusPredictionCache = null;
}

const SECTION_GROUP_FIELDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const SECTION_KNOCKOUT_FIELDS = ['k1', 'k2', 'k3'];
const SECTION_TOURNAMENT_FIELDS = ['t1', 't2', 't3'];

const ALL_FIELDS = ['t1', 't2', 't3',
                      'g1', 'g2', 'g3', 'g4', 'g5', 'g6',
                      'k1', 'k2', 'k3'] as const;

const FIELD_TO_API: Record<string, keyof BonusPrediction> = {
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

type FieldKey = (typeof ALL_FIELDS)[number];

const PILL_FIELDS = ['g1', 'g4', 'g5', 'g6', 'k1', 'k2', 'k3', 't1', 't3'];
const PICKER_FIELDS = ['g2', 'g3', 't2'];

const { width: screenWidth } = Dimensions.get('window');

const SECTION_SCORE_FIELDS: Record<string, string[]> = {
  'Group Stage': ['q_g1_status', 'q_g2_status', 'q_g3_status', 'q_g4_status', 'q_g5_status', 'q_g6_status'],
  'Knockout': ['q_k1_status', 'q_k2_status', 'q_k3_status'],
  'Tournament': ['q_t1_status', 'q_t2_status', 'q_t3_status'],
};

const POINTS_PER_QUESTION = 8;

const G4_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5_plus', label: '5+' },
];

const G5_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5_plus', label: '5+' },
];

const G6_OPTIONS = [
  { value: '0_2', label: '0–2' },
  { value: '3_4', label: '3–4' },
  { value: '5_6', label: '5–6' },
  { value: '7_8', label: '7–8' },
  { value: '9_10', label: '9–10' },
  { value: '11_plus', label: '11+' },
];

const K1_OPTIONS = [
  { value: 'under_30', label: '0–29' },
  { value: '30_39', label: '30–39' },
  { value: '40_49', label: '40–49' },
  { value: '50_59', label: '50–59' },
  { value: '60_69', label: '60–69' },
  { value: '70_79', label: '70–79' },
  { value: '80_plus', label: '80+' },
];

const K2_OPTIONS = [
  { value: '0_3', label: '0–3' },
  { value: '4_5', label: '4–5' },
  { value: '6_7', label: '6–7' },
  { value: '8_9', label: '8–9' },
  { value: '10_11', label: '10–11' },
  { value: '12_plus', label: '12+' },
];

const T1_OPTIONS = [
  { value: 'under_160', label: '0–159' },
  { value: '160_189', label: '160–189' },
  { value: '190_219', label: '190–219' },
  { value: '220_249', label: '220–249' },
  { value: '250_280', label: '250–280' },
  { value: '280_plus', label: '280+' },
];

const K3_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
];

type StatsDistItem = { value: string; count: number; pct: number };

function BonusStatsModal({
  visible,
  onClose,
  fieldKey,
  loading,
  data,
  outcomeData,
  prediction,
  localAnswers,
  getOptionsForField,
  getAnswerLabel,
  groups,
  allTeams,
}: {
  visible: boolean;
  onClose: () => void;
  fieldKey: string;
  loading: boolean;
  data: { total_answered: number; distribution: StatsDistItem[] } | null;
  outcomeData?: { settled: boolean; correct: number; incorrect: number; total_answered: number; correct_pct: number; incorrect_pct: number } | null;
  prediction: BonusPrediction | null;
  localAnswers: Record<string, string | number | null>;
  getOptionsForField: (f: string) => Array<{ value: string; label: string }>;
  getAnswerLabel: (f: string, v: string | number | null) => string;
  groups: GroupPrediction[];
  allTeams: Array<{ id: number; name: string; flag_url?: string; groupId: number }>;
}) {
  const { t } = useTranslation();
  const QUESTION_LABELS: Record<string, string> = {
    g1: t('bonus.q_g1'), g2: t('bonus.q_g2'), g3: t('bonus.q_g3'),
    g4: t('bonus.q_g4'), g5: t('bonus.q_g5'), g6: t('bonus.q_g6'),
    k1: t('bonus.q_k1'), k2: t('bonus.q_k2'), k3: t('bonus.q_k3'),
    t1: t('bonus.q_t1'), t2: t('bonus.q_t2'), t3: t('bonus.q_t3'),
  };
  const opts = getOptionsForField(fieldKey);

  const getQuestionSettledStatus = (field: string): 'correct' | 'incorrect' | null => {
    const statusKey = `q_${field}_status` as keyof typeof prediction;
    const s = (prediction as any)?.[statusKey] as string | undefined;
    if (s === 'correct') return 'correct';
    if (s === 'incorrect' || s === 'wrong') return 'incorrect';  // handle both (DB stores 'wrong')
    return null;
  };

  const getLabel = (value: string): string => {
    if (fieldKey === 'g2' || fieldKey === 'g3') return getAnswerLabel(fieldKey, value);
    return opts.find((o) => o.value === value)?.label ?? value;
  };

  const renderOutcomeStats = () => {
    if (!outcomeData) return null;
    const { correct_pct, incorrect_pct, total_answered } = outcomeData;
    return (
      <View style={{ paddingVertical: 8 }}>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
          {t('bonus.statsPredictions', { count: total_answered })}
        </Text>

        {/* Correct row */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={{ color: '#16a34a', fontSize: 14, fontWeight: '700' }}>{t('bonus.statsCorrect')}</Text>
            </View>
            <Text style={{ color: '#16a34a', fontSize: 14, fontWeight: '800' }}>
              {t('bonus.statsGotRight', { pct: correct_pct })}
            </Text>
          </View>
          <View style={{ height: 28, backgroundColor: '#1a2332', borderRadius: 8, overflow: 'hidden' }}>
            <View style={{
              height: 28,
              width: `${Math.max(correct_pct, correct_pct > 0 ? 3 : 0)}%`,
              backgroundColor: '#16a34a',
              borderRadius: 8,
            }} />
          </View>
        </View>

        {/* Incorrect row */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700' }}>{t('bonus.statsIncorrect')}</Text>
            </View>
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '800' }}>
              {t('bonus.statsGotWrong', { pct: incorrect_pct })}
            </Text>
          </View>
          <View style={{ height: 28, backgroundColor: '#1a2332', borderRadius: 8, overflow: 'hidden' }}>
            <View style={{
              height: 28,
              width: `${Math.max(incorrect_pct, incorrect_pct > 0 ? 3 : 0)}%`,
              backgroundColor: '#ef4444',
              borderRadius: 8,
            }} />
          </View>
        </View>
      </View>
    );
  };

  // Build a map from value → pct for quick lookup
  const pctMap: Record<string, number> = {};
  if (data) {
    data.distribution.forEach((item) => { pctMap[item.value] = item.pct; });
  }

  const maxPct = data && data.distribution.length > 0
    ? Math.max(...data.distribution.map((d) => d.pct))
    : 1;

  // ── Renders a single mini-pill with percentage overlay ──────────────────
  const renderMiniPill = (value: string, label: string, extraStyle?: object) => {
    const pct = pctMap[value] ?? 0;
    const opacity = maxPct > 0 ? 0.12 + Math.pow(pct / maxPct, 1.6) * 0.88 : 0.12;
    return (
      <View
        key={value}
        style={[
          bonusStatsStyles.miniPill,
          extraStyle,
          { opacity },
        ]}
      >
        <Text style={bonusStatsStyles.miniPillLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {label}
        </Text>
        <Text style={bonusStatsStyles.miniPillPct}>{pct}%</Text>
      </View>
    );
  };

  // ── g2: group cards — 4 rows × 3 columns ───────────────────────────────
  const renderG2Grid = () => {
    const GAP = 7;
    const containerWidth = screenWidth * 0.88 - 32;
    const CARD_SIZE = Math.floor(((containerWidth - 2 * GAP) / 3) * 0.92);

    return (
      <View style={{ width: containerWidth, flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'center' }}>
        {groups.map((g) => {
          const pct = pctMap[String(g.group_id)] ?? 0;
          const opacity = maxPct > 0 ? 0.12 + Math.pow(pct / maxPct, 1.6) * 0.88 : 0.12;
          return (
            <View
              key={g.group_id}
              style={{
                width: CARD_SIZE,
                height: CARD_SIZE,
                borderRadius: 10,
                backgroundColor: '#16a34a',
                opacity,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 3,
              }}
            >
              <Text style={{
                fontSize: CARD_SIZE * 0.38,
                fontWeight: '900',
                color: '#fff',
                lineHeight: CARD_SIZE * 0.44,
              }}>
                {g.group_name}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: 'rgba(255,255,255,0.85)',
                marginTop: 2,
              }}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ── g3: team flag + pct, 6 columns, rectangular flags ───────────────────
  const renderG3Grid = () => {
    const GAP = 5;
    const containerWidth = screenWidth * 0.88 - 32;
    const COLS = 6;
    const CARD_SIZE = Math.floor((containerWidth - (COLS - 1) * GAP) / COLS);
    const FLAG_W = Math.floor(CARD_SIZE * 0.85);
    const FLAG_H = Math.floor(FLAG_W / 1.5);

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {allTeams.map((t) => {
          const pct = pctMap[String(t.id)] ?? 0;
          const opacity = maxPct > 0 ? 0.12 + Math.pow(pct / maxPct, 1.6) * 0.88 : 0.12;
          return (
            <View
              key={t.id}
              style={{
                width: CARD_SIZE,
                height: CARD_SIZE,
                borderRadius: 10,
                backgroundColor: '#16a34a',
                opacity,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 2,
              }}
            >
              {t.flag_url ? (
                <Image
                  source={{ uri: t.flag_url }}
                  style={{ width: FLAG_W, height: FLAG_H, borderRadius: 4 }}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={{ width: FLAG_W, height: FLAG_H, borderRadius: 4, backgroundColor: '#475569' }}
                />
              )}
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', marginTop: 2 }}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Generic pill grid (all other fields) ───────────────────────────────
  const renderPillGrid = () => {
    const isThreeCol = ['k3'].includes(fieldKey);
    const isTwoCol = ['g4', 'g5'].includes(fieldKey);
    const pillW = isThreeCol
      ? Math.floor((screenWidth * 0.8 - 32 - 16) / 3)
      : isTwoCol
        ? Math.floor((screenWidth * 0.8 - 32 - 10) / 2)
        : Math.floor((screenWidth * 0.8 - 32 - 10) / 2);
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {opts.map((opt) => renderMiniPill(opt.value, opt.label, { width: pillW, height: 48 }))}
      </View>
    );
  };

  const renderOutcomeView = () => {
    const settledStatus = getQuestionSettledStatus(fieldKey);
    if (settledStatus === null || !data) return null;
    const userAnswerKey = String(localAnswers[fieldKey] ?? '');
    const userAnswerPct = pctMap[userAnswerKey] ?? 0;

    // Parse correct answer IDs from prediction.correct_values (comma-separated)
    const correctValRaw = (prediction as { correct_values?: Record<string, string | null> })?.correct_values?.[fieldKey] ?? null;
    const correctIds: string[] = correctValRaw
      ? correctValRaw.split(',').map((s: string) => s.trim())
      : [];

    // Sum pcts for ALL correct values (g2/g3 multi-answer support)
    const correctPct = correctIds.length > 0
      ? Math.min(100, correctIds.reduce((sum, id) => sum + (pctMap[id] ?? 0), 0))
      : (settledStatus === 'correct' ? userAnswerPct : 0);
    const incorrectPct = 100 - correctPct;
    const totalAnswered = data.total_answered;
    const isUserCorrect = settledStatus === 'correct';

    return (
      <View style={{ paddingVertical: 8 }}>
        {/* Row 1 — Correct */}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 12,
              marginBottom: 10,
              backgroundColor: '#16a34a',
            },
            !isUserCorrect && { opacity: 0.5 },
            isUserCorrect && { padding: 20 },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{t('bonus.statsCorrectTick')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 }}>
              {t('bonus.statsGotRight', { pct: correctPct })}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{correctPct}%</Text>
        </View>
        {/* Row 2 — Incorrect */}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 12,
              backgroundColor: '#dc2626',
            },
            isUserCorrect && { opacity: 0.5 },
            !isUserCorrect && { padding: 20 },
          ]}
        >
          <Ionicons name="close-circle" size={24} color="#fff" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{t('bonus.statsIncorrectCross')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 }}>
              {t('bonus.statsGotWrong', { pct: incorrectPct })}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{incorrectPct}%</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          {t('bonus.statsPlayersAnswered', { count: totalAnswered })}
        </Text>
      </View>
    );
  };

  const renderContent = () => {
    if (outcomeData?.settled && outcomeData.total_answered > 0) {
      return renderOutcomeStats();
    }
    if (loading) return <ActivityIndicator color="#16a34a" style={{ marginVertical: 24 }} />;
    if (!data || data.total_answered === 0) return (
      <Text style={bonusStatsStyles.empty}>{t('bonus.statsNoPredictions')}</Text>
    );
    if (fieldKey === 'g2') return renderG2Grid();
    if (fieldKey === 'g3') return renderG3Grid();
    if (fieldKey === 't2') return renderG3Grid();
    return renderPillGrid();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={bonusStatsStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Centered popup — tap inside does NOT close */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[bonusStatsStyles.popup, { direction: IS_RTL ? 'rtl' : 'ltr' }]}>
            {/* Header */}
            <View style={bonusStatsStyles.popupHeader}>
              <Text style={[bonusStatsStyles.title, { textAlign: 'center' }]} numberOfLines={2}>
                {QUESTION_LABELS[fieldKey]}
              </Text>
              <TouchableOpacity onPress={onClose} style={bonusStatsStyles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Content — show scroll bar for g3 / t2 (team grids) and t3 (many scorer pills) */}
            <ScrollView
              style={{ maxHeight: screenWidth * 1.8 - 84 }}
              showsVerticalScrollIndicator={fieldKey === 'g3' || fieldKey === 't2' || fieldKey === 't3'}
              contentContainerStyle={{ paddingBottom: 8, paddingTop: 12 }}
            >
              {renderContent()}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const bonusStatsStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  popup: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    width: screenWidth * 0.88,
    maxHeight: screenWidth * 1.8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    lineHeight: 20,
    textAlign: 'center',
    paddingRight: 32,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 24,
    fontSize: 14,
  },
  // Generic mini pill
  miniPill: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    borderWidth: 1,
    borderColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  miniPillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  miniPillPct: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
});

export default function BonusScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { finePerChange } = useTournament();
  const { showToast } = useToast();
  const { getCurrentUserId } = useAuth();

  const SECTION_NAMES: Record<string, string> = {
    g1: t('bonus.groupStage'), g2: t('bonus.groupStage'), g3: t('bonus.groupStage'),
    g4: t('bonus.groupStage'), g5: t('bonus.groupStage'), g6: t('bonus.groupStage'),
    k1: t('bonus.knockout'), k2: t('bonus.knockout'), k3: t('bonus.knockout'),
    t1: t('bonus.tournament'), t2: t('bonus.tournament'), t3: t('bonus.tournament'),
  };

  const QUESTION_LABELS: Record<string, string> = {
    g1: t('bonus.q_g1'), g2: t('bonus.q_g2'), g3: t('bonus.q_g3'),
    g4: t('bonus.q_g4'), g5: t('bonus.q_g5'), g6: t('bonus.q_g6'),
    k1: t('bonus.q_k1'), k2: t('bonus.q_k2'), k3: t('bonus.q_k3'),
    t1: t('bonus.q_t1'), t2: t('bonus.q_t2'), t3: t('bonus.q_t3'),
  };

  const wizardSectionIconName = (field: string): 'home' | 'trophy' | 'medal' => {
    if (field.startsWith('g')) return 'home';
    if (field.startsWith('k')) return 'trophy';
    return 'medal';
  };

  const sectionScoreLookupKey = (fields: string[]): keyof typeof SECTION_SCORE_FIELDS => {
    const f = fields[0] ?? '';
    if (f.startsWith('t')) return 'Tournament';
    if (f.startsWith('g')) return 'Group Stage';
    return 'Knockout';
  };

  const [prediction, setPrediction] = useState<BonusPrediction | null>(null);
  const [options, setOptions] = useState<BonusOptions | null>(null);
  const [groups, setGroups] = useState<GroupPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string | number | null>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string | number | null>>({});
  const [showExitModal, setShowExitModal] = useState(false);
  const [allowExit, setAllowExit] = useState(false);
  const allowExitRef = useRef(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string; goBack?: boolean } | null>(null);

  const allAnswered = ALL_FIELDS.every((f) => {
    const v = localAnswers[f];
    return v != null && v !== '';
  });

  const [viewMode, setViewMode] = useState<'wizard' | 'summary'>('wizard');
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [statsVisible, setStatsVisible] = useState(false);
  const [showAdGate, setShowAdGate] = useState(false);
  const [pendingStatsOpen, setPendingStatsOpen] = useState(false);
  const { canViewStats, consumeFreeView } = useStatsAccess();
  const [statsData, setStatsData] = useState<{
    total_answered: number;
    distribution: Array<{ value: string; count: number; pct: number }>;
  } | null>(null);
  const [outcomeStatsData, setOutcomeStatsData] = useState<{
    field_key: string;
    settled: boolean;
    correct: number;
    incorrect: number;
    total_answered: number;
    correct_pct: number;
    incorrect_pct: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const isDirty = Object.keys(localAnswers).some(
    (k) => String(localAnswers[k] ?? '') !== String(savedAnswers[k] ?? '')
  );

  const changedCount = ALL_FIELDS.filter(
    (k) => String(localAnswers[k] ?? '') !== String(savedAnswers[k] ?? '')
  ).length;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId() ?? 1;

      // Fetch all three — use cache where valid
      const [pred, opts, groupsResult] = await Promise.all([
        // Prediction: 30s cache
        (_bonusPredictionCache && isCacheValid(_bonusPredictionCache.cachedAt, PREDICTION_TTL_MS))
          ? Promise.resolve(_bonusPredictionCache.data)
          : apiService.getBonusPrediction().then(d => {
              _bonusPredictionCache = { data: d, cachedAt: Date.now() };
              return d;
            }),

        // Options: 6h cache (fully static)
        (_bonusOptionsCache && isCacheValid(_bonusOptionsCache.cachedAt, OPTIONS_TTL_MS))
          ? Promise.resolve(_bonusOptionsCache.data)
          : apiService.getBonusOptions().then(d => {
              _bonusOptionsCache = { data: d, cachedAt: Date.now() };
              return d;
            }),

        // Groups: 5min cache
        (_groupsCache && isCacheValid(_groupsCache.cachedAt, GROUPS_TTL_MS))
          ? Promise.resolve(_groupsCache.data)
          : apiService.getGroups(userId).catch(() => []).then(d => {
              _groupsCache = { data: d, cachedAt: Date.now() };
              return d;
            }),
      ]);

      setPrediction(pred);
      setOptions(opts);
      setGroups(groupsResult);
      const initial: Record<string, string | number | null> = {};
      ALL_FIELDS.forEach((f) => {
        const apiKey = FIELD_TO_API[f];
        const v = (pred as any)[apiKey];
        initial[f] = v != null ? (typeof v === 'number' ? v : String(v)) : null;
      });
      setLocalAnswers(initial);
      setSavedAnswers(initial);
    } catch (e) {
      console.error('Bonus fetch error:', e);
      setErrorModal({ title: 'Error', message: 'Could not load bonus predictions. Please try again.', goBack: true });
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId]);

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (loading) return;
    const firstUnanswered = ALL_FIELDS.findIndex((f) => !localAnswers[f] || localAnswers[f] === '');
    const step = firstUnanswered >= 0 ? firstUnanswered : 0;
    setCurrentStep(step);
    setViewMode(allAnswered ? 'summary' : 'wizard');
  }, [loading]);

  useEffect(() => {
    if (allAnswered && viewMode === 'wizard') {
      setViewMode('summary');
    }
  }, [allAnswered]);

  useEffect(() => {
    setStatsData(null);
    setOutcomeStatsData(null);
  }, [currentStep]);

  const handleShowStats = async () => {
    setStatsVisible(true);
    if (statsData || outcomeStatsData) return;
    setStatsLoading(true);
    try {
      const outcome = await apiService.getBonusOutcomeStats(currentField);
      if (outcome.settled && outcome.total_answered > 0) {
        setOutcomeStatsData(outcome);
      } else {
        const dist = await apiService.getBonusStatistics(currentField);
        setStatsData(dist);
      }
    } catch {
      try {
        const dist = await apiService.getBonusStatistics(currentField);
        setStatsData(dist);
      } catch {
        setStatsData(null);
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const handleStatsPress = () => {
    if (canViewStats()) {
      consumeFreeView();
      handleShowStats();
    } else {
      setShowAdGate(true);
    }
  };

  const handleSaveAndExit = useCallback(async () => {
    const updates: Partial<BonusPrediction> = {};
    ALL_FIELDS.forEach((f) => {
      const local = localAnswers[f];
      const saved = savedAnswers[f];
      if (String(local ?? '') !== String(saved ?? '')) {
        const modelKey = FIELD_TO_API[f];
        if (f === 'g2' || f === 'g3' || f === 't2') {
          const num = typeof local === 'number' ? local : parseInt(String(local ?? ''), 10);
          (updates as any)[modelKey] = isNaN(num) ? null : num;
        } else {
          (updates as any)[modelKey] = local != null ? String(local) : null;
        }
      }
    });
    if (Object.keys(updates).length === 0) {
      allowExitRef.current = true;
      setAllowExit(true);
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      await apiService.updateBonusPrediction(updates);
      clearBonusPredictionCache();
      setSavedAnswers({ ...localAnswers });
      allowExitRef.current = true;
      setAllowExit(true);
      navigation.goBack();
    } catch (e) {
      console.error('Bonus save error:', e);
      setErrorModal({ title: 'Error', message: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [localAnswers, savedAnswers, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || allowExitRef.current) return;
      e.preventDefault();
      setShowExitModal(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  const handleSelect = (field: string, value: string | number) => {
    setLocalAnswers((prev) => ({ ...prev, [field]: value }));
    const idx = ALL_FIELDS.indexOf(field as FieldKey);

    setTimeout(() => {
      // Last question — go straight to summary, no animation
      if (idx === ALL_FIELDS.length - 1) {
        setViewMode('summary');
        return;
      }

      // All other steps — always animate slide
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start(() => {
        setCurrentStep(idx + 1);
        slideAnim.setValue(screenWidth);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }).start();
      });
    }, 280);
  };

  const handleSkip = () => {
    const field = ALL_FIELDS[currentStep];
    setLocalAnswers((prev) => ({ ...prev, [field]: null }));
    if (currentStep < ALL_FIELDS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setViewMode('summary');
    }
  };

  const getChangedUpdates = (): Partial<BonusPrediction> => {
    const updates: Partial<BonusPrediction> = {};
    ALL_FIELDS.forEach((f) => {
      const local = localAnswers[f];
      const saved = savedAnswers[f];
      if (String(local ?? '') !== String(saved ?? '')) {
        const modelKey = FIELD_TO_API[f];
        if (f === 'g2' || f === 'g3') {
          const num = typeof local === 'number' ? local : parseInt(String(local ?? ''), 10);
          (updates as any)[modelKey] = isNaN(num) ? null : num;
        } else {
          (updates as any)[modelKey] = local != null ? String(local) : null;
        }
      }
    });
    return updates;
  };

  const handleExitConfirm = () => {
    setShowExitModal(false);
    allowExitRef.current = true;
    setAllowExit(true);
    navigation.goBack();
  };

  const handleBack = () => {
    if (isDirty) {
      if ((finePerChange ?? 0) === 0) {
        handleSaveAndExit();
      } else {
        setShowExitModal(true);
      }
    } else {
      navigation.goBack();
    }
  };

  const goToQuestion = (questionIndex: number) => {
    setCurrentStep(questionIndex);
    setViewMode('wizard');
  };

  const currentField = ALL_FIELDS[currentStep];
  const isPickerQuestion = PICKER_FIELDS.includes(currentField);

  const getOptionsForField = (field: string): Array<{ value: string; label: string }> => {
    // g2 and g3 are handled separately (group/team pickers)
    // For all other fields: prefer API options, fall back to hardcoded
    const hardcodedMap: Record<string, Array<{ value: string; label: string }>> = {
      g4: G4_OPTIONS,
      g5: G5_OPTIONS,
      g6: G6_OPTIONS,
      k1: K1_OPTIONS,
      k2: K2_OPTIONS,
      k3: K3_OPTIONS,
      t1: T1_OPTIONS,
    };
    const apiOpts = options?.[field as keyof BonusOptions];
    if (apiOpts && apiOpts.length > 0) return apiOpts;
    return hardcodedMap[field] ?? [];
  };

  const getAnswerLabel = (field: string, value: string | number | null): string => {
    if (value == null) return '';
    if (field === 'g2') {
      const g = groups.find((gr) => gr.group_id === Number(value));
      return g ? `Group ${g.group_name}` : String(value);
    }
    if (field === 'g3' || field === 't2') {
      const allTeamsFlat = groups.flatMap((g) => g.teams || []);
      const t = allTeamsFlat.find((t) => t.id === Number(value));
      return t?.name ?? String(value);
    }
    if (field === 't3') {
      const t3Opts = options?.t3 ?? [];
      return t3Opts.find((o: any) => o.value === String(value))?.label ?? String(value);
    }
    const optMap: Record<string, Array<{ value: string; label: string }>> = {
      g1: options?.g1 ?? [],
      g4: G4_OPTIONS,
      g5: G5_OPTIONS,
      g6: G6_OPTIONS,
      k1: K1_OPTIONS,
      k2: K2_OPTIONS,
      k3: K3_OPTIONS,
      t1: T1_OPTIONS,
      t3: options?.t3 ?? [],
    };
    const opt = (optMap[field] ?? []).find((o) => o.value === String(value));
    return opt?.label ?? String(value);
  };

  const getInterimLabel = (field: string): string | null => {
    // Don't show interim if question is already settled
    if (getQuestionStatusForField(field) !== 'pending') return null;
    const interim = prediction?.interim_values?.[field];
    if (!interim) return null;
    return getAnswerLabel(field, interim);
  };

  const isSectionEditable = (field: string): boolean => {
    if (!prediction) return true;
    if (SECTION_GROUP_FIELDS.includes(field)) return prediction.groups_is_editable;
    if (SECTION_KNOCKOUT_FIELDS.includes(field)) return prediction.knockout_is_editable;
    return prediction.tournament_is_editable;
  };

  const isSectionLocked = (fields: string[]): boolean => {
    return fields.some((f) => !isSectionEditable(f));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#1e293b' }} edges={['top']}>
          <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!prediction || !options) {
    return null;
  }

  const allTeams = groups.flatMap((g) => (g.teams || []).map((t) => ({ ...t, groupId: g.group_id })));

  const getSectionScore = (section: string): { earned: number; possible: number } | null => {
    if (!prediction) return null;
    const fields = SECTION_SCORE_FIELDS[section] ?? [];
    let earned = 0;
    let settled = 0;
    for (const f of fields) {
      const status = (prediction as any)[f];
      if (status === 'correct') {
        earned += POINTS_PER_QUESTION;
        settled++;
      } else if (status === 'incorrect') {
        settled++;
      }
    }
    if (settled === 0) return null;
    return { earned, possible: settled * POINTS_PER_QUESTION };
  };

  const FIELD_TO_EDITABLE: Record<string, string> = {
    g1: 'groups_is_editable', g2: 'groups_is_editable', g3: 'groups_is_editable',
    g4: 'groups_is_editable', g5: 'groups_is_editable', g6: 'groups_is_editable',
    k1: 'knockout_is_editable', k2: 'knockout_is_editable', k3: 'knockout_is_editable',
    t1: 'tournament_is_editable', t2: 'tournament_is_editable', t3: 'tournament_is_editable',
  };

  const getQuestionStatusForField = (field: string): 'correct' | 'incorrect' | 'pending' => {
    if (!prediction) return 'pending';
    const STATUS_FIELD: Record<string, string> = {
      g1: 'q_g1_status', g2: 'q_g2_status', g3: 'q_g3_status',
      g4: 'q_g4_status', g5: 'q_g5_status', g6: 'q_g6_status',
      k1: 'q_k1_status', k2: 'q_k2_status', k3: 'q_k3_status',
      t1: 'q_t1_status', t2: 'q_t2_status', t3: 'q_t3_status',
    };
    const key = STATUS_FIELD[field];
    if (!key) return 'pending';
    const val = (prediction as any)[key];
    if (val === 'correct') return 'correct';
    if (val === 'incorrect' || val === 'wrong') return 'incorrect';  // handle both (DB stores 'wrong')
    return 'pending';
  };

  const getCorrectAnswerForField = (field: string): string | null => {
    return prediction?.correct_values?.[field] ?? null;
  };

  const renderAnswerArea = (field: string) => {
    const opts = getOptionsForField(field);
    const isEditable = prediction
      ? (prediction as any)[FIELD_TO_EDITABLE[field]] === true
      : true;
    const interimVal = (!isEditable && getQuestionStatusForField(field) === 'pending')
      ? (prediction?.interim_values?.[field] ?? null)
      : null;
    if (field === 'g2') {
      const PARENT_PADDING = 40;
      const COL_GAP = 20;
      const MAX_GRID_WIDTH = 480;
      const effectiveWidth = Math.min(screenWidth - PARENT_PADDING * 2, MAX_GRID_WIDTH);
      const availableWidth = effectiveWidth - COL_GAP * 2;
      const cardWidth = Math.floor(availableWidth / 3);
      const cardHeight = cardWidth;
      const flagAreaWidth = cardWidth - 32;
      const flagW = (flagAreaWidth - 6) / 2;
      const flagH = flagW * 0.65;
      const qStatus = !isEditable ? getQuestionStatusForField(field) : 'pending';
      const correctValRaw = !isEditable ? getCorrectAnswerForField(field) : null;
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const userAnswerId = String(localAnswers[field] ?? '');

      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 0,
            rowGap: 10,
            columnGap: COL_GAP,
            justifyContent: 'center',
            alignContent: 'center',
            paddingBottom: 16,
            maxWidth: 480,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          {groups.map((g) => {
            const selected = Number(localAnswers[field]) === g.group_id;
            const teams = (g.teams || []).slice(0, 4);
            const isUserAnswer = String(g.group_id) === userAnswerId;
            const isCorrectAnswer = correctIds.includes(String(g.group_id));
            let cardStyle: object = {
              width: cardWidth,
              height: cardHeight,
              backgroundColor: selected ? 'rgba(22,163,74,0.15)' : '#152a45',
              borderWidth: 1.5,
              borderColor: selected ? '#16a34a' : '#2d4a6e',
              borderRadius: 14,
              paddingTop: 10,
              paddingBottom: 8,
              paddingHorizontal: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
            };
            let textColor = selected ? '#16a34a' : '#64748b';
            if (!isEditable) {
              if (isUserAnswer) {
                if (qStatus === 'correct') {
                  cardStyle = { ...cardStyle, borderColor: '#16a34a', borderWidth: 2, opacity: 1 };
                  textColor = '#16a34a';
                } else if (qStatus === 'incorrect') {
                  cardStyle = { ...cardStyle, borderColor: '#ef4444', borderWidth: 2, opacity: 1 };
                  textColor = '#ef4444';
                } else {
                  cardStyle = { ...cardStyle, borderColor: '#38bdf8', borderWidth: 2, opacity: 1, backgroundColor: 'rgba(56,189,248,0.1)' };
                  textColor = '#38bdf8';
                }
              } else if (correctIds.includes(String(g.group_id)) && (qStatus === 'incorrect' || (qStatus === 'correct' && !isUserAnswer))) {
                cardStyle = {
                  ...cardStyle,
                  borderColor: '#16a34a',
                  borderWidth: 2.5,
                  opacity: 1,
                  backgroundColor: '#152a45',
                };
                textColor = '#16a34a';
              } else {
                cardStyle = { ...cardStyle, opacity: 0.35 };
              }
            }
            if (interimVal !== null && String(g.group_id) === interimVal) {
              cardStyle = {
                ...cardStyle,
                borderColor: '#f59e0b',
                borderWidth: selected ? 3 : 2,
                opacity: 1,
              };
            }
            return (
              <TouchableOpacity
                key={g.group_id}
                style={[cardStyle]}
                onPress={isEditable ? () => handleSelect(field, g.group_id) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                <Text
                  style={[
                    {
                      fontSize: 17,
                      fontWeight: '800',
                      color: textColor,
                      textAlign: 'center',
                      marginBottom: 6,
                    },
                  ]}
                >
                  {g.group_name}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    width: flagAreaWidth,
                    gap: 5,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {teams.map((t) =>
                    t.flag_url ? (
                      <Image
                        key={t.id}
                        source={{ uri: t.flag_url }}
                        style={{ width: flagW, height: flagH, borderRadius: 4 }}
                      />
                    ) : (
                      <View key={t.id} style={[styles.flagPlaceholder, { width: flagW, height: flagH, borderRadius: 4 }]} />
                    )
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }
    if (field === 'g3') {
      const PARENT_PADDING = 40;
      const G3_COL_GAP = 4;
      const availableWidth = screenWidth - PARENT_PADDING * 2 - G3_COL_GAP * 5;
      const teamCellWidth = Math.floor(availableWidth / 6);
      const flagW = teamCellWidth - 6;
      const flagH = flagW * 0.67;
      const qStatus = !isEditable ? getQuestionStatusForField(field) : 'pending';
      const correctValRaw = !isEditable ? getCorrectAnswerForField(field) : null;
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const userAnswerId = String(localAnswers[field] ?? '');

      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 0,
            columnGap: G3_COL_GAP,
            rowGap: 6,
            paddingBottom: 16,
            justifyContent: 'center',
          }}
        >
          {allTeams.map((t) => {
            const selected = Number(localAnswers[field]) === t.id;
            const isUserAnswer = String(t.id) === userAnswerId;
            const isCorrectAnswer = correctIds.includes(String(t.id));
            let cellOpacity = 1;
            let flagWrapperStyle: object | undefined;
            let badgeType: 'correct' | 'incorrect' | null = null;
            if (!isEditable) {
              if (isUserAnswer) {
                if (qStatus === 'correct') {
                  flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = 'correct';
                } else if (qStatus === 'incorrect') {
                  flagWrapperStyle = { borderColor: '#ef4444', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = 'incorrect';
                } else {
                  flagWrapperStyle = { borderColor: '#38bdf8', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = null;
                }
              } else if (isCorrectAnswer && (qStatus === 'incorrect' || (qStatus === 'correct' && !isUserAnswer))) {
                flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2.5, borderRadius: 5, padding: 1 };
                badgeType = null;
              } else {
                cellOpacity = 0.35;
              }
            } else if (selected) {
              flagWrapperStyle = { borderWidth: 2, borderColor: '#16a34a', borderRadius: 4, padding: 1 };
            }
            if (interimVal !== null && String(t.id) === interimVal && !flagWrapperStyle) {
              flagWrapperStyle = { borderColor: '#f59e0b', borderWidth: 2, borderRadius: 5, padding: 1 };
            } else if (interimVal !== null && String(t.id) === interimVal && flagWrapperStyle) {
              flagWrapperStyle = { ...(flagWrapperStyle as object), borderColor: '#f59e0b', borderWidth: 2.5 };
            }
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  { width: teamCellWidth, paddingVertical: 4, alignItems: 'center' },
                  { opacity: cellOpacity },
                ]}
                onPress={isEditable ? () => handleSelect(field, t.id) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                <View style={{ position: 'relative' }}>
                  <View style={flagWrapperStyle}>
                    {t.flag_url ? (
                      <Image
                        source={{ uri: t.flag_url }}
                        style={{ width: flagW, height: flagH, borderRadius: 3 }}
                      />
                    ) : (
                      <View style={[styles.flagPlaceholder, { width: flagW, height: flagH, borderRadius: 3 }]} />
                    )}
                  </View>
                  {badgeType !== null && (
                    <View style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: badgeType === 'correct' ? '#16a34a' : '#ef4444',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons
                        name={badgeType === 'correct' ? 'checkmark' : 'close'}
                        size={10}
                        color="#fff"
                      />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    {
                      fontSize: 7,
                      marginTop: 2,
                      color: selected ? '#ffffff' : '#64748b',
                      width: teamCellWidth - 2,
                      textAlign: 'center',
                    },
                    !isEditable && styles.optionTextLocked,
                  ]}
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
    }
    if (field === 't2') {
      const PARENT_PADDING = 40;
      const G3_COL_GAP = 4;
      const availableWidth = screenWidth - PARENT_PADDING * 2 - G3_COL_GAP * 5;
      const teamCellWidth = Math.floor(availableWidth / 6);
      const flagW = teamCellWidth - 6;
      const flagH = flagW * 0.67;
      const qStatus = !isEditable ? getQuestionStatusForField(field) : 'pending';
      const correctValRaw = !isEditable ? getCorrectAnswerForField(field) : null;
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const userAnswerId = String(localAnswers[field] ?? '');

      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 0,
            columnGap: G3_COL_GAP,
            rowGap: 6,
            paddingBottom: 16,
            justifyContent: 'center',
          }}
        >
          {allTeams.map((t) => {
            const selected = Number(localAnswers[field]) === t.id;
            const isUserAnswer = String(t.id) === userAnswerId;
            const isCorrectAnswer = correctIds.includes(String(t.id));
            let cellOpacity = 1;
            let flagWrapperStyle: object | undefined;
            let badgeType: 'correct' | 'incorrect' | null = null;
            if (!isEditable) {
              if (isUserAnswer) {
                if (qStatus === 'correct') {
                  flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = 'correct';
                } else if (qStatus === 'incorrect') {
                  flagWrapperStyle = { borderColor: '#ef4444', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = 'incorrect';
                } else {
                  flagWrapperStyle = { borderColor: '#38bdf8', borderWidth: 2, borderRadius: 5, padding: 1 };
                  badgeType = null;
                }
              } else if (isCorrectAnswer && (qStatus === 'incorrect' || (qStatus === 'correct' && !isUserAnswer))) {
                flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2.5, borderRadius: 5, padding: 1 };
                badgeType = null;
              } else {
                cellOpacity = 0.35;
              }
            } else if (selected) {
              flagWrapperStyle = { borderWidth: 2, borderColor: '#16a34a', borderRadius: 4, padding: 1 };
            }
            if (interimVal !== null && String(t.id) === interimVal && !flagWrapperStyle) {
              flagWrapperStyle = { borderColor: '#f59e0b', borderWidth: 2, borderRadius: 5, padding: 1 };
            } else if (interimVal !== null && String(t.id) === interimVal && flagWrapperStyle) {
              flagWrapperStyle = { ...(flagWrapperStyle as object), borderColor: '#f59e0b', borderWidth: 2.5 };
            }
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  { width: teamCellWidth, paddingVertical: 4, alignItems: 'center' },
                  { opacity: cellOpacity },
                ]}
                onPress={isEditable ? () => handleSelect(field, t.id) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                <View style={{ position: 'relative' }}>
                  <View style={flagWrapperStyle}>
                    {t.flag_url ? (
                      <Image
                        source={{ uri: t.flag_url }}
                        style={{ width: flagW, height: flagH, borderRadius: 3 }}
                      />
                    ) : (
                      <View style={[styles.flagPlaceholder, { width: flagW, height: flagH, borderRadius: 3 }]} />
                    )}
                  </View>
                  {badgeType !== null && (
                    <View style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: badgeType === 'correct' ? '#16a34a' : '#ef4444',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons
                        name={badgeType === 'correct' ? 'checkmark' : 'close'}
                        size={10}
                        color="#fff"
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }
    if (field === 'k3') {
      const PARENT_PADDING = 40;
      const COL_GAP = 10;
      const availableWidth = screenWidth - PARENT_PADDING * 2 - COL_GAP * 2;
      const pillWidth = Math.floor(availableWidth / 3);
      const correctValRaw = getCorrectAnswerForField(field);
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const getLockedPillStyle = (optValue: string) => {
        const userVal = String(localAnswers[field] ?? '');
        const qStatus = getQuestionStatusForField(field);
        const isUserAnswer = optValue === userVal;
        const isCorrectAnswer = correctIds.includes(optValue);
        if (isUserAnswer) {
          if (qStatus === 'correct') return { style: styles.pillCorrect, textColor: '#fff' as const, showCheckmark: false };
          if (qStatus === 'incorrect') return { style: styles.pillIncorrect, textColor: '#ef4444' as const, showCheckmark: false };
        }
        if (isCorrectAnswer && qStatus === 'incorrect') return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isCorrectAnswer && qStatus === 'correct' && !isUserAnswer) return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isUserAnswer) return { style: styles.pillLockedSelected, textColor: '#38bdf8' as const, showCheckmark: false };
        return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
      };
      return (
        <View
          style={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 0,
            gap: COL_GAP,
            justifyContent: 'center',
          }}
        >
          {opts.map((opt) => {
            const selected = String(localAnswers[field] ?? '') === opt.value;
            const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  {
                    width: pillWidth,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: '#152a45',
                    borderWidth: 1,
                    borderColor: '#2d4a6e',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  isEditable && selected && styles.wizardPillSelected,
                  !isEditable && lockedStyle?.style,
                  !isEditable && interimVal !== null && opt.value === interimVal && (selected ? styles.pillInterimAndSelected : styles.pillInterim),
                ]}
                onPress={isEditable ? () => handleSelect(field, opt.value) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text
                    style={[
                      styles.wizardPillText,
                      isEditable && selected && styles.wizardPillTextSelected,
                      !isEditable && (lockedStyle?.textColor ? { color: lockedStyle.textColor } : styles.optionTextLocked),
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {lockedStyle?.showCheckmark && <Ionicons name="checkmark" size={12} color="#16a34a" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    if (field === 't3') {
      const correctValRaw = getCorrectAnswerForField(field);
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];

      const getLockedPillStyle = (optValue: string) => {
        const userVal = String(localAnswers[field] ?? '');
        const qStatus = getQuestionStatusForField(field);
        const isUserAnswer = optValue === userVal;
        const isCorrectAnswer = correctIds.includes(optValue);
        if (isUserAnswer) {
          if (qStatus === 'correct') return { style: styles.pillCorrect, textColor: '#fff' as const };
          if (qStatus === 'incorrect') return { style: styles.pillIncorrect, textColor: '#ef4444' as const };
        }
        if (isCorrectAnswer && qStatus === 'incorrect') return { style: styles.pillCorrectAnswer, textColor: undefined };
        if (isCorrectAnswer && qStatus === 'correct' && !isUserAnswer) return { style: styles.pillCorrectAnswer, textColor: undefined };
        if (isUserAnswer) return { style: styles.pillLockedSelected, textColor: '#38bdf8' as const };
        return { style: styles.pillDimmed, textColor: undefined };
      };

      const CARD_GAP = 6;
      const CARD_COLS = 3;
      const CARD_W = Math.floor((screenWidth - 88 - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS);
      const PHOTO_SIZE = Math.floor(CARD_W * 0.52);
      const TEXT_AREA_H = 46;
      const CARD_PADDING_TOP = 8;
      const CARD_PADDING_BOTTOM = 12;
      const CARD_H = PHOTO_SIZE + TEXT_AREA_H + CARD_PADDING_TOP + CARD_PADDING_BOTTOM;
      const FLAG_SIZE = 12;

      const FLAG_CODE_TO_EMOJI: Record<string, string> = {
        'fr': '🇫🇷', 'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'no': '🇳🇴', 'es': '🇪🇸',
        'ar': '🇦🇷', 'pt': '🇵🇹', 'be': '🇧🇪', 'br': '🇧🇷',
        'nl': '🇳🇱', 'de': '🇩🇪',
      };

      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: CARD_GAP,
            paddingBottom: 16,
            paddingHorizontal: 4,
            justifyContent: 'center',
          }}
        >
          {getOptionsForField('t3').map((opt) => {
            const selected = String(localAnswers[field] ?? '') === opt.value;
            const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
            const photo = (opt as { photo?: string | null; flag?: string }).photo ?? null;
            const flag = (opt as { flag?: string }).flag ?? null;
            const emoji = flag ? FLAG_CODE_TO_EMOJI[flag] ?? null : null;
            const firstName = opt.label.split(' ')[0];
            const lastName = opt.label.split(' ').slice(1).join(' ');
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  {
                    width: CARD_W,
                    height: CARD_H,
                    borderRadius: 14,
                    backgroundColor: '#152a45',
                    borderWidth: 1.5,
                    borderColor: '#2d4a6e',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: CARD_PADDING_TOP,
                    paddingBottom: CARD_PADDING_BOTTOM,
                    overflow: 'hidden',
                    flexDirection: 'column',
                    gap: 4,
                  },
                  isEditable && selected && {
                    backgroundColor: '#1a3d2b',
                    borderColor: '#16a34a',
                    borderWidth: 2,
                    shadowColor: '#16a34a',
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                  !isEditable && lockedStyle?.style,
                  !isEditable && interimVal !== null && opt.value === interimVal && (selected ? styles.pillInterimAndSelected : styles.pillInterim),
                ]}
                onPress={isEditable ? () => handleSelect(field, opt.value) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{
                    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2,
                    backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="person" size={PHOTO_SIZE * 0.5} color="#475569" />
                  </View>
                )}
                <View style={{ alignItems: 'center', paddingHorizontal: 2 }}>
                  {lastName ? (
                    <>
                      <Text style={{ fontSize: 9, color: selected ? '#86efac' : '#64748b', fontWeight: '500' }} numberOfLines={1}>
                        {firstName}
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: selected ? '#ffffff' : '#cbd5e1', fontWeight: '800', textAlign: 'center' }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {lastName}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 9, color: 'transparent', fontWeight: '500' }} numberOfLines={1}>
                        {' '}
                      </Text>
                      <Text style={{ fontSize: 11, color: selected ? '#ffffff' : '#cbd5e1', fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>
                        {opt.label}
                      </Text>
                    </>
                  )}
                  {emoji ? (
                    <Text style={{ fontSize: FLAG_SIZE, lineHeight: FLAG_SIZE + 3 }}>{emoji}</Text>
                  ) : (
                    <Text style={{ fontSize: FLAG_SIZE, lineHeight: FLAG_SIZE + 3, color: 'transparent' }}>{' '}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }
    if (field === 'g4' || field === 'g5') {
      const pillW = (screenWidth - 40 - 20) / 3;
      const correctValRaw = getCorrectAnswerForField(field);
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const getLockedPillStyle = (optValue: string) => {
        const userVal = String(localAnswers[field] ?? '');
        const qStatus = getQuestionStatusForField(field);
        const isUserAnswer = optValue === userVal;
        const isCorrectAnswer = correctIds.includes(optValue);
        if (isUserAnswer) {
          if (qStatus === 'correct') return { style: styles.pillCorrect, textColor: '#fff' as const, showCheckmark: false };
          if (qStatus === 'incorrect') return { style: styles.pillIncorrect, textColor: '#ef4444' as const, showCheckmark: false };
        }
        if (isCorrectAnswer && qStatus === 'incorrect') return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isCorrectAnswer && qStatus === 'correct' && !isUserAnswer) return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isUserAnswer) return { style: styles.pillLockedSelected, textColor: '#38bdf8' as const, showCheckmark: false };
        return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
      };
      return (
        <View style={[styles.pillGrid3col, { justifyContent: 'center', direction: 'ltr' }]}>
          {opts.map((opt) => {
            const selected = String(localAnswers[field] ?? '') === opt.value;
            const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.wizardPill3col,
                  { width: pillW },
                  isEditable && selected && styles.wizardPillSelected,
                  !isEditable && lockedStyle?.style,
                  !isEditable && interimVal !== null && opt.value === interimVal && (selected ? styles.pillInterimAndSelected : styles.pillInterim),
                ]}
                onPress={isEditable ? () => handleSelect(field, opt.value) : undefined}
                activeOpacity={isEditable ? 0.7 : 1}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text
                    style={[
                      styles.wizardPillText,
                      isEditable && selected && styles.wizardPillTextSelected,
                      !isEditable && (lockedStyle?.textColor ? { color: lockedStyle.textColor } : styles.optionTextLocked),
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {lockedStyle?.showCheckmark && <Ionicons name="checkmark" size={12} color="#16a34a" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    if (field === 'k1') {
      const correctValRaw = getCorrectAnswerForField(field);
      const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
      const getLockedPillStyle = (optValue: string) => {
        const userVal = String(localAnswers[field] ?? '');
        const qStatus = getQuestionStatusForField(field);
        const isUserAnswer = optValue === userVal;
        const isCorrectAnswer = correctIds.includes(optValue);
        if (isUserAnswer) {
          if (qStatus === 'correct') return { style: styles.pillCorrect, textColor: '#fff' as const, showCheckmark: false };
          if (qStatus === 'incorrect') return { style: styles.pillIncorrect, textColor: '#ef4444' as const, showCheckmark: false };
        }
        if (isCorrectAnswer && qStatus === 'incorrect') return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isCorrectAnswer && qStatus === 'correct' && !isUserAnswer) return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
        if (isUserAnswer) return { style: styles.pillLockedSelected, textColor: '#38bdf8' as const, showCheckmark: false };
        return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
      };
      const renderK1Pill = (opt: { value: string; label: string }, extraStyle?: object) => {
        const selected = String(localAnswers[field] ?? '') === opt.value;
        const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.wizardPill,
              extraStyle,
              isEditable && selected && styles.wizardPillSelected,
              !isEditable && lockedStyle?.style,
              !isEditable && interimVal !== null && opt.value === interimVal && (selected ? styles.pillInterimAndSelected : styles.pillInterim),
            ]}
            onPress={isEditable ? () => handleSelect(field, opt.value) : undefined}
            activeOpacity={isEditable ? 0.7 : 1}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text
                style={[
                  styles.wizardPillText,
                  isEditable && selected && styles.wizardPillTextSelected,
                  !isEditable && (lockedStyle?.textColor ? { color: lockedStyle.textColor } : styles.optionTextLocked),
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {lockedStyle?.showCheckmark && <Ionicons name="checkmark" size={12} color="#16a34a" />}
            </View>
          </TouchableOpacity>
        );
      };
      return (
        <View style={[styles.pillGridK1, { direction: 'ltr' }]}>
          {opts.slice(0, 6).map((opt) => renderK1Pill(opt))}
          {opts.length > 6 && (
            <View style={styles.pillGridK1LastRow}>
              {renderK1Pill(opts[6], styles.wizardPillK1Centered)}
            </View>
          )}
        </View>
      );
    }
    const correctValRaw = getCorrectAnswerForField(field);
    const correctIds = correctValRaw ? correctValRaw.split(',').map((s) => s.trim()) : [];
    const getLockedPillStyle = (optValue: string) => {
      const userVal = String(localAnswers[field] ?? '');
      const qStatus = getQuestionStatusForField(field);
      const isUserAnswer = optValue === userVal;
      const isCorrectAnswer = correctIds.includes(optValue);
      if (isUserAnswer) {
        if (qStatus === 'correct') return { style: styles.pillCorrect, textColor: '#fff' as const, showCheckmark: false };
        if (qStatus === 'incorrect') return { style: styles.pillIncorrect, textColor: '#ef4444' as const, showCheckmark: false };
      }
      if (isCorrectAnswer && qStatus === 'incorrect') return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
      if (isCorrectAnswer && qStatus === 'correct' && !isUserAnswer) return { style: styles.pillCorrectAnswer, textColor: undefined, showCheckmark: false };
      if (isUserAnswer) return { style: styles.pillLockedSelected, textColor: '#38bdf8' as const, showCheckmark: false };
      return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
    };
    return (
      <View style={[styles.pillGrid, { direction: 'ltr' }]}>
        {opts.map((opt) => {
          const selected = String(localAnswers[field] ?? '') === opt.value;
          const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
              styles.wizardPill,
              isEditable && selected && styles.wizardPillSelected,
              !isEditable && lockedStyle?.style,
              !isEditable && interimVal !== null && opt.value === interimVal && (selected ? styles.pillInterimAndSelected : styles.pillInterim),
            ]}
              onPress={isEditable ? () => handleSelect(field, opt.value) : undefined}
              activeOpacity={isEditable ? 0.7 : 1}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={[
                    styles.wizardPillText,
                    isEditable && selected && styles.wizardPillTextSelected,
                    !isEditable && (lockedStyle?.textColor ? { color: lockedStyle.textColor } : styles.optionTextLocked),
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                {lockedStyle?.showCheckmark && <Ionicons name="checkmark" size={12} color="#16a34a" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (viewMode === 'wizard') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <LinearGradient
          colors={['#1e293b', '#152a45']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']} />
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBtnLeft} hitSlop={12}>
              <Ionicons name={IS_RTL ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.wizardHeaderCenter}>
              <Text
                style={styles.wizardSectionTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={1.2}
              >
                {SECTION_NAMES[currentField].toUpperCase()}
              </Text>
              <Ionicons
                name={wizardSectionIconName(currentField) as any}
                size={32}
                color="rgba(255,255,255,0.8)"
              />
            </View>
            <TouchableOpacity
              onPress={() => setViewMode('summary')}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Text style={styles.editPillText}>{t('bonus.viewAll')}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
          <View style={styles.wizardDarkArea}>
            <View style={styles.progressBarContainer}>
              {ALL_FIELDS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    i < currentStep && styles.progressAnswered,
                    i === currentStep && styles.progressCurrent,
                  ]}
                />
              ))}
            </View>
            <Animated.View style={[styles.wizardContent, { transform: [{ translateX: slideAnim }] }]}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingTop: 16,
                    minHeight: 120,
                    justifyContent: 'flex-start',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <View style={styles.questionChip}>
                      <Text style={styles.questionChipText}>Q{currentStep + 1}</Text>
                    </View>
                    <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }}>
                      {getQuestionStatusForField(currentField) !== 'pending' && (
                        <View
                          style={[
                            {
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 8,
                            },
                            getQuestionStatusForField(currentField) === 'correct'
                              ? { backgroundColor: 'rgba(22,163,74,0.2)', borderColor: '#16a34a', borderWidth: 1 }
                              : { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', borderWidth: 1 },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '800',
                              color: getQuestionStatusForField(currentField) === 'correct' ? '#16a34a' : '#ef4444',
                            }}
                          >
                            {getQuestionStatusForField(currentField) === 'correct' ? '+8' : '0'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.statsButtonHalo}>
                      <TouchableOpacity
                        onPress={handleStatsPress}
                        style={styles.statsPillBtn}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="stats-chart" size={14} color="#7dd3fc" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <Text style={[styles.questionTextDark, { textAlign: 'center', width: '100%' }]}>
                      {QUESTION_LABELS[currentField]}
                    </Text>
                  </View>
                  {prediction && !(prediction as any)[FIELD_TO_EDITABLE[currentField]] && (
                    <View>
                      <View style={styles.lockedNotice}>
                        <Ionicons name="lock-closed-outline" size={13} color="#64748b" />
                        <Text style={[styles.lockedNoticeText, { textAlign: IS_RTL ? 'right' : 'left' }]}>
                          {t('bonus.lockedNotice')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, paddingHorizontal: 20, marginTop: 8 }}>
                  {renderAnswerArea(currentField)}
                  {(() => {
                    const showPick = !isSectionEditable(currentField)
                      && localAnswers[currentField] != null
                      && localAnswers[currentField] !== ''
                      && getQuestionStatusForField(currentField) === 'pending';
                    const showInterim = !!getInterimLabel(currentField);
                    if (!showPick && !showInterim) return null;
                    return (
                      <View style={{ marginTop: 14, marginBottom: 8, paddingHorizontal: 4, gap: 6 }}>
                        {showPick && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#38bdf8' }} />
                            <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '500' }}>{t('bonus.yourPick')}</Text>
                          </View>
                        )}
                        {showInterim && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.interimLegendDot} />
                            <Text style={styles.interimLegendText}>{t('bonus.interimLegend')}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </View>
            </Animated.View>
          </View>

          <SafeAreaView style={styles.wizardNav} edges={['bottom']}>
            <TouchableOpacity
              style={[styles.navCircle, currentStep === 0 && styles.navCircleDisabled]}
              onPress={() => currentStep > 0 && setCurrentStep((p) => p - 1)}
              disabled={currentStep === 0}
            >
              <Ionicons name={IS_RTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>{t('bonus.skip')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navCircle}
              onPress={() => {
                if (currentStep < ALL_FIELDS.length - 1) setCurrentStep((p) => p + 1);
                else setViewMode('summary');
              }}
            >
              <Ionicons name={IS_RTL ? 'arrow-back' : 'arrow-forward'} size={22} color="#94a3b8" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <ConfirmExitModal
          visible={showExitModal}
          changesCount={changedCount}
          onClose={() => setShowExitModal(false)}
          onConfirm={handleExitConfirm}
        />

        <StatsAdGateModal
          visible={showAdGate}
          onClose={() => setShowAdGate(false)}
          onUnlocked={() => {
            setShowAdGate(false);
            handleShowStats();
          }}
        />

        <BonusStatsModal
          visible={statsVisible}
          onClose={() => setStatsVisible(false)}
          fieldKey={currentField}
          loading={statsLoading}
          data={statsData}
          outcomeData={outcomeStatsData}
          prediction={prediction}
          localAnswers={localAnswers}
          getOptionsForField={getOptionsForField}
          getAnswerLabel={getAnswerLabel}
          groups={groups}
          allTeams={allTeams}
        />

        {errorModal && (
          <ErrorModal
            visible={!!errorModal}
            title={errorModal.title}
            message={errorModal.message}
            onClose={() => setErrorModal(null)}
            onGoBack={errorModal.goBack ? () => { setErrorModal(null); navigation.goBack(); } : undefined}
          />
        )}
      </View>
    );
  }

  const getSectionSettled = (fields: string[]): boolean => {
    if (!prediction) return false;
    if (fields.some((f) => SECTION_GROUP_FIELDS.includes(f))) return prediction.groups_status === 'settled';
    if (fields.some((f) => SECTION_KNOCKOUT_FIELDS.includes(f))) return prediction.knockout_status === 'settled';
    return prediction.tournament_status === 'settled';
  };

  const getQuestionStatus = (field: string): 'correct' | 'incorrect' | 'pending' => {
    if (!prediction) return 'pending';
    const STATUS_FIELD: Record<string, string> = {
      g1: 'q_g1_status', g2: 'q_g2_status', g3: 'q_g3_status',
      g4: 'q_g4_status', g5: 'q_g5_status', g6: 'q_g6_status',
      k1: 'q_k1_status', k2: 'q_k2_status', k3: 'q_k3_status',
      t1: 'q_t1_status', t2: 'q_t2_status', t3: 'q_t3_status',
    };
    const statusKey = STATUS_FIELD[field];
    if (!statusKey) return 'pending';
    const val = (prediction as any)[statusKey];
    if (val === 'correct') return 'correct';
    if (val === 'incorrect' || val === 'wrong') return 'incorrect';  // handle both (DB stores 'wrong')
    return 'pending';
  };

  const hasAnySettledQuestion = ALL_FIELDS.some((f) => getQuestionStatus(f) !== 'pending');
  const bonusScore = prediction?.bonus_score ?? 0;

  const renderSummarySection = (
    title: string,
    icon: string,
    fields: string[],
    isLocked: boolean,
    isCoreSection?: boolean
  ) => {
    const settled = getSectionSettled(fields);
    return (
      <View style={styles.sectionCardSummary} key={title}>
        <View
          style={[
            styles.sectionHeaderRow,
            !isCoreSection && { backgroundColor: '#0d1b2e' },
          ]}
        >
          <Ionicons name={icon as any} size={22} color={isCoreSection ? '#16a34a' : '#94a3b8'} />
          <Text
            style={[styles.sectionTitle, { flex: 1, color: '#f1f5f9' }]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.6}
            maxFontSizeMultiplier={1}
          >{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
            {(() => {
              const score = getSectionScore(sectionScoreLookupKey(fields));
              if (score) {
                return (
                  <View style={[styles.sectionScoreChip, { marginLeft: 0 }]}>
                    <Text style={styles.sectionScoreText}>{score.earned} pts</Text>
                  </View>
                );
              }
              if (isCoreSection) {
                return (
                  <View style={{
                    marginLeft: 'auto',
                    marginRight: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                    backgroundColor: 'rgba(22,163,74,0.15)',
                    borderWidth: 1,
                    borderColor: '#16a34a',
                  }}>
                    <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700' }}>{t('bonus.basic')}</Text>
                  </View>
                );
              }
              if (isLocked) {
                return <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />;
              }
              return null;
            })()}
          </View>
        </View>
        {fields.map((field, idx) => {
          const globalIdx = ALL_FIELDS.indexOf(field as FieldKey);
          const val = localAnswers[field];
          const answered = val != null && val !== '';
          const editable = isSectionEditable(field);
          const label = getAnswerLabel(field, val);
          const isLast = idx === fields.length - 1;
          const rowBg = isCoreSection
            ? idx % 2 === 0
              ? '#1e3a5f'
              : '#162c4a'
            : idx % 2 === 0
              ? '#111e2e'
              : '#0f1b29';

          return (
            <TouchableOpacity
              key={field}
              style={[
                styles.summaryRowNew,
                { backgroundColor: rowBg },
                IS_RTL && { flexDirection: 'row-reverse' },
                !isLast && styles.summaryRowBorder,
              ]}
              onPress={() => goToQuestion(globalIdx)}
              disabled={false}
            >
              <View style={styles.summaryRowLeft}>
                <Text style={[styles.summaryQNew, !isCoreSection && { color: '#475569' }]}>
                  Q{globalIdx + 1}
                </Text>
                <Text
                  style={[
                    styles.summaryQuestionLabelNew,
                    !isCoreSection && { color: '#cbd5e1' },
                    { textAlign: IS_RTL ? 'right' : 'left' },
                  ]}
                  numberOfLines={3}
                >
                  {QUESTION_LABELS[field]}
                </Text>
              </View>
              <View style={styles.summaryRowRight}>
                {!answered ? (
                  <View style={styles.summaryRowRightContent}>
                    <Ionicons name="add-circle-outline" size={16} color="#cbd5e1" />
                    <Text style={styles.summaryAnswerPrompt}>{t('bonus.answer')}</Text>
                  </View>
                ) : getQuestionStatus(field) === 'correct' ? (
                  <View style={styles.summaryRowRightContent}>
                    <Text style={styles.summaryValueCorrect}>{label}</Text>
                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                  </View>
                ) : getQuestionStatus(field) === 'incorrect' ? (
                  <View style={styles.summaryRowRightContent}>
                    <Text style={styles.summaryValueIncorrect}>{label}</Text>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </View>
                ) : (
                  <View style={styles.summaryRowRightContent}>
                    <Text style={styles.summaryValuePending}>{label}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#38bdf8" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <LinearGradient
        colors={['#1e293b', '#152a45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn} hitSlop={12}>
              <Ionicons name={IS_RTL ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{t('bonus.title')}</Text>

            <TouchableOpacity
              onPress={() => setViewMode('wizard')}
              style={styles.headerEditPillBtn}
              hitSlop={8}
            >
              <Text style={styles.headerEditPillText}>{t('bonus.edit')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.waveSvgContainer}>
            <Svg height="28" width="100%" viewBox="0 0 390 28" preserveAspectRatio="none">
              <Path d="M0,0 C97.5,28 292.5,28 390,0 L390,0 L0,0 Z" fill="#1e293b" />
            </Svg>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, backgroundColor: '#1e293b' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {hasAnySettledQuestion && (
        <View style={[styles.bonusScoreRow, { justifyContent: 'flex-end' }]}>
          <View style={styles.bonusPointsContainer}>
            <Text style={styles.bonusTotalPoints}>{bonusScore} pts</Text>
          </View>
        </View>
      )}

        {renderSummarySection(
          t('bonus.tournament'),
          'medal-outline',
          SECTION_TOURNAMENT_FIELDS,
          isSectionLocked(SECTION_TOURNAMENT_FIELDS),
          true
        )}
        {renderSummarySection(
          t('bonus.groupStage'),
          'home-outline',
          SECTION_GROUP_FIELDS,
          isSectionLocked(SECTION_GROUP_FIELDS)
        )}
        {renderSummarySection(
          t('bonus.knockout'),
          'trophy-outline',
          SECTION_KNOCKOUT_FIELDS,
          isSectionLocked(SECTION_KNOCKOUT_FIELDS)
        )}
      </ScrollView>

      <ConfirmExitModal
        visible={showExitModal}
        changesCount={0}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleExitConfirm}
      />

      {errorModal && (
        <ErrorModal
          visible={!!errorModal}
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal(null)}
          onGoBack={errorModal.goBack ? () => { setErrorModal(null); navigation.goBack(); } : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  safeTop: { backgroundColor: '#16a34a', flex: 0 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  wizardContainer: { backgroundColor: '#0f172a' },

  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  wizardHeaderCenter: { alignItems: 'center', flex: 1 },
  wizardSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  headerBtn: { width: 60, alignItems: 'flex-end' },
  headerBtnLeft: { width: 60, alignItems: 'flex-start' },

  wizardDarkArea: { flex: 1, backgroundColor: '#1e293b', paddingHorizontal: 20, paddingTop: 0 },
  progressBarContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  progressSegment: {
    width: (screenWidth - 40 - 8 - 33) / 12,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2d4a6e',
  },
  progressAnswered: { backgroundColor: '#16a34a' },
  progressCurrent: { backgroundColor: '#86efac' },

  wizardContent: { flex: 1 },
  questionChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22,163,74,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  questionChipText: { fontSize: 12, fontWeight: '700', color: '#86efac' },
  questionTextDark: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 30,
  },
  answerArea: { flex: 1, minHeight: 200 },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  pillGrid3col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  wizardPill3col: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#152a45',
    borderWidth: 1,
    borderColor: '#2d4a6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillGridK1: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  pillGridK1LastRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  wizardPillK1Centered: {
    width: '48%',
  },
  wizardPill: {
    width: '48%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#152a45',
    borderWidth: 1,
    borderColor: '#2d4a6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillGridK3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  wizardPillK3: {
    width: '31%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#152a45',
    borderWidth: 1,
    borderColor: '#2d4a6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wizardPillSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  wizardPillText: { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  wizardPillTextSelected: { fontSize: 15, fontWeight: '700', color: '#fff' },

  g2Grid3x4: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  groupCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: 'rgba(22,163,74,0.15)',
  },
  groupCardLetter3x4: { fontSize: 20, fontWeight: '900', color: '#64748b', textAlign: 'center' },
  groupCardLetterSelected: { color: '#16a34a' },
  groupCardFlags2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  flagPlaceholder: { backgroundColor: '#475569' },

  g3Grid6x8: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  teamCell6x8: {
    height: 70,
    alignItems: 'center',
    paddingVertical: 4,
    justifyContent: 'center',
  },
  teamFlagWrapperSelected: {
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 5,
    padding: 0,
  },
  teamName6x8: { fontSize: 8, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  teamNameSelected: { color: '#fff', fontWeight: '600' },

  wizardNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#1e293b',
  },
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#152a45',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCircleDisabled: { opacity: 0.3 },
  skipBtn: { padding: 8 },
  skipText: { fontSize: 14, color: '#475569', fontWeight: '500' },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 72,
    zIndex: 1,
  },
  statsButtonHalo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
  },
  statsPillBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,132,199,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(14,165,233,0.85)',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 6,
    elevation: 5,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    minWidth: 60,
  },
  headerEditPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38bdf8',
    minWidth: 60,
  },
  editPillText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  headerEditPillText: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '700',
    textAlign: 'center',
  },
  waveSvgContainer: {
    position: 'absolute',
    bottom: -27,
    left: 0,
    right: 0,
    height: 28,
  },

  changesChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  changesChip1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#152a45',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changesChip1Text: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  changesChip2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  changesChip2Fine: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  changesChip2NoFine: {
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderColor: 'rgba(22,163,74,0.2)',
  },
  changesChip2Text: { fontSize: 13, fontWeight: '700' },

  autoSaveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'rgba(22,163,74,0.15)',
  },
  autoSaveText: { fontSize: 13, color: '#16a34a', fontWeight: '500' },

  scroll: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sectionCardSummary: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#152a45',
    borderBottomWidth: 1,
    borderBottomColor: '#2d4a6e',
    gap: 10,
  },
  sectionScoreChip: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,

    marginRight: 4,
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.3)',
  },
  sectionScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  optionPillLocked: {
    opacity: 0.4,
  },
  pillDimmed: {
    opacity: 0.35,
  },
  pillCorrect: {
    borderColor: '#16a34a',
    borderWidth: 2,
    opacity: 1,
    backgroundColor: 'rgba(22,163,74,0.2)',
  },
  pillIncorrect: {
    borderColor: '#ef4444',
    borderWidth: 2,
    opacity: 1,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  pillCorrectAnswer: {
    borderColor: '#16a34a',
    borderWidth: 2,
    opacity: 1,
  },
  optionTextLocked: {
    color: '#94a3b8',
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 16,
  },
  lockedNoticeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  interimBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  interimBannerText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  pillInterim: {
    borderColor: '#f59e0b',
    borderWidth: 2,
    opacity: 1,
  },
  pillInterimAndSelected: {
    borderColor: '#f59e0b',
    borderWidth: 2.5,
    opacity: 1,
    backgroundColor: 'rgba(22,163,74,0.2)',
  },
  pillLockedSelected: {
    borderColor: '#38bdf8',
    borderWidth: 2,
    opacity: 1,
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  pillLockedSelectedText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  interimLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  interimLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: 'transparent',
  },
  interimLegendText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '500',
  },
  bonusScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 6,
    gap: 12,
  },
  bonusNetScoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    backgroundColor: '#152a45',
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
  },
  bonusNetScoreToggleActive: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: '#16a34a',
  },
  bonusNetScoreToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  bonusNetScoreToggleTextActive: {
    color: '#16a34a',
  },
  bonusPointsContainer: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bonusPointsContainerZero: {
    backgroundColor: '#f59e0b',
  },
  bonusPointsContainerNegative: {
    backgroundColor: '#ef4444',
  },
  bonusTotalPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
    flex: 1,
    letterSpacing: 0.3,
  },
  summaryRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#2d4a6e' },
  summaryRowLeft: { flex: 1, marginRight: 8, overflow: 'hidden', minWidth: 0 },
  summaryRowRight: { alignItems: 'flex-end', minWidth: 80 },
  summaryRowRightContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryQNew: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5, marginBottom: 2 },
  summaryQuestionLabelNew: { fontSize: 12, color: '#94a3b8', lineHeight: 16, flexShrink: 1 },
  summaryAnswerPrompt: { fontSize: 12, color: '#475569' },
  summaryValueEditable: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  summaryValueSettled: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  summaryValueCorrect: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  summaryValueIncorrect: { fontSize: 13, color: '#ef4444', fontWeight: '700' },
  summaryValuePending: { fontSize: 13, color: '#38bdf8', fontWeight: '700' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#1e293b',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  saveButtonTextDisabled: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
