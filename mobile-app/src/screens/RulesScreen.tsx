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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────────────

interface TableRow {
  cells: string[];
  highlight?: boolean;
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
  | { type: 'note'; text: string; color?: 'green' | 'yellow' | 'red' }
  | { type: 'table'; headers: string[]; rows: TableRow[]; compact?: boolean }
  | { type: 'subsection'; title: string; blocks: ContentBlock[] }
  | { type: 'league-sort-card'; items: string[] }
  | { type: 'tiebreaker'; items: string[] };

// ─── Content ─────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: 'intro',
    title: 'What is Predicto?',
    emoji: '🎯',
    content: [
      {
        type: 'paragraph',
        text: 'Predicto is a prediction app for the 2026 FIFA World Cup. Your goal is to correctly predict as many outcomes as possible — match results, group standings, the knockout bracket, and bonus questions — and outscore your friends.',
      },
    ],
  },
  {
    id: 'types',
    title: 'Prediction Types',
    emoji: '🗂️',
    content: [
      {
        type: 'subsection',
        title: '1. Match Predictions 🥅',
        blocks: [
          {
            type: 'paragraph',
            text: 'Predict the exact scoreline of each match. Only the result after 90 minutes (plus stoppage time) counts — extra time and penalty shootouts are excluded.',
          },
          {
            type: 'paragraph',
            text: 'Predictions lock automatically at kick-off and cannot be changed after the whistle.',
          },
          {
            type: 'note',
            color: 'yellow',
            text: "🎰 Temptation — High Risk / High Reward: Tap the Temptation button to receive 3 rare scoreline options that very few players have predicted. Guess correctly and your points are doubled. Offers change in real time based on other players' picks.",
          },
        ],
      },
      {
        type: 'subsection',
        title: '2. Path Predictions (Bracket) 🏆',
        blocks: [
          {
            type: 'paragraph',
            text: 'Predict the full tournament path, split into three sub-types:',
          },
          {
            type: 'bullet',
            items: [
              'Groups — Predict the exact finishing order (1st–4th) for all 4 teams in each of the 12 groups. Editable until the end of Matchday 2.',
              '3rd Place — Choose 8 of the 12 groups whose 3rd-place team will advance to the Round of 32. Editable until the end of Matchday 2.',
              'Knockout — Predict the winner of every match from the Round of 32 through the Final. Each round is editable until it begins, but no later than the start of the Quarter-Finals.',
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: '3. Bonus Predictions 🎰',
        blocks: [
          {
            type: 'paragraph',
            text: '10 questions covering the group stage, knockout stage, and the tournament overall. Pick one answer per question.',
          },
          {
            type: 'bullet',
            items: [
              'Group-stage bonus questions: editable until end of Matchday 2.',
              'Knockout & tournament bonus questions: editable until the Round of 16 begins.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'scoring',
    title: 'Scoring',
    emoji: '🧮',
    content: [
      {
        type: 'subsection',
        title: 'Match Predictions',
        blocks: [
          {
            type: 'paragraph',
            text: 'Two scoring tiers — Correct Direction (right winner or draw, wrong scoreline) and Exact Score (perfect scoreline):',
          },
          {
            type: 'table',
            headers: ['Stage', 'Correct Direction', 'Exact Score'],
            rows: [
              { cells: ['Group Stage', '2', '5'] },
              { cells: ['Round of 32', '2', '5'] },
              { cells: ['Round of 16', '3', '7'] },
              { cells: ['Quarter-Final', '4', '9'] },
              { cells: ['Semi-Final', '5', '10'] },
              { cells: ['Final', '7', '15'] },
            ],
          },
          {
            type: 'note',
            color: 'yellow',
            text: '💡 Temptation picks earn double points in both tiers.',
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Group Stage Predictions',
        blocks: [
          {
            type: 'paragraph',
            text: 'Points per team placed in the correct position:',
          },
          {
            type: 'table',
            headers: ['Position', 'Points'],
            compact: true,
            rows: [
              { cells: ['1st Place', '6'] },
              { cells: ['2nd Place', '5'] },
              { cells: ['3rd Place', '4'] },
              { cells: ['4th Place', '2'] },
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: '3rd Place Predictions',
        blocks: [
          {
            type: 'paragraph',
            text: 'Points based on how many groups you correctly identified. Since you pick 8 of 12, at least 4 are always correct — scoring starts from 5:',
          },
          {
            type: 'table',
            headers: ['Correct Groups', 'Points'],
            compact: true,
            rows: [
              { cells: ['Up to 4', '0'] },
              { cells: ['5', '6'] },
              { cells: ['6', '12'] },
              { cells: ['7', '18'] },
              { cells: ['8', '24'] },
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Knockout Predictions',
        blocks: [
          {
            type: 'paragraph',
            text: 'Full Points if you predicted the exact match winner. Partial Points if your pick advanced through a different match in the same round:',
          },
          {
            type: 'table',
            headers: ['Stage', 'Full', 'Partial'],
            rows: [
              { cells: ['Round of 32', '6', '3'] },
              { cells: ['Round of 16', '8', '4'] },
              { cells: ['Quarter-Final', '10', '5'] },
              { cells: ['Semi-Final', '12', '6'] },
              { cells: ['Final', '15', '—'] },
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Bonus Predictions',
        blocks: [
          {
            type: 'table',
            headers: ['Result', 'Points'],
            compact: true,
            rows: [{ cells: ['Correct answer', '8'] }],
          },
        ],
      },
    ],
  },
  {
    id: 'fines',
    title: 'Fines',
    emoji: '⚠️',
    content: [
      {
        type: 'paragraph',
        text: 'A fixed fine is deducted per change at the moment you tap Save, based on the current tournament stage:',
      },
      {
        type: 'table',
        headers: ['Tournament Stage', 'Fine / Change'],
        rows: [
          { cells: ['Before the tournament', '0 (free)'], highlight: true },
          { cells: ['Matchday 1', '−1 pt'] },
          { cells: ['Matchday 2', '−2 pts'] },
          { cells: ['Matchday 3', '−3 pts'] },
          { cells: ['Before Round of 32', '−4 pts'] },
          { cells: ['Before Round of 16', '−5 pts'] },
          { cells: ['Before Quarter-Finals', '−6 pts'] },
        ],
      },
      {
        type: 'note',
        color: 'red',
        text: '⚠️ Every bracket change (groups, 3rd place, knockout) cascades to later stages — you may need to update additional picks as a result.',
      },
      {
        type: 'subsection',
        title: 'Draft Mode',
        blocks: [
          {
            type: 'paragraph',
            text: 'Edit path predictions freely in Draft Mode and see how each change affects the full bracket — no fine is applied until you tap Save.',
          },
        ],
      },
    ],
  },
  {
    id: 'availability',
    title: 'Prediction Availability',
    emoji: '📅',
    content: [
      {
        type: 'paragraph',
        text: 'Each prediction type has a window during which it can be edited. Once a stage begins or the deadline passes, it locks:',
      },
      {
        type: 'table',
        headers: ['Stage', 'Groups', '3rd', 'R32', 'R16', 'QF', 'SF', 'Final'],
        rows: [
          { cells: ['Pre', '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['MD1', '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['MD2', '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['MD3', '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre R32', '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre R16', '❌', '❌', '❌', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre QF', '❌', '❌', '❌', '❌', '✅', '✅', '✅'] },
          { cells: ['QF+', '❌', '❌', '❌', '❌', '❌', '❌', '❌'] },
        ],
      },
      {
        type: 'note',
        color: 'red',
        text: '* Groups and 3rd Place lock after Matchday 2. From the Quarter-Finals onward, no predictions can be edited.',
      },
      {
        type: 'note',
        color: 'red',
        text: '⚽ While any knockout round is live, ALL predictions are locked — including rounds not yet started.',
      },
    ],
  },
  {
    id: 'bracket',
    title: 'The Bracket',
    emoji: '🗂️',
    content: [
      {
        type: 'paragraph',
        text: 'The Bracket screen shows the full tournament picture. Edit predictions directly from here before saving — every early-stage change propagates automatically to later rounds.',
      },
      {
        type: 'paragraph',
        text: 'Each match slot is colour-coded to help you spot issues:',
      },
      {
        type: 'bullet',
        items: [
          '🔴 Red — no winner selected, or your selected winner has been eliminated. No points possible.',
          '🟠 Orange — your selected winner is playing in a different match in the same round. Partial points only.',
        ],
      },
    ],
  },
  {
    id: 'leagues',
    title: 'Leagues & Leaderboard',
    emoji: '🏅',
    content: [
      {
        type: 'paragraph',
        text: 'Two league modes are available:',
      },
      {
        type: 'bullet',
        items: [
          'Matches Only League — ranks players on match predictions exclusively.',
          'Full League — ranks players across all prediction types.',
        ],
      },
      {
        type: 'league-sort-card',
        items: [
          '🏆 Total points',
          '🥅 Match predictions',
          '🗂️ Groups + 3rd place',
          '💥 Knockout',
          '🎰 Bonus',
          '⚠️ Fines',
        ],
      },
      {
        type: 'tiebreaker',
        items: [
          'More points from match predictions',
          'Fewer fines',
          'Earlier registration date',
        ],
      },
    ],
  },
];

// ─── Table Component ──────────────────────────────────────────────────────────

function RulesTable({
  headers,
  rows,
  compact,
}: {
  headers: string[];
  rows: TableRow[];
  compact?: boolean;
}) {
  const isWide = headers.length > 3;

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
            ]}
          >
            <Text style={styles.tableHeaderText}>{h}</Text>
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

// ─── Block Renderer ───────────────────────────────────────────────────────────

function RenderBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <Text key={i} style={styles.paragraph}>
                {block.text}
              </Text>
            );

          case 'note': {
            const borderColor =
              block.color === 'red'
                ? '#ef4444'
                : block.color === 'yellow'
                ? '#f59e0b'
                : '#16a34a';
            return (
              <View key={i} style={[styles.noteBox, { borderLeftColor: borderColor }]}>
                <Text style={styles.noteText}>{block.text}</Text>
              </View>
            );
          }

          case 'bullet':
            return (
              <View key={i} style={styles.bulletList}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            );

          case 'table':
            return (
              <RulesTable
                key={i}
                headers={block.headers}
                rows={block.rows}
                compact={block.compact}
              />
            );

          case 'subsection':
            return (
              <View key={i} style={styles.subsection}>
                <Text style={styles.subsectionTitle}>{block.title}</Text>
                <RenderBlocks blocks={block.blocks} />
              </View>
            );

          case 'league-sort-card':
            return (
              <View key={i} style={styles.sortCard}>
                <Text style={styles.sortCardTitle}>Sort leaderboard by:</Text>
                <View style={styles.sortGrid}>
                  {block.items.map((item, j) => (
                    <View key={j} style={styles.sortBadge}>
                      <Text style={styles.sortBadgeText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );

          case 'tiebreaker':
            return (
              <View key={i} style={styles.tiebreakerCard}>
                <Text style={styles.tiebreakerTitle}>🤝 Tiebreaker</Text>
                <Text style={styles.tiebreakerSub}>Equal total points? Rank is decided by:</Text>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.tiebreakerRow}>
                    <View style={styles.tiebreakerBadge}>
                      <Text style={styles.tiebreakerBadgeText}>{j + 1}</Text>
                    </View>
                    <Text style={styles.tiebreakerText}>{item}</Text>
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
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  activeId: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <Text style={styles.menuTitle}>Jump to section</Text>
          {sections.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.menuItem, activeId === s.id && styles.menuItemActive]}
              onPress={() => {
                onSelect(s.id);
                onClose();
              }}
            >
              <Text style={styles.menuItemEmoji}>{s.emoji}</Text>
              <Text style={[styles.menuItemText, activeId === s.id && styles.menuItemTextActive]}>
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
          <Ionicons name="chevron-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>How to Play</Text>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnFilled]}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={20} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      {/* Section indicator bar */}
      <TouchableOpacity style={styles.sectionBar} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
        <Text style={styles.sectionBarEmoji}>{activeEmoji}</Text>
        <Text style={styles.sectionBarTitle} numberOfLines={1}>{activeTitle}</Text>
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
      />

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
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
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionDivider} />
            <RenderBlocks blocks={section.content} />
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
    justifyContent: 'space-between',
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
  menuItemText: { flex: 1, fontSize: 15, color: '#64748b', fontWeight: '500' },
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
  },
  sectionEmoji: { fontSize: 22 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  sectionDivider: {
    height: 2,
    backgroundColor: '#16a34a',
    width: 36,
    borderRadius: 2,
  },

  // Subsection
  subsection: { gap: 8, marginTop: 4 },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
  },

  // Paragraph
  paragraph: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },

  // Note
  noteBox: {
    backgroundColor: '#111e35',
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
  },
  noteText: { fontSize: 13, color: '#cbd5e1', lineHeight: 20 },

  // Bullet
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: 14, color: '#94a3b8', lineHeight: 22 },

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
    minWidth: 80,
  },
  tableCellWide: { minWidth: 150, alignItems: 'flex-start' },
  tableCellCompact: { minWidth: 120, alignItems: 'flex-start' },
  tableCellNarrow: { minWidth: 50, paddingHorizontal: 6 },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tableCellText: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  tableCellTextFirst: { color: '#e2e8f0', fontWeight: '600', textAlign: 'left' },
  tableCellTextHighlight: { color: '#86efac', fontWeight: '700' },

  // League sort card
  sortCard: {
    backgroundColor: '#111e35',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1a2a45',
  },
  sortCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortBadge: {
    backgroundColor: '#0a1628',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  sortBadgeText: { fontSize: 13, color: '#e2e8f0', fontWeight: '500' },

  // Tiebreaker card
  tiebreakerCard: {
    backgroundColor: '#0f1e38',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1a3060',
  },
  tiebreakerTitle: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  tiebreakerSub: { fontSize: 13, color: '#475569', marginBottom: 4 },
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
  tiebreakerText: { fontSize: 14, color: '#cbd5e1', fontWeight: '500', flex: 1 },
});
