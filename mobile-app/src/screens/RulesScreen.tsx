import * as React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiService, AppConfig } from '../services/api';
import { IS_RTL } from '../utils/rtl';

const { width: screenWidth } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────────────

interface TableRow {
  cells: string[];
  highlight?: boolean;
}

interface ModeCardData {
  mode: string;
  emoji: string;
  color: string;
  description: string;
  includes: string[];
}

interface Section {
  id: string;
  title: string;
  emoji: string;
  content: ContentBlock[];
}

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'note'; text: string; color?: 'green' | 'yellow' | 'red'; showBasicBadge?: boolean }
  | { type: 'table'; headers: string[]; rows: TableRow[]; compact?: boolean; isWide?: boolean }
  | { type: 'subsection'; title: string; blocks: ContentBlock[]; variant?: 'prediction' | 'section' | 'spaced' }
  | { type: 'tiebreaker'; items: string[] }
  | { type: 'dual-tiebreaker' }
  | { type: 'temptation-card' }
  | { type: 'mode-cards'; cards: ModeCardData[] }
  | { type: 'stage-timeline' };

// ─── Content ─────────────────────────────────────────────────────────────────

function getSections(t: TFunction): Section[] {
  return [
    {
      id: 'intro',
      title: t('rules.introTitle'),
      emoji: '🎯',
      content: [
        { type: 'paragraph', text: t('rules.introP1') },
        { type: 'paragraph', text: t('rules.introP2') },
      ],
    },
    {
      id: 'classic',
      title: t('rules.classicTitle'),
      emoji: '⚽',
      content: [
        { type: 'paragraph', text: t('rules.classicIntroP1') },
        {
          type: 'subsection',
          title: t('rules.classicMatchTitle'),
          variant: 'prediction',
          blocks: [
            { type: 'paragraph', text: t('rules.classicMatchP1') },
            {
              type: 'table',
              headers: [t('rules.tableStage'), t('rules.tableDirection'), t('rules.tableExactScore')],
              rows: [
                { cells: [t('rules.tableGroupR32'), '2', '5'] },
                { cells: [t('rules.tableR16'), '3', '7'] },
                { cells: [t('rules.tableQF'), '4', '9'] },
                { cells: [t('rules.tableSF'), '5', '10'] },
                { cells: [t('rules.table3rd'), '6', '12'] },
                { cells: [t('rules.tableFinal'), '7', '15'] },
              ],
            },
            { type: 'temptation-card' },
          ],
        },
        {
          type: 'subsection',
          title: t('rules.classicBonusTitle'),
          variant: 'prediction',
          blocks: [
            { type: 'paragraph', text: t('rules.classicBonusP1') },
            {
              type: 'bullet',
              items: [
                t('rules.classicBonusBullet1'),
                t('rules.classicBonusBullet2'),
                t('rules.classicBonusBullet3'),
              ],
            },
            {
              type: 'table',
              headers: [t('rules.tableResult'), t('rules.tablePoints')],
              compact: true,
              rows: [{ cells: [t('rules.tableCorrectAnswer'), '8'] }],
            },
            {
              type: 'note',
              color: 'green',
              text: t('rules.classicBonusNoteBasic'),
              showBasicBadge: true,
            },
            {
              type: 'note',
              color: 'red',
              text: t('rules.classicBonusNoteLock'),
            },
          ],
        },
      ],
    },
    {
      id: 'multi',
      title: t('rules.multiTitle'),
      emoji: '🏆',
      content: [
        { type: 'paragraph', text: t('rules.multiP1') },
        {
          type: 'subsection',
          title: t('rules.multiGroupTitle'),
          variant: 'prediction',
          blocks: [
            { type: 'paragraph', text: t('rules.multiGroupP1') },
            {
              type: 'table',
              headers: [t('rules.tablePosition'), t('rules.tablePoints')],
              compact: true,
              rows: [
                { cells: [t('rules.tablePosition1'), '6'] },
                { cells: [t('rules.tablePosition2'), '5'] },
                { cells: [t('rules.tablePosition3'), '4'] },
                { cells: [t('rules.tablePosition4'), '2'] },
              ],
            },
          ],
        },
        {
          type: 'subsection',
          title: t('rules.multi3rdTitle'),
          variant: 'prediction',
          blocks: [
            { type: 'paragraph', text: t('rules.multi3rdSubtitle') },
            { type: 'paragraph', text: t('rules.multi3rdEditWindow') },
            { type: 'paragraph', text: t('rules.multi3rdScoringNote') },
            {
              type: 'table',
              headers: [t('rules.tableCorrectGroups'), t('rules.tablePoints')],
              compact: true,
              rows: [
                { cells: [t('rules.tableUpTo4'), '0'] },
                { cells: ['5', '6'] },
                { cells: ['6', '12'] },
                { cells: ['7', '18'] },
                { cells: ['8', '24'] },
              ],
            },
            {
              type: 'note',
              color: 'yellow',
              text: t('rules.multi3rdNote'),
            },
          ],
        },
        {
          type: 'subsection',
          title: t('rules.multiKnockoutTitle'),
          variant: 'prediction',
          blocks: [
            { type: 'paragraph', text: t('rules.multiKnockoutP1') },
            {
              type: 'table',
              headers: [t('rules.tableStage'), t('rules.tableFull'), t('rules.tablePartial')],
              rows: [
                { cells: [t('rules.tableRoundOf32'), '6', '3'] },
                { cells: [t('rules.tableR16'), '8', '4'] },
                { cells: [t('rules.tableQF'), '10', '5'] },
                { cells: [t('rules.tableSF'), '12', '6'] },
                { cells: [t('rules.tableFinal'), '15', '—'] },
              ],
            },
            {
              type: 'note',
              color: 'green',
              text: t('rules.multiKnockoutNoteGreen'),
            },
            {
              type: 'note',
              color: 'yellow',
              text: t('rules.multiKnockoutNoteYellow'),
            },
          ],
        },
        {
          type: 'subsection',
          title: t('rules.multiFinesTitle'),
          variant: 'section',
          blocks: [
            { type: 'paragraph', text: t('rules.multiFinesIntro') },
            {
              type: 'subsection',
              title: t('rules.multiFinesChangesTitle'),
              blocks: [
                { type: 'paragraph', text: t('rules.multiFinesChangesP1') },
                {
                  type: 'bullet',
                  items: [
                    t('rules.multiFinesChangesBullet1'),
                    t('rules.multiFinesChangesBullet2'),
                    t('rules.multiFinesChangesBullet3'),
                  ],
                },
              ],
            },
            {
              type: 'subsection',
              title: t('rules.multiFreeTitle'),
              variant: 'spaced',
              blocks: [
                { type: 'paragraph', text: t('rules.multiFreeP1') },
                {
                  type: 'table',
                  headers: [t('rules.tableStage'), t('rules.tableFreeChanges')],
                  compact: true,
                  rows: [
                    { cells: [t('rules.tableMatchday1Starts'), '+12'] },
                    { cells: [t('rules.tablePreR32'), '+8'] },
                    { cells: [t('rules.tablePreR16'), '+4'] },
                    { cells: [t('rules.tablePreQF'), '+2'] },
                    { cells: [t('rules.tablePreSF'), '+1'] },
                  ],
                },
              ],
            },
            {
              type: 'subsection',
              title: t('rules.multiFinesSubTitle'),
              variant: 'spaced',
              blocks: [
                { type: 'paragraph', text: t('rules.multiFinesPenaltyP1') },
                {
                  type: 'table',
                  headers: [t('rules.tableTournamentStage'), t('rules.tableFinePerChange')],
                  rows: [
                    { cells: [t('rules.tablePreTournament'), t('rules.tableFineFree')], highlight: true },
                    { cells: [t('rules.tableMatchday1'), t('rules.tableFineNeg1pt')] },
                    { cells: [t('rules.tableMatchday2'), t('rules.tableFineNeg1pt')] },
                    { cells: [t('rules.tableMatchday3'), t('rules.tableFineNeg2pts')] },
                    { cells: [t('rules.tablePreR32'), t('rules.tableFineNeg2pts')] },
                    { cells: [t('rules.tablePreR16'), t('rules.tableFineNeg3pts')] },
                    { cells: [t('rules.tablePreQF'), t('rules.tableFineNeg3pts')] },
                    { cells: [t('rules.tablePreSF'), t('rules.tableFineNeg4pts')] },
                  ],
                },
              ],
            },
            {
              type: 'subsection',
              title: t('rules.multiResetTitle'),
              variant: 'spaced',
              blocks: [
                { type: 'paragraph', text: t('rules.multiResetP1') },
                {
                  type: 'table',
                  headers: [t('rules.tableColor'), t('rules.tablePotentialPoints')],
                  compact: true,
                  rows: [
                    { cells: ['🔴', '0'] },
                    { cells: ['🟠', t('rules.tablePartialOnly')] },
                    { cells: ['⚪', t('rules.tableFull')] },
                  ],
                },
                { type: 'paragraph', text: t('rules.multiResetP2') },
                {
                  type: 'note',
                  color: 'green',
                  text: t('rules.multiResetNoteGreen'),
                },
                {
                  type: 'note',
                  color: 'yellow',
                  text: t('rules.multiResetNoteYellow'),
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'availability',
      title: t('rules.availabilityTitle'),
      emoji: '📅',
      content: [
        { type: 'paragraph', text: t('rules.availabilityP1') },
        {
          type: 'table',
          headers: [
            t('rules.tableStage'),
            t('rules.tableGroups'),
            t('rules.availabilityColThird'),
            t('rules.availabilityColR32'),
            t('rules.availabilityColR16'),
            t('rules.availabilityColQF'),
            t('rules.availabilityColSF'),
            t('rules.availabilityColFinal'),
          ],
          isWide: true,
          rows: [
            { cells: [t('rules.tablePreTournamentFull'), '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
            { cells: [t('rules.tableMatchday12'), '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
            { cells: [t('rules.tableMatchday3Full'), '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
            { cells: [t('rules.tablePreR32Full'), '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
            { cells: [t('rules.tablePreR16Full'), '❌', '❌', '❌', '✅', '✅', '✅', '✅'] },
            { cells: [t('rules.tablePreQFFullNew'), '❌', '❌', '❌', '❌', '✅', '✅', '✅'] },
            { cells: [t('rules.tablePreQFFull'), '❌', '❌', '❌', '❌', '❌', '✅', '✅'] },
            { cells: [t('rules.tableSFPlus'), '❌', '❌', '❌', '❌', '❌', '❌', '❌'] },
          ],
        },
        {
          type: 'note',
          color: 'red',
          text: t('rules.availabilityNote'),
        },
      ],
    },
    {
      id: 'leagues',
      title: t('rules.leaguesTitle'),
      emoji: '🏅',
      content: [
        { type: 'paragraph', text: t('rules.leaguesP1') },
        {
          type: 'mode-cards',
          cards: [
            {
              mode: t('rules.classicTitle'),
              emoji: '⚽',
              color: '#38bdf8',
              description: t('rules.leaguesClassicDesc'),
              includes: [t('rules.leaguesPillMatches'), t('rules.leaguesPillBonus')],
            },
            {
              mode: t('rules.multiTitle'),
              emoji: '🏆',
              color: '#f59e0b',
              description: t('rules.leaguesMultiDesc'),
              includes: [
                t('rules.leaguesPillMatches'),
                t('rules.leaguesPillBonus'),
                t('rules.leaguesPillGroups'),
                t('rules.leaguesPillKnockout'),
                t('rules.leaguesPillFines'),
              ],
            },
          ],
        },
        { type: 'dual-tiebreaker' },
      ],
    },
    {
      id: 'timeline',
      title: t('rules.timelineTitle'),
      emoji: '📆',
      content: [
        { type: 'paragraph', text: t('rules.timelineP1') },
        { type: 'stage-timeline' },
      ],
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderParagraphWithBold(text: string, t: TFunction) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[styles.paragraph, styles.paragraphWrap]}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          const boldColor =
            boldText === t('rules.classicModeName')
              ? '#38bdf8'
              : boldText === t('rules.multiModeName')
                ? '#f59e0b'
                : '#e2e8f0';
          return (
            <Text key={i} style={[styles.paragraph, styles.paragraphBold, { color: boldColor }]}>
              {boldText}
            </Text>
          );
        }
        return (
          <Text key={i} style={[styles.paragraph]}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Table Component ──────────────────────────────────────────────────────────

function RulesTable({
  headers,
  rows,
  compact,
  isWide: isWideProp,
}: {
  headers: string[];
  rows: TableRow[];
  compact?: boolean;
  isWide?: boolean;
}) {
  const isWide = isWideProp ?? headers.length > 3;
  const isThreeCol = headers.length === 3 && !isWide && !compact;

  const tableContent = (
    <View style={[styles.table, isWide && { minWidth: screenWidth * 1.3 }]}>
      <View style={styles.tableHeaderRow}>
        {headers.map((h, j) => (
          <View
            key={j}
            style={[
              styles.tableCell,
              j === 0 && (compact ? styles.tableCellCompact : styles.tableCellWide),
              isWide && j !== 0 && styles.tableCellNarrow,
              isWide && { flex: j === 0 ? 1.8 : 1, paddingHorizontal: 2 },
              isThreeCol && (j === 1 || j === 2) && { flex: 3.2 },
            ]}
          >
            <Text
              style={[
                styles.tableHeaderText,
                isThreeCol && (j === 1 || j === 2) && { fontSize: 10 },
              ]}
              numberOfLines={isThreeCol && (j === 1 || j === 2) ? 1 : 2}
              adjustsFontSizeToFit={
                !!(isThreeCol && (j === 1 || j === 2))
              }
              minimumFontScale={
                isThreeCol && (j === 1 || j === 2) ? 0.5 : undefined
              }
            >
              {h}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, j) => (
        <View
          key={j}
          style={[
            styles.tableRow,
            j % 2 === 1 && styles.tableRowAlt,
            row.highlight && styles.tableRowHighlight,
            j === rows.length - 1 && styles.tableRowLast,
          ]}
        >
          {row.cells.map((cell, k) => (
            <View
              key={k}
              style={[
                styles.tableCell,
                k === 0 && (compact ? styles.tableCellCompact : styles.tableCellWide),
                isWide && k !== 0 && styles.tableCellNarrow,
                isWide && { flex: k === 0 ? 1.8 : 1 },
                isThreeCol && (k === 1 || k === 2) && { flex: 3.2 },
              ]}
            >
              <Text
                style={[
                  styles.tableCellText,
                  k === 0 && styles.tableCellTextFirst,
                  row.highlight && k !== 0 && styles.tableCellTextHighlight,
                ]}
              >
                {cell}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  if (isWide) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.tableScrollWrap}
      >
        {tableContent}
      </ScrollView>
    );
  }

  return <View style={styles.tableWrap}>{tableContent}</View>;
}

// ─── Dual Tiebreaker Card ──────────────────────────────────────────────────────

function DualTiebreakerCard() {
  const { t } = useTranslation();
  const classicItems = [
    t('rules.tiebreakerTotalPoints'),
    t('rules.tiebreakerMatchPoints'),
    t('rules.tiebreakerExactScores'),
    t('rules.tiebreakerDirection'),
    t('rules.tiebreakerRegistration'),
  ];
  const multiItems = [
    t('rules.tiebreakerTotalPoints'),
    t('rules.tiebreakerFewerFines'),
    t('rules.tiebreakerMatchPoints'),
    t('rules.tiebreakerRegistration'),
  ];
  // Under forceRTL, use `row` so layout follows reading direction; `row-reverse` inverts and fights RTL.
  const rowDir = 'row';

  return (
    <View style={tbStyles.container}>
      <Text style={[tbStyles.mainTitle]}>{t('rules.tiebreakerTitle')}</Text>
      <Text style={[tbStyles.subtitle]}>{t('rules.tiebreakerSubtitle')}</Text>
      <View style={tbStyles.row}>
        {/* Classic */}
        <View style={[tbStyles.card, { borderColor: '#38bdf855' }]}>
          <View style={[tbStyles.cardHeader, { flexDirection: rowDir }]}>
            <Text style={tbStyles.cardEmoji}>⚽</Text>
            <Text
              style={[tbStyles.cardTitle, { color: '#38bdf8' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.2}
            >
              {t('rules.classicTitle')}
            </Text>
          </View>
          <View style={[tbStyles.cardDivider, { backgroundColor: '#38bdf833' }]} />
          {classicItems.map((item, i) => (
            <View key={i} style={[tbStyles.itemRow, { flexDirection: rowDir }]}>
              <View style={tbStyles.badge}>
                <Text style={tbStyles.badgeText}>{i + 1}</Text>
              </View>
              <Text
                style={[tbStyles.itemText]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
        {/* Multi */}
        <View style={[tbStyles.card, { borderColor: '#f59e0b55' }]}>
          <View style={[tbStyles.cardHeader, { flexDirection: rowDir }]}>
            <Text style={tbStyles.cardEmoji}>🏆</Text>
            <Text
              style={[tbStyles.cardTitle, { color: '#f59e0b' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.2}
            >
              {t('rules.multiTitle')}
            </Text>
          </View>
          <View style={[tbStyles.cardDivider, { backgroundColor: '#f59e0b33' }]} />
          {multiItems.map((item, i) => (
            <View key={i} style={[tbStyles.itemRow, { flexDirection: rowDir }]}>
              <View style={tbStyles.badge}>
                <Text style={tbStyles.badgeText}>{i + 1}</Text>
              </View>
              <Text
                style={[tbStyles.itemText]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const tbStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1e38',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1a3060',
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#111e35',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
    borderRadius: 1,
  },
  cardEmoji: {
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'left',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  itemText: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '500',
    textAlign: 'left',
  },
});

// ─── Stage Timeline Block ─────────────────────────────────────────────────────

interface StageTimelineItem {
  stage: string;
  label: string;
  start: string | null;
  end: string | null;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stageToLabel(stage: string, t: TFunction, fallbackLabel: string): string {
  const keyByStage: Record<string, string> = {
    PRE_GROUP_STAGE: 'home.stages.PRE_GROUP_STAGE',
    GROUP_CYCLE_1: 'home.stages.GROUP_CYCLE_1',
    GROUP_CYCLE_2: 'home.stages.GROUP_CYCLE_2',
    GROUP_CYCLE_3: 'home.stages.GROUP_CYCLE_3',
    PRE_ROUND32: 'home.stages.PRE_ROUND32',
    ROUND32: 'home.stages.ROUND32',
    PRE_ROUND16: 'home.stages.PRE_ROUND16',
    ROUND16: 'home.stages.ROUND16',
    PRE_QUARTER: 'home.stages.PRE_QUARTER',
    QUARTER: 'home.stages.QUARTER',
    PRE_SEMI: 'home.stages.PRE_SEMI',
    SEMI: 'home.stages.SEMI',
    PRE_FINAL: 'home.stages.PRE_FINAL',
    FINAL: 'home.stages.FINAL',
  };
  const key = keyByStage[stage];
  return key ? t(key) : fallbackLabel;
}

const timelineStyles = StyleSheet.create({
  tableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a2a45',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f1e38',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a45',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#0a1628',
    borderBottomWidth: 1,
    borderBottomColor: '#111e35',
  },
  tableRowAlt: {
    backgroundColor: '#0c1c30',
  },
  tableRowActive: {
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderBottomColor: '#1a3a2a',
  },
  col0: {
    flex: 1.6,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
  },
  col1: {
    flex: 1,
    paddingLeft: 6,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  stageLabelActive: {
    color: '#e2e8f0',
  },
  dateText: {
    fontSize: 11,
    color: '#7a8fa6',
  },
});

function StageTimelineBlock({ t }: { t: TFunction }) {
  const [timeline, setTimeline] = React.useState<StageTimelineItem[] | null>(null);
  const [currentStage, setCurrentStage] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiService.getAppConfig().then((data: AppConfig) => {
      setTimeline(data.stage_timeline ?? []);
      setCurrentStage(data.current_stage ?? null);
    }).catch(() => {});
  }, []);

  if (!timeline) return <ActivityIndicator color="#16a34a" />;

  const filtered = timeline.filter(
    (item) =>
      (item.start != null || item.end != null) &&
      item.stage !== 'TOURNAMENT_OVER' &&
      item.stage !== 'THIRD_PLACE'
  );

  const STAGE_ORDER = [
    'PRE_GROUP_STAGE', 'GROUP_CYCLE_1', 'GROUP_CYCLE_2', 'GROUP_CYCLE_3',
    'PRE_ROUND32', 'ROUND32', 'PRE_ROUND16', 'ROUND16',
    'PRE_QUARTER', 'QUARTER', 'PRE_SEMI', 'SEMI',
    'PRE_FINAL', 'FINAL',
  ];
  filtered.sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.stage);
    const bi = STAGE_ORDER.indexOf(b.stage);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const semiIndex = STAGE_ORDER.indexOf('SEMI');
  const rowsUpToSemi = filtered.filter((item) => {
    const idx = STAGE_ORDER.indexOf(item.stage);
    return idx !== -1 && idx <= semiIndex;
  });

  return (
    <View style={timelineStyles.tableContainer}>
      {/* Header row */}
      <View style={timelineStyles.tableHeader}>
        <Text style={[timelineStyles.col0, timelineStyles.headerText]}>
          {t('rules.timelineStageHeader')}
        </Text>
        <Text style={[timelineStyles.col1, timelineStyles.headerText]}>
          {t('rules.timelineStartHeader')}
        </Text>
        <Text style={[timelineStyles.col1, timelineStyles.headerText]}>
          {t('rules.timelineEndHeader')}
        </Text>
      </View>

      {rowsUpToSemi.map((item, index) => {
        const isActive = item.stage === currentStage;
        const isFirst = index === 0;
        const isLast = index === rowsUpToSemi.length - 1;

        const startStr = isFirst ? '—' : formatDate(item.start);
        let endStr = isLast ? '—' : formatDate(item.end);
        if (item.stage === 'SEMI') {
          endStr = '—';
        }

        return (
          <View
            key={item.stage}
            style={[
              timelineStyles.tableRow,
              isActive && timelineStyles.tableRowActive,
              isActive && { borderLeftWidth: 3, borderLeftColor: '#16a34a' },
              index % 2 === 1 && !isActive && timelineStyles.tableRowAlt,
            ]}
          >
            <View style={timelineStyles.col0}>
              <Text
                style={[timelineStyles.stageLabel, isActive && timelineStyles.stageLabelActive]}
              >
                {item.stage === 'SEMI'
                  ? t('rules.semiEnd')
                  : stageToLabel(item.stage, t, item.label)}
              </Text>
            </View>
            <Text style={[timelineStyles.col1, timelineStyles.dateText]}>{startStr}</Text>
            <Text style={[timelineStyles.col1, timelineStyles.dateText]}>{endStr}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Block Renderer ───────────────────────────────────────────────────────────

function RenderBlocks({ blocks, t }: { blocks: ContentBlock[]; t: TFunction }) {
  const rowDir = 'row';

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return <View key={i}>{renderParagraphWithBold(block.text, t)}</View>;

          case 'note': {
            if (block.color === 'green' && block.showBasicBadge === true) {
              return (
                <View
                  key={i}
                  style={[
                    styles.noteBox,
                    IS_RTL
                      ? { borderRightWidth: 3, borderRightColor: '#16a34a' }
                      : { borderLeftWidth: 3, borderLeftColor: '#16a34a' },
                    { alignItems: 'flex-start' },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: rowDir,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    <View style={styles.basicBadge}>
                      <Text style={styles.basicBadgeText}>{t('rules.basicBadge')}</Text>
                    </View>
                    <Text style={styles.noteText}>{block.text}</Text>
                  </View>
                </View>
              );
            }
            const borderColor =
              block.color === 'red'
                ? '#ef4444'
                : block.color === 'yellow'
                ? '#f59e0b'
                : '#16a34a';
            return (
              <View
                key={i}
                style={[
                  styles.noteBox,
                  IS_RTL
                    ? { borderRightWidth: 3, borderRightColor: borderColor }
                    : { borderLeftWidth: 3, borderLeftColor: borderColor },
                  { alignItems: 'flex-start' },
                ]}
              >
                <Text style={styles.noteText}>{block.text}</Text>
              </View>
            );
          }

          case 'bullet':
            return (
              <View key={i} style={styles.bulletList}>
                {block.items.map((item, j) => {
                  const isTournament = item === t('rules.classicBonusBullet1');
                  if (isTournament) {
                    return (
                      <View key={j} style={[styles.bulletRow, { flexDirection: rowDir }]}>
                        <View style={styles.bulletDot} />
                        <View
                          style={{
                            flexDirection: rowDir,
                            alignItems: 'center',
                            gap: 6,
                            flexShrink: 1,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Text style={[styles.bulletText, { flexShrink: 1 }]}>
                            {t('rules.classicBonusBullet1')}
                          </Text>
                          <View style={styles.basicBadge}>
                            <Text style={styles.basicBadgeText}>{t('rules.basicBadge')}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={j} style={[styles.bulletRow, { flexDirection: rowDir }]}>
                      <View style={styles.bulletDot} />
                      <Text style={[styles.bulletText]}>{item}</Text>
                    </View>
                  );
                })}
              </View>
            );

          case 'table':
            return (
              <RulesTable
                key={i}
                headers={block.headers}
                rows={block.rows}
                compact={block.compact}
                isWide={block.isWide}
              />
            );

          case 'subsection':
            return (
              <View
                key={i}
                style={[
                  styles.subsection,
                  block.variant === 'prediction' && styles.subsectionPredictionSpacing,
                  block.variant === 'spaced' && styles.subsectionSpaced,
                ]}
              >
                {block.variant === 'prediction' ? (
                  <Text style={[styles.subsectionLabelA]}>{block.title}</Text>
                ) : block.variant === 'section' ? (
                  <Text style={[styles.subsectionTitleSection]}>{block.title}</Text>
                ) : (
                  <Text style={[styles.subsectionTitle]}>{block.title}</Text>
                )}
                <RenderBlocks blocks={block.blocks} t={t} />
              </View>
            );

          case 'dual-tiebreaker':
            return <DualTiebreakerCard key={i} />;

          case 'tiebreaker':
            return (
              <View key={i} style={styles.tiebreakerCard}>
                <Text style={[styles.tiebreakerTitle]}>{t('rules.tiebreakerTitle')}</Text>
                <Text style={[styles.tiebreakerSub]}>{t('rules.tiebreakerSubtitle')}</Text>
                {block.items.map((item, j) => (
                  <View key={j} style={[styles.tiebreakerRow, { flexDirection: rowDir }]}>
                    <View style={styles.tiebreakerBadge}>
                      <Text style={styles.tiebreakerBadgeText}>{j + 1}</Text>
                    </View>
                    <Text style={[styles.tiebreakerText]}>{item}</Text>
                  </View>
                ))}
              </View>
            );

          case 'temptation-card':
            return (
              <View key={i} style={styles.temptationCard}>
                <Text style={[styles.temptationTitle]}>{t('rules.temptationTitle')}</Text>
                <View style={styles.temptationDivider} />
                <Text style={[styles.temptationBody]}>{t('rules.temptationBody')}</Text>
              </View>
            );

          case 'stage-timeline':
            return <StageTimelineBlock key={i} t={t} />;

          case 'mode-cards':
            return (
              <View key={i} style={styles.modeCardsRow}>
                {block.cards.map((card, j) => (
                  <View key={j} style={[styles.modeCard, { borderColor: card.color + '55' }]}>
                    <View style={[styles.modeCardHeader, { flexDirection: rowDir }]}>
                      <Text style={styles.modeCardEmoji}>{card.emoji}</Text>
                      <Text
                        style={[styles.modeCardName, { color: card.color }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        maxFontSizeMultiplier={1.2}
                      >
                        {card.mode}
                      </Text>
                    </View>
                    <Text
                      style={[styles.modeCardDesc]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.2}
                    >
                      {card.description}
                    </Text>
                    <View style={styles.modeCardDivider} />
                    <View style={styles.modeCardPills}>
                      {card.includes.map((item, k) => (
                        <View key={k} style={styles.modeCardPill}>
                          <Text
                            style={[styles.modeCardPillText]}
                            numberOfLines={2}
                            maxFontSizeMultiplier={1.2}
                          >
                            {item}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );

          default:
            return null;
        }
      })}
    </>
  );
}

// ─── Nav Menu Modal ───────────────────────────────────────────────────────────

function NavMenu({
  visible,
  onClose,
  onSelect,
  activeId,
  sections,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  activeId: string;
  sections: Section[];
}) {
  const { t } = useTranslation();
  const rowDir = 'row';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <Text style={[styles.menuTitle]}>{t('rules.jumpToSection')}</Text>
          {sections.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.menuItem, { flexDirection: rowDir }, activeId === s.id && styles.menuItemActive]}
              onPress={() => {
                onSelect(s.id);
                onClose();
              }}
            >
              <Text style={styles.menuItemEmoji}>{s.emoji}</Text>
              <Text
                style={[styles.menuItemText, activeId === s.id && styles.menuItemTextActive]}
              >
                {s.title}
              </Text>
              {activeId === s.id && (
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RulesScreen() {
  const { t } = useTranslation();
  const sections = getSections(t);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);
  const sectionOffsets = React.useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = React.useState('intro');
  const [menuVisible, setMenuVisible] = React.useState(false);

  const scrollToSection = (id: string) => {
    const offset = sectionOffsets.current[id];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({ y: offset - 16, animated: true });
    }
    setActiveSection(id);
  };

  const activeEmoji = sections.find((s) => s.id === activeSection)?.emoji ?? '';
  const activeTitle = sections.find((s) => s.id === activeSection)?.title ?? '';
  const activeIndex = sections.findIndex((s) => s.id === activeSection);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
            size={24}
            color="#f1f5f9"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>{t('rules.screenTitle')}</Text>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnFilled]}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={20} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      {/* Section indicator bar */}
      <TouchableOpacity
        style={styles.sectionBar}
        onPress={() => setMenuVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionBarEmoji}>{activeEmoji}</Text>
        <Text style={[styles.sectionBarTitle]} numberOfLines={1}>
          {activeTitle}
        </Text>
        <View style={styles.sectionBarDots}>
          {sections.map((_, i) => (
            <View
              key={i}
              style={[
                styles.sectionBarDot,
                i === activeIndex && styles.sectionBarDotActive,
              ]}
            />
          ))}
        </View>
        <Ionicons name="chevron-down" size={14} color="#475569" />
      </TouchableOpacity>

      {/* Nav menu */}
      <NavMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelect={scrollToSection}
        activeId={activeSection}
        sections={sections}
      />

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 40,
            width: '100%',
            alignItems: 'stretch',
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const entries = Object.entries(sectionOffsets.current).sort(([, a], [, b]) => a - b);
          for (let i = entries.length - 1; i >= 0; i--) {
            if (y >= entries[i][1] - 80) {
              setActiveSection(entries[i][0]);
              break;
            }
          }
        }}
        scrollEventThrottle={16}
      >
        {sections.map((section) => (
          <View
            key={section.id}
            onLayout={(e) => {
              sectionOffsets.current[section.id] = e.nativeEvent.layout.y;
            }}
            style={[styles.section, { width: '100%' }]}
          >
            <View style={[styles.sectionHeader, { width: '100%' }]}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <Text
                style={[styles.sectionTitle, { flex: 1 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.3}
              >
                {section.title}
              </Text>
            </View>
            <View style={styles.sectionDivider} />
            <RenderBlocks blocks={section.content} t={t} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a1628',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a45',
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnFilled: {
    backgroundColor: '#1a2a45',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },

  // Section indicator bar
  sectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111e35',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a45',
    alignSelf: 'stretch',
  },
  sectionBarEmoji: { fontSize: 15 },
  sectionBarTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sectionBarDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  sectionBarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e3050',
  },
  sectionBarDotActive: {
    backgroundColor: '#16a34a',
    width: 14,
  },

  // Nav Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#111e35',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 2,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e3050',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuItemActive: { backgroundColor: '#0a1628' },
  menuItemEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  menuItemTextActive: { color: '#f1f5f9', fontWeight: '700' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 36,
  },

  // Section
  section: { gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  sectionEmoji: { fontSize: 22 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    flexShrink: 1,
    textAlign: 'left',
  },
  sectionDivider: {
    height: 2,
    backgroundColor: '#16a34a',
    width: 36,
    borderRadius: 2,
    alignSelf: 'auto',
  },

  // Subsection
  subsection: { gap: 8, marginTop: 4, alignSelf: 'stretch' },
  subsectionPredictionSpacing: { marginTop: 30 },
  subsectionSpaced: { marginTop: 24 },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  subsectionTitleSection: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e2e8f0',
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  subsectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#111e35',
    borderWidth: 1,
    borderColor: '#1a2a45',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingLeft: 10,
    gap: 10,
    marginBottom: 2,
  },
  subsectionLabelAccent: {
    width: 3,
    height: 18,
    backgroundColor: '#16a34a',
    borderRadius: 2,
  },
  subsectionLabelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.3,
  },
  subsectionLabelA: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'stretch',
    textAlign: 'left',
  },

  // Paragraph
  paragraph: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    textAlign: 'left',
  },
  paragraphWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  paragraphBold: {
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'left',
  },

  // Note
  noteBox: {
    backgroundColor: '#111e35',
    borderRadius: 8,
    padding: 12,
  },
  noteText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    textAlign: 'left',
  },

  // Bullet
  bulletList: { gap: 8, alignItems: 'stretch' },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    textAlign: 'left',
  },
  basicBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  basicBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },

  // Table
  tableWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a2a45',
  },
  tableScrollWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a2a45',
  },
  table: { minWidth: screenWidth - 40 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0f1e38',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a45',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0a1628',
    borderBottomWidth: 1,
    borderBottomColor: '#111e35',
  },
  tableRowAlt: { backgroundColor: '#0d1e35' },
  tableRowHighlight: { backgroundColor: 'rgba(22,163,74,0.1)' },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#111e35',
  },
  tableCellWide: { minWidth: 150, alignItems: 'flex-start' },
  tableCellCompact: { minWidth: 120, alignItems: 'flex-start' },
  tableCellNarrow: { minWidth: 50, paddingHorizontal: 6 },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tableCellText: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  tableCellTextFirst: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  tableCellTextHighlight: { color: '#86efac', fontWeight: '700' },

  // Tiebreaker card
  tiebreakerCard: {
    backgroundColor: '#0f1e38',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1a3060',
  },
  tiebreakerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  tiebreakerSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  tiebreakerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tiebreakerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tiebreakerBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  tiebreakerText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  },

  // Temptation card
  temptationCard: {
    backgroundColor: '#1a0a2e',
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    gap: 0,
  },
  temptationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a78bfa',
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  temptationDivider: {
    height: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    marginVertical: 10,
  },
  temptationBody: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    alignSelf: 'stretch',
    textAlign: 'left',
  },

  // Mode cards
  modeCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#111e35',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeCardEmoji: { fontSize: 18 },
  modeCardName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'left',
  },
  modeCardDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'left',
  },
  modeCardDivider: {
    height: 1,
    backgroundColor: '#1a2a45',
    marginVertical: 2,
  },
  modeCardPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeCardPill: {
    backgroundColor: '#0a1628',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeCardPillText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'left',
  },
});
