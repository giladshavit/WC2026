import React from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IS_RTL } from '../../utils/rtl';

/** Same as OnboardingScreen StatusBar / root (`#0f172a`) — header area matches status bar */
const STATUS_BAR_BG = '#0f172a';

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PAD = 16;
const CONTENT_WIDTH = SCREEN_WIDTH - H_PAD * 2;
const PILL_LABELS = ['0-29', '30-49', '50-69', '70-89', '90-109', '110+'] as const;
const Q2_PILL_LABELS = ['0', '1', '2', '3', '4', '5+'] as const;

const BONUS_QUESTIONS = [
  { key: 'g1', label: 'Total goals in Group Stage', section: 'Group Stage' },
  { key: 'g2', label: 'Teams finishing with 9/9 points', section: 'Group Stage' },
  { key: 'g3', label: 'Top scoring team in Group Stage', section: 'Group Stage' },
  { key: 'g4', label: 'Top scoring group', section: 'Group Stage' },
  { key: 'g5', label: 'Teams with clean sheets in Group Stage', section: 'Group Stage' },
  { key: 'g6', label: 'Scoreless draws (0:0) in Group Stage', section: 'Group Stage' },
  { key: 'k1', label: 'Total goals in Knockout Stage', section: 'Knockout' },
  { key: 'k2', label: 'Matches decided by penalty shootout', section: 'Knockout' },
  { key: 'k3', label: '3rd-place teams reaching Quarter Finals', section: 'Knockout' },
  { key: 't1', label: 'Total goals in the tournament', section: 'Tournament' },
  { key: 't2', label: 'Who will win the Tournament?', section: 'Tournament' },
  { key: 't3', label: 'Who will be the top scorer?', section: 'Tournament' },
] as const;

const BONUS_Q_KEYS = [
  'bonus_q1', 'bonus_q2', 'bonus_q3', 'bonus_q4',
  'bonus_q5', 'bonus_q6', 'bonus_q7', 'bonus_q8',
  'bonus_q9', 'bonus_q10', 'bonus_q11', 'bonus_q12',
] as const;

const SECTION_LABEL_KEYS: Record<string, string> = {
  'Group Stage': 'bonus_section_group',
  Knockout: 'bonus_section_knockout',
  Tournament: 'bonus_section_tournament',
};

const SECTION_ICONS: Record<string, 'home-outline' | 'trophy-outline' | 'medal-outline'> = {
  'Group Stage': 'home-outline',
  Knockout: 'trophy-outline',
  Tournament: 'medal-outline',
};

type Phase = 'summary' | 'wizard';

type BonusPageProps = { isActive: boolean };

