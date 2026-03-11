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

import { apiService, BonusPrediction, BonusOptions, GroupPrediction } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import { useToast } from '../../components/toast/Toast';
import ConfirmSaveModal from '../../components/modals/ConfirmSaveModal';
import ConfirmExitModal from '../../components/modals/ConfirmExitModal';
import { ErrorModal } from '../../components/modals/CustomModals';

const QUESTION_LABELS: Record<string, string> = {
  g1: 'Total goals scored in Group Stage',
  g2: 'Top scoring group',
  g3: 'Top scoring team in Group Stage',
  g4: 'Teams finishing with 9/9 points',
  g5: 'Teams with clean sheets in group stage',
  k1: 'Total goals scored in Knockout Stage',
  k2: 'Matches decided by penalty shootout',
  k3: '3rd-place teams reaching Quarter Finals',
  t1: 'Total goals in the tournament',
  t2: 'Scoreless draws (0:0) in the tournament',
};

const SECTION_GROUP_FIELDS = ['g1', 'g2', 'g3', 'g4', 'g5'];
const SECTION_KNOCKOUT_FIELDS = ['k1', 'k2', 'k3'];
const SECTION_TOURNAMENT_FIELDS = ['t1', 't2'];

const ALL_FIELDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'k1', 'k2', 'k3', 't1', 't2'] as const;

const FIELD_TO_API: Record<string, keyof BonusPrediction> = {
  g1: 'g1_total_goals_group',
  g2: 'g2_top_group_id',
  g3: 'g3_top_team_id',
  g4: 'g4_perfect_teams',
  g5: 'g5_clean_sheet_teams',
  k1: 'k1_total_goals_knockout',
  k2: 'k2_penalty_shootouts',
  k3: 'k3_third_place_quarters',
  t1: 't1_total_goals_tournament',
  t2: 't2_scoreless_draws',
};

const SECTION_NAMES: Record<string, string> = {
  g1: 'Group Stage',
  g2: 'Group Stage',
  g3: 'Group Stage',
  g4: 'Group Stage',
  g5: 'Group Stage',
  k1: 'Knockout',
  k2: 'Knockout',
  k3: 'Knockout',
  t1: 'Tournament',
  t2: 'Tournament',
};

type FieldKey = (typeof ALL_FIELDS)[number];

const PILL_FIELDS = ['g1', 'g4', 'g5', 'k1', 'k2', 'k3', 't1', 't2'];
const PICKER_FIELDS = ['g2', 'g3'];

const { width: screenWidth } = Dimensions.get('window');

const SECTION_ICONS: Record<string, string> = {
  'Group Stage': 'home',
  Knockout: 'trophy',
  Tournament: 'medal',
};