export default function BonusPage({ isActive }: BonusPageProps) {
  const { t } = useTranslation();
  const mountedRef = React.useRef(true);

  const fadeSummary = React.useRef(new Animated.Value(1)).current;
  const wizardEnterX = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const contentSlideX = React.useRef(new Animated.Value(0)).current;
  const editScale = React.useRef(new Animated.Value(1)).current;
  const editGlow = React.useRef(new Animated.Value(0.4)).current;
  const pillTapScale = React.useRef(new Animated.Value(1)).current;
  const groupCardScale = React.useRef(new Animated.Value(1)).current;

  const [phase, setPhase] = React.useState<Phase>('summary');
  const [currentQ, setCurrentQ] = React.useState<1 | 2>(1);
  const [selectedPill, setSelectedPill] = React.useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
  const [q1Answered, setQ1Answered] = React.useState(false);
  const [q2Answered, setQ2Answered] = React.useState(false);
  const [headerHeight, setHeaderHeight] = React.useState(100);

  const wizardOpacity = fadeSummary.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  // Edit button glow pulse while summary is visible
  React.useEffect(() => {
    if (!isActive) {
      editGlow.stopAnimation();
      editGlow.setValue(0.4);
      return;
    }
    if (phase !== 'summary') {
      editGlow.stopAnimation();
      editGlow.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(editGlow, {
          toValue: 0.6,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(editGlow, {
          toValue: 0.2,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [phase, editGlow, isActive]);

  React.useEffect(() => {
    if (!isActive) {
      setPhase('summary');
      setCurrentQ(1);
      setSelectedPill(null);
      setSelectedGroup(null);
      setQ1Answered(false);
      setQ2Answered(false);
      fadeSummary.setValue(1);
      contentSlideX.setValue(0);
      wizardEnterX.setValue(SCREEN_WIDTH);
      editScale.setValue(1);
      pillTapScale.setValue(1);
      groupCardScale.setValue(1);
      editGlow.stopAnimation();
      editGlow.setValue(0.4);
      mountedRef.current = false;
    }
  }, [
    isActive,
    fadeSummary,
    contentSlideX,
    wizardEnterX,
    editScale,
    pillTapScale,
    groupCardScale,
    editGlow,
  ]);

  React.useEffect(() => {
    if (!isActive) return;

    mountedRef.current = true;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const run = async () => {
      if (!mountedRef.current) return;

      // —— Phase 0: SUMMARY (2.5s) ——
      if (!mountedRef.current) return;
      setPhase('summary');
      setCurrentQ(1);
      setSelectedPill(null);
      setSelectedGroup(null);
      setQ1Answered(false);
      setQ2Answered(false);
      fadeSummary.setValue(1);
      contentSlideX.setValue(0);
      wizardEnterX.setValue(SCREEN_WIDTH);
      editScale.setValue(1);
      pillTapScale.setValue(1);
      groupCardScale.setValue(1);

      await sleep(200);
      if (!mountedRef.current) return;

      // —— Phase 1: EDIT TAP (0.4s) ——
      await new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(editScale, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(editScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
      if (!mountedRef.current) return;

      // —— Phase 2: WIZARD Q1 (2s total) ——
      setPhase('wizard');
      setCurrentQ(1);
      wizardEnterX.setValue(SCREEN_WIDTH);
      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(fadeSummary, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(wizardEnterX, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
      if (!mountedRef.current) return;

      // Q1 visible: wait 1.2s then tap "50-69"
      await sleep(600);
      if (!mountedRef.current) return;

      await new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(pillTapScale, {
            toValue: 0.92,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(pillTapScale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
      if (!mountedRef.current) return;
      setSelectedPill('50-69');
      setQ1Answered(true);
      await sleep(210);
      if (!mountedRef.current) return;

      // —— Phase 3: SLIDE TO Q2 (0.5s) ——
      setCurrentQ(2);
      await new Promise<void>((resolve) => {
        Animated.timing(contentSlideX, {
          toValue: -CONTENT_WIDTH,
          duration: 500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      });
      if (!mountedRef.current) return;

      // —— Phase 4: WIZARD Q2 visible — animation ends here ——
      await sleep(700);
    };

    run();
    return () => {
      mountedRef.current = false;
    };
  }, [isActive]);

  const summaryCard = (
    <Animated.View style={[styles.summaryLayer, { top: headerHeight }, { opacity: fadeSummary }]}>
      <View style={[styles.summaryHeader, IS_RTL && { flexDirection: 'row-reverse' }]}>
        <View style={styles.summaryHeaderSpacer} />
        <Text style={[styles.summaryTitle, IS_RTL && { textAlign: 'center' }]} maxFontSizeMultiplier={1}>
          {t('onboarding.bonus_title')}
        </Text>
        <View style={styles.summaryHeaderEditWrap}>
          <AnimatedGlowEditButton editLabel={t('onboarding.bonus_edit')} editScale={editScale} editGlow={editGlow} />
        </View>
      </View>

      <View style={styles.summaryCard}>
        {BONUS_QUESTIONS.map((q, index) => {
          const showSectionHeader =
            index === 0 || BONUS_QUESTIONS[index - 1].section !== q.section;
          const qNum = index + 1;
          const isQ1 = index === 0;
          const isQ2 = index === 1;

          return (
            <React.Fragment key={q.key}>
              {showSectionHeader ? (
                <View style={styles.sectionHeaderBlock}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name={SECTION_ICONS[q.section] ?? 'home-outline'} size={18} color="#94a3b8" />
                    <Text style={styles.sectionHeaderText}>
                      {t(`onboarding.${SECTION_LABEL_KEYS[q.section]}`)}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={[styles.summaryRow, IS_RTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.qLabel}>Q{qNum}</Text>
                <Text style={[styles.summaryQText, IS_RTL && { textAlign: 'right' }]} numberOfLines={3}>
                  {t(`onboarding.${BONUS_Q_KEYS[index]}`)}
                </Text>
                {isQ1 ? (
                  q1Answered ? (
                    <Text style={styles.summaryAnswer}>50-69</Text>
                  ) : (
                    <View style={styles.summaryAnswerEmpty}>
                      <Ionicons name="add-circle-outline" size={16} color="#475569" />
                      <Text style={styles.summaryAnswerPrompt}>{t('onboarding.bonus_answer')}</Text>
                    </View>
                  )
                ) : isQ2 ? (
                  q2Answered ? (
                    <Text style={styles.summaryAnswer}>2</Text>
                  ) : (
                    <View style={styles.summaryAnswerEmpty}>
                      <Ionicons name="add-circle-outline" size={16} color="#475569" />
                      <Text style={styles.summaryAnswerPrompt}>{t('onboarding.bonus_answer')}</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.summaryAnswerEmpty}>
                    <Ionicons name="add-circle-outline" size={16} color="#475569" />
                    <Text style={styles.summaryAnswerPrompt}>{t('onboarding.bonus_answer')}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </View>
              {index < BONUS_QUESTIONS.length - 1 ? <View style={styles.summaryDivider} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </Animated.View>
  );

  const wizardPanel = (
    <Animated.View
      style={[
        styles.wizardLayer,
        { top: headerHeight, direction: 'ltr' },
        {
          opacity: wizardOpacity,
          transform: [{ translateX: wizardEnterX }],
        },
      ]}
    >
      <View style={styles.wizardTopBar}>
        <View style={[styles.wizardTopBarSide, { alignItems: 'flex-start' }]}>
          <Ionicons name="chevron-back" size={22} color="#94a3b8" />
        </View>
        <Text style={styles.wizardSectionTitle} maxFontSizeMultiplier={1}>GROUP STAGE</Text>
        <View style={[styles.wizardTopBarSide, { alignItems: 'flex-end' }]}>
          <View style={styles.viewAllPill}>
            <Text style={styles.viewAllText} allowFontScaling={false} numberOfLines={1}>View All</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressTrack}>
        {Array.from({ length: 12 }).map((_, i) => {
          const dim = i < currentQ;
          const bright = i === currentQ - 1;
          return (
            <View
              key={i}
              style={[
                styles.progressSeg,
                dim && styles.progressSegDim,
                bright && styles.progressSegBright,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.wizardSlideClip}>
        <Animated.View
          style={[
            styles.wizardSlideRow,
            { width: CONTENT_WIDTH * 2, transform: [{ translateX: contentSlideX }] },
          ]}
        >
          <View style={[styles.wizardPanelPage, { width: CONTENT_WIDTH }]}>
            <View style={styles.qChip}>
              <Text style={styles.qChipText}>Q1</Text>
            </View>
            <Text style={styles.questionTitle} maxFontSizeMultiplier={1}>
              {t('onboarding.wizard_q1_title')}
            </Text>
            <View style={styles.pillGrid}>
              {PILL_LABELS.map((label) => {
                const selected = selectedPill === label;
                return (
                  <Animated.View
                    key={label}
                    style={label === '50-69' ? { transform: [{ scale: pillTapScale }] } : undefined}
                  >
                    <View style={[styles.pill, selected && styles.pillSelected]}>
                      <Text style={[styles.pillText, selected && styles.pillTextSelected]} maxFontSizeMultiplier={1}>{label}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          <View style={[styles.wizardPanelPage, { width: CONTENT_WIDTH }]}>
            <View style={styles.qChip}>
              <Text style={styles.qChipText}>Q4</Text>
            </View>
            <Text style={styles.questionTitle} maxFontSizeMultiplier={1}>
              {t('onboarding.wizard_q4_title')}
            </Text>
            <View style={styles.pillGrid}>
              {Q2_PILL_LABELS.map((label) => {
                const selected = selectedGroup === label;
                return (
                  <Animated.View
                    key={label}
                    style={label === '2' ? { transform: [{ scale: groupCardScale }] } : undefined}
                  >
                    <View style={[styles.pill, selected && styles.pillSelected]}>
                      <Text style={[styles.pillText, selected && styles.pillTextSelected]} maxFontSizeMultiplier={1}>{label}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <View
        style={styles.staticHeader}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.bonusBadge}>
          <Text style={styles.bonusBadgeText} allowFontScaling={false}>
            {t('onboarding.bonus_badge')}
          </Text>
        </View>
        <Text style={styles.pageSubtitle} maxFontSizeMultiplier={1.15}>
          {t('onboarding.bonus_subtitle')}
        </Text>
      </View>

      {summaryCard}
      {wizardPanel}
    </View>
  );
}

function AnimatedGlowEditButton({
  editLabel,
  editScale,
  editGlow,
}: {
  editLabel: string;
  editScale: Animated.Value;
  editGlow: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.editPillOuter,
        {
          shadowColor: '#38bdf8',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 8,
          shadowOpacity: editGlow,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: editScale }] }}>
        <View style={styles.editPill}>
          <Text style={styles.editPillText} allowFontScaling={false}>{editLabel}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1e293b',
    direction: 'ltr',
  },
  staticHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: STATUS_BAR_BG,
  },
  bonusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
  },
  bonusBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
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
  summaryLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#1e293b',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 40,
  },
  summaryHeaderEditWrap: {
    zIndex: 1,
    width: 72,
    alignItems: 'flex-end',
  },
  summaryHeaderSpacer: {
    width: 72,
  },
  summaryTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  editPillOuter: {
    borderRadius: 999,
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  editPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
  },
  sectionHeaderBlock: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  summaryCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.15)',
    marginHorizontal: 12,
  },
  qLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
    width: 30,
  },
  summaryQText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
  },
  summaryAnswer: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    maxWidth: 80,
    textAlign: 'right',
  },
  summaryAnswerEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryAnswerPrompt: {
    fontSize: 12,
    color: '#475569',
  },
  wizardLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#1e293b',
  },
  wizardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    minHeight: 40,
  },
  wizardTopBarSide: {
    zIndex: 1,
    minWidth: 72,
  },
  wizardSectionTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  viewAllPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 18,
  },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
  },
  progressSegDim: {
    backgroundColor: 'rgba(22,163,74,0.45)',
  },
  progressSegBright: {
    backgroundColor: '#16a34a',
  },
  wizardSlideClip: {
    overflow: 'hidden',
    width: CONTENT_WIDTH,
    alignSelf: 'center',
  },
  wizardSlideRow: {
    flexDirection: 'row',
  },
  wizardPanelPage: {
    paddingHorizontal: 0,
  },
  qChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(22,163,74,0.2)',
    marginBottom: 12,
  },
  qChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  pill: {
    width: (CONTENT_WIDTH - 10) / 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#152a45',
    borderWidth: 1,
    borderColor: '#2d4a6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
});