const SECTION_SCORE_FIELDS: Record<string, string[]> = {
  'Group Stage': ['q_g1_status', 'q_g2_status', 'q_g3_status', 'q_g4_status', 'q_g5_status'],
  'Knockout': ['q_k1_status', 'q_k2_status', 'q_k3_status'],
  'Tournament': ['q_t1_status', 'q_t2_status'],
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

const T2_OPTIONS = [
  { value: '0_3', label: '0–3' },
  { value: '4_5', label: '4–5' },
  { value: '6_7', label: '6–7' },
  { value: '8_9', label: '8–9' },
  { value: '10_11', label: '10–11' },
  { value: '12_plus', label: '12+' },
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
    const { correct_pct, incorrect_pct, correct, incorrect, total_answered } = outcomeData;
    return (
      <View style={{ paddingVertical: 8 }}>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
          {total_answered} predictions
        </Text>

        {/* Correct row */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={{ color: '#16a34a', fontSize: 14, fontWeight: '700' }}>Correct</Text>
            </View>
            <Text style={{ color: '#16a34a', fontSize: 14, fontWeight: '800' }}>
              {correct_pct}% ({correct})
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
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700' }}>Incorrect</Text>
            </View>
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '800' }}>
              {incorrect_pct}% ({incorrect})
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
    const GAP = 6;
    const containerWidth = screenWidth * 0.88 - 32;
    const CARD_SIZE = Math.floor((containerWidth - 2 * GAP) / 3);
    const FLAG_GAP = 5;
    const FLAG_W = Math.floor((CARD_SIZE - 8 - FLAG_GAP) / 2);
    const FLAG_H = Math.floor(FLAG_W * 0.65);

    return (
      <View style={{ width: containerWidth, flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {groups.map((g) => {
          const pct = pctMap[String(g.group_id)] ?? 0;
          const opacity = maxPct > 0 ? 0.12 + Math.pow(pct / maxPct, 1.6) * 0.88 : 0.12;
          const teams = (g.teams || []).slice(0, 4);
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
                padding: 4,
              }}
            >
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                width: FLAG_W * 2 + FLAG_GAP,
                gap: FLAG_GAP,
                justifyContent: 'center',
              }}>
                {teams.map((t) =>
                  t.flag_url ? (
                    <Image
                      key={t.id}
                      source={{ uri: t.flag_url }}
                      style={{ width: FLAG_W, height: FLAG_H, borderRadius: 2 }}
                    />
                  ) : (
                    <View
                      key={t.id}
                      style={{ width: FLAG_W, height: FLAG_H, borderRadius: 2, backgroundColor: '#475569' }}
                    />
                  )
                )}
              </View>
              <Text style={{
                fontSize: 11,
                fontWeight: '800',
                color: '#fff',
                marginTop: 3,
                textAlign: 'center',
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
    const isThreeCol = ['g4', 'g5', 'k3'].includes(fieldKey);
    const pillW = isThreeCol
      ? Math.floor((screenWidth * 0.8 - 32 - 16) / 3)
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
    const correctPct = settledStatus === 'correct' ? userAnswerPct : 100 - userAnswerPct;
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
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Correct ✓</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 }}>
              {correctPct}% got it right
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
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Incorrect ✗</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 }}>
              {incorrectPct}% got it wrong
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{incorrectPct}%</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          {totalAnswered} players answered this question
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
      <Text style={bonusStatsStyles.empty}>No predictions yet</Text>
    );
    if (fieldKey === 'g2') return renderG2Grid();
    if (fieldKey === 'g3') return renderG3Grid();
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
          <View style={bonusStatsStyles.popup}>
            {/* Header */}
            <View style={bonusStatsStyles.popupHeader}>
              <Text style={bonusStatsStyles.title} numberOfLines={2}>
                {QUESTION_LABELS[fieldKey]}
              </Text>
              <TouchableOpacity onPress={onClose} style={bonusStatsStyles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Content — show scroll bar for g3 (many teams) */}
            <ScrollView
              showsVerticalScrollIndicator={fieldKey === 'g3'}
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
    maxHeight: screenWidth * 1.4,
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
  const { finePerChange } = useTournament();
  const { showToast } = useToast();
  const { getCurrentUserId } = useAuth();

  const [prediction, setPrediction] = useState<BonusPrediction | null>(null);
  const [options, setOptions] = useState<BonusOptions | null>(null);
  const [groups, setGroups] = useState<GroupPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string | number | null>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string | number | null>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);
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

  const penaltyPoints = changedCount * (finePerChange ?? 0);
  const finePerChangeVal = finePerChange ?? 0;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId() ?? 1;
      const [pred, opts, groupsResult] = await Promise.all([
        apiService.getBonusPrediction(),
        apiService.getBonusOptions(),
        apiService.getGroups(userId).catch(() => []),
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

  const handleSaveAndExit = useCallback(async () => {
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
    if (Object.keys(updates).length === 0) {
      allowExitRef.current = true;
      setAllowExit(true);
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      await apiService.updateBonusPrediction(updates);
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
      if (idx >= 9) {
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
    if (currentStep < 9) {
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

  const handleSave = async () => {
    const updates = getChangedUpdates();
    if (Object.keys(updates).length === 0) return;
    setShowSaveModal(false);
    setSaving(true);
    try {
      const updated = await apiService.updateBonusPrediction(updates);
      setPrediction(updated);
      const newSaved = { ...localAnswers };
      setSavedAnswers(newSaved);
      showToast?.('Saved successfully');
    } catch (e) {
      console.error('Bonus save error:', e);
      setErrorModal({ title: 'Error', message: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExitConfirm = () => {
    setShowExitModal(false);
    allowExitRef.current = true;
    setAllowExit(true);
    navigation.goBack();
  };

  const handleBack = () => {
    if (isDirty) {
      if (finePerChangeVal === 0) {
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
      k1: K1_OPTIONS,
      k2: K2_OPTIONS,
      k3: K3_OPTIONS,
      t1: T1_OPTIONS,
      t2: T2_OPTIONS,
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
    if (field === 'g3') {
      const allTeams = groups.flatMap((g) => g.teams || []);
      const t = allTeams.find((t) => t.id === Number(value));
      return t?.name ?? String(value);
    }
    const optMap: Record<string, Array<{ value: string; label: string }>> = {
      g1: options?.g1 ?? [],
      g4: G4_OPTIONS,
      g5: G5_OPTIONS,
      k1: K1_OPTIONS,
      k2: K2_OPTIONS,
      k3: K3_OPTIONS,
      t1: T1_OPTIONS,
      t2: T2_OPTIONS,
    };
    const opt = (optMap[field] ?? []).find((o) => o.value === String(value));
    return opt?.label ?? String(value);
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
      <View style={{ flex: 1, backgroundColor: '#16a34a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#16a34a' }} edges={['top']}>
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
    g4: 'groups_is_editable', g5: 'groups_is_editable',
    k1: 'knockout_is_editable', k2: 'knockout_is_editable', k3: 'knockout_is_editable',
    t1: 'tournament_is_editable', t2: 'tournament_is_editable',
  };

  const getQuestionStatusForField = (field: string): 'correct' | 'incorrect' | 'pending' => {
    if (!prediction) return 'pending';
    const STATUS_FIELD: Record<string, string> = {
      g1: 'q_g1_status', g2: 'q_g2_status', g3: 'q_g3_status',
      g4: 'q_g4_status', g5: 'q_g5_status',
      k1: 'q_k1_status', k2: 'q_k2_status', k3: 'q_k3_status',
      t1: 'q_t1_status', t2: 'q_t2_status',
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
    if (field === 'g2') {
      const PARENT_PADDING = 40;
      const COL_GAP = 20;
      const availableWidth = screenWidth - PARENT_PADDING * 2 - COL_GAP * 2;
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
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 0,
            rowGap: 10,
            columnGap: COL_GAP,
            justifyContent: 'center',
            alignContent: 'center',
            paddingBottom: 16,
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
              backgroundColor: selected ? 'rgba(22,163,74,0.15)' : '#1e293b',
              borderWidth: 1.5,
              borderColor: selected ? '#16a34a' : '#334155',
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
                }
              } else if (correctIds.includes(String(g.group_id)) && qStatus === 'incorrect') {
                cardStyle = {
                  ...cardStyle,
                  borderColor: '#16a34a',
                  borderWidth: 2.5,
                  opacity: 1,
                  backgroundColor: 'rgba(22,163,74,0.15)',
                };
                textColor = '#16a34a';
              } else {
                cardStyle = { ...cardStyle, opacity: 0.35 };
              }
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
            let showCheckmark = false;
            if (!isEditable) {
              if (isUserAnswer) {
                if (qStatus === 'correct') {
                  flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2, borderRadius: 5, padding: 1 };
                } else if (qStatus === 'incorrect') {
                  flagWrapperStyle = { borderColor: '#ef4444', borderWidth: 2, borderRadius: 5, padding: 1 };
                }
              } else if (isCorrectAnswer && qStatus === 'incorrect') {
                flagWrapperStyle = { borderColor: '#16a34a', borderWidth: 2.5, borderRadius: 5, padding: 1 };
                showCheckmark = true;
              } else {
                cellOpacity = 0.35;
              }
            } else if (selected) {
              flagWrapperStyle = { borderWidth: 2, borderColor: '#16a34a', borderRadius: 4, padding: 1 };
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
                  {showCheckmark && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
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
        return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
      };
      return (
        <View
          style={{
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
                    backgroundColor: '#1e293b',
                    borderWidth: 1,
                    borderColor: '#334155',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  isEditable && selected && styles.wizardPillSelected,
                  !isEditable && lockedStyle?.style,
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
        return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
      };
      return (
        <View style={[styles.pillGrid3col, { justifyContent: 'center' }]}>
          {opts.map((opt) => {
            const selected = String(localAnswers[field] ?? '') === opt.value;
            const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.wizardPill3col, { width: pillW }, isEditable && selected && styles.wizardPillSelected, !isEditable && lockedStyle?.style]}
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
        <View style={styles.pillGridK1}>
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
      return { style: styles.pillDimmed, textColor: undefined, showCheckmark: false };
    };
    return (
      <View style={styles.pillGrid}>
        {opts.map((opt) => {
          const selected = String(localAnswers[field] ?? '') === opt.value;
          const lockedStyle = !isEditable ? getLockedPillStyle(opt.value) : null;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.wizardPill, isEditable && selected && styles.wizardPillSelected, !isEditable && lockedStyle?.style]}
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
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
        <LinearGradient
          colors={['#16a34a', '#15803d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']} />
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBtnLeft} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.wizardHeaderCenter}>
              <Text style={styles.wizardSectionTitle}>
                {SECTION_NAMES[currentField].toUpperCase()}
              </Text>
              <Ionicons
                name={(SECTION_ICONS[SECTION_NAMES[currentField]] || 'help') as any}
                size={32}
                color="rgba(255,255,255,0.8)"
              />
            </View>
            <TouchableOpacity
              onPress={() => setViewMode('summary')}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Text style={styles.editPillText}>View All</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
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
                    <TouchableOpacity
                      onPress={handleShowStats}
                      style={styles.statsPillBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="stats-chart" size={14} color="#ffffff" />
                      <Text style={styles.statsPillText}>Stats</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.questionTextDark}>{QUESTION_LABELS[currentField]}</Text>
                  {prediction && !(prediction as any)[FIELD_TO_EDITABLE[currentField]] && (
                    <View style={styles.lockedNotice}>
                      <Ionicons name="lock-closed-outline" size={13} color="#64748b" />
                      <Text style={styles.lockedNoticeText}>This question is no longer open for editing</Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, paddingHorizontal: 20, marginTop: 8 }}>
                  {renderAnswerArea(currentField)}
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
              <Ionicons name="arrow-back" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navCircle}
              onPress={() => {
                if (currentStep < 9) setCurrentStep((p) => p + 1);
                else setViewMode('summary');
              }}
            >
              <Ionicons name="arrow-forward" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <ConfirmExitModal
          visible={showExitModal}
          changesCount={changedCount}
          onClose={() => setShowExitModal(false)}
          onConfirm={handleExitConfirm}
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
      g4: 'q_g4_status', g5: 'q_g5_status',
      k1: 'q_k1_status', k2: 'q_k2_status', k3: 'q_k3_status',
      t1: 'q_t1_status', t2: 'q_t2_status',
    };
    const statusKey = STATUS_FIELD[field];
    if (!statusKey) return 'pending';
    const val = (prediction as any)[statusKey];
    if (val === 'correct') return 'correct';
    if (val === 'incorrect' || val === 'wrong') return 'incorrect';  // handle both (DB stores 'wrong')
    return 'pending';
  };

  const renderSummarySection = (
    title: string,
    icon: string,
    fields: string[],
    isLocked: boolean
  ) => {
    const settled = getSectionSettled(fields);
    return (
      <View style={styles.sectionCardSummary} key={title}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name={icon as any} size={22} color="#16a34a" />
          <Text style={styles.sectionTitle}>{title}</Text>
          {(() => {
            const score = getSectionScore(title);
            if (score) {
              return (
                <View style={styles.sectionScoreChip}>
                  <Text style={styles.sectionScoreText}>{score.earned}/{score.possible} pts</Text>
                </View>
              );
            }
            if (isLocked) {
              return <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />;
            }
            return null;
          })()}
        </View>
        {fields.map((field, idx) => {
          const globalIdx = ALL_FIELDS.indexOf(field as FieldKey);
          const val = localAnswers[field];
          const answered = val != null && val !== '';
          const editable = isSectionEditable(field);
          const label = getAnswerLabel(field, val);
          const isLast = idx === fields.length - 1;
          const rowBg = idx % 2 === 0 ? '#1e293b' : '#243044';

          return (
            <TouchableOpacity
              key={field}
              style={[
                styles.summaryRowNew,
                { backgroundColor: rowBg },
                !isLast && styles.summaryRowBorder,
              ]}
              onPress={() => goToQuestion(globalIdx)}
              disabled={false}
            >
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryQNew}>Q{globalIdx + 1}</Text>
                <Text style={styles.summaryQuestionLabelNew} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {QUESTION_LABELS[field]}
                </Text>
              </View>
              <View style={styles.summaryRowRight}>
                {!answered ? (
                  <View style={styles.summaryRowRightContent}>
                    <Ionicons name="add-circle-outline" size={16} color="#cbd5e1" />
                    <Text style={styles.summaryAnswerPrompt}>Answer</Text>
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
                    <Text style={styles.summaryValueEditable}>{label}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#16a34a" />
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
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <LinearGradient
        colors={['#16a34a', '#15803d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrapper} pointerEvents="none">
              <Text style={styles.headerTitle}>Bonus Predictions</Text>
            </View>

            {!allAnswered ? (
              <TouchableOpacity
                onPress={() => setViewMode('wizard')}
                style={[styles.editPillBtn, { zIndex: 1 }]}
                hitSlop={8}
              >
                <Text style={styles.editPillText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <View style={styles.waveSvgContainer}>
            <Svg height="28" width="100%" viewBox="0 0 390 28" preserveAspectRatio="none">
              <Path d="M0,0 C97.5,28 292.5,28 390,0 L390,0 L0,0 Z" fill="#0f172a" />
            </Svg>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {finePerChangeVal > 0 && changedCount > 0 && (
        <View style={styles.changesChipsContainer}>
          <View style={styles.changesChip1}>
            <Ionicons name="create-outline" size={14} color="#94a3b8" />
            <Text style={styles.changesChip1Text}>
              {changedCount} change{changedCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View
            style={[
              styles.changesChip2,
              penaltyPoints > 0 ? styles.changesChip2Fine : styles.changesChip2NoFine,
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={14}
              color={penaltyPoints > 0 ? '#ef4444' : '#16a34a'}
            />
            <Text
              style={[
                styles.changesChip2Text,
                { color: penaltyPoints > 0 ? '#ef4444' : '#16a34a' },
              ]}
            >
              {penaltyPoints > 0 ? `Fine: -${penaltyPoints} pts` : '✓ No fine'}
            </Text>
          </View>
        </View>
      )}

        {renderSummarySection(
          'Group Stage',
          'home-outline',
          SECTION_GROUP_FIELDS,
          isSectionLocked(SECTION_GROUP_FIELDS)
        )}
        {renderSummarySection(
          'Knockout',
          'trophy-outline',
          SECTION_KNOCKOUT_FIELDS,
          isSectionLocked(SECTION_KNOCKOUT_FIELDS)
        )}
        {renderSummarySection(
          'Tournament',
          'medal-outline',
          SECTION_TOURNAMENT_FIELDS,
          isSectionLocked(SECTION_TOURNAMENT_FIELDS)
        )}
      </ScrollView>

      {finePerChangeVal > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, (!isDirty || saving) && styles.saveButtonDisabled]}
            onPress={() => (isDirty ? setShowSaveModal(true) : null)}
            disabled={!isDirty || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isDirty ? (
              <Text style={styles.saveButtonText}>Save</Text>
            ) : (
              <Text style={styles.saveButtonTextDisabled}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ConfirmSaveModal
        visible={showSaveModal}
        changesCount={changedCount}
        finePoints={penaltyPoints}
        finePerChange={finePerChangeVal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={handleSave}
      />

      <ConfirmExitModal
        visible={showExitModal}
        changesCount={changedCount}
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
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerBtn: { width: 60, alignItems: 'flex-end' },
  headerBtnLeft: { width: 60, alignItems: 'flex-start' },

  wizardDarkArea: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 20, paddingTop: 0 },
  progressBarContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  progressSegment: {
    width: (screenWidth - 40 - 36) / 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#334155',
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#0f172a',
  },
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
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
  },
  headerBackBtn: {
    width: 36,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  headerTitleWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 72,
    zIndex: 1,
  },
  statsPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statsPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    minWidth: 72,
  },
  editPillText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
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
    backgroundColor: '#1e293b',
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
  scrollContent: { padding: 20, paddingBottom: 140 },
  sectionCardSummary: {
    backgroundColor: '#1e293b',
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
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 10,
  },
  sectionScoreChip: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
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
    paddingVertical: 12,
  },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  summaryRowLeft: { flex: 1, marginRight: 8 },
  summaryRowRight: { alignItems: 'flex-end', minWidth: 80 },
  summaryRowRightContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryQNew: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5, marginBottom: 2 },
  summaryQuestionLabelNew: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  summaryAnswerPrompt: { fontSize: 12, color: '#475569' },
  summaryValueEditable: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  summaryValueSettled: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  summaryValueCorrect: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  summaryValueIncorrect: { fontSize: 13, color: '#ef4444', fontWeight: '700' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#0f172a',
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
