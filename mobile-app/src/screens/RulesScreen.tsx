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
  | { type: 'note'; text: string; color?: 'green' | 'yellow' | 'red' }
  | { type: 'table'; headers: string[]; rows: TableRow[]; compact?: boolean; isWide?: boolean }
  | { type: 'subsection'; title: string; blocks: ContentBlock[]; variant?: 'prediction' }
  | { type: 'tiebreaker'; items: string[] }
  | { type: 'temptation-card' }
  | { type: 'mode-cards'; cards: ModeCardData[] };

// ─── Content ─────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: 'intro',
    title: 'What is Predicto?',
    emoji: '🎯',
    content: [
      {
        type: 'paragraph',
        text: 'Predicto is a prediction game for the 2026 FIFA World Cup. Predict match scores and bonus questions — or go all in with group standings, the full knockout bracket, and more. Then outscore your friends.',
      },
      {
        type: 'paragraph',
        text: 'Two league modes: Classic Mode (matches + bonus) and Multi Mode (everything).',
      },
    ],
  },
  {
    id: 'classic',
    title: 'Classic Mode',
    emoji: '⚽',
    content: [
      {
        type: 'subsection',
        title: 'Match Predictions',
        variant: 'prediction',
        blocks: [
          {
            type: 'paragraph',
            text: 'Predict the exact scoreline for every match. Only the result after 90 minutes counts — no extra time or penalties. Predictions lock at kick-off.',
          },
          {
            type: 'table',
            headers: ['Stage', 'Direction', 'Exact Score'],
            rows: [
              { cells: ['Group / R32', '2', '5'] },
              { cells: ['Round of 16', '3', '7'] },
              { cells: ['Quarter-Final', '4', '9'] },
              { cells: ['Semi-Final', '5', '10'] },
              { cells: ['3rd Place', '6', '12'] },
              { cells: ['Final', '7', '15'] },
            ],
          },
          { type: 'temptation-card' },
        ],
      },
      {
        type: 'subsection',
        title: 'Bonus Predictions',
        variant: 'prediction',
        blocks: [
          {
            type: 'paragraph',
            text: '10 questions covering the group stage, knockout stage, and the full tournament. One answer per question.',
          },
          {
            type: 'bullet',
            items: [
              'Group-stage questions: editable until end of Matchday 2.',
              'Knockout & tournament questions: editable until Round of 16 begins.',
            ],
          },
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
    id: 'multi',
    title: 'Multi Mode',
    emoji: '🏆',
    content: [
      {
        type: 'paragraph',
        text: 'Multi Mode builds on Classic Mode with full route predictions — who advances from every group all the way to the Final. Three additional prediction types:',
      },
      {
        type: 'subsection',
        title: 'Group Stage',
        variant: 'prediction',
        blocks: [
          {
            type: 'paragraph',
            text: 'Predict the exact finishing order (1st–4th) for all 4 teams in each of the 12 groups. Editable until end of Matchday 2.',
          },
          {
            type: 'table',
            headers: ['Position', 'Points'],
            compact: true,
            rows: [
              { cells: ['1st', '6'] },
              { cells: ['2nd', '5'] },
              { cells: ['3rd', '4'] },
              { cells: ['4th', '2'] },
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: '3rd Place',
        variant: 'prediction',
        blocks: [
          {
            type: 'paragraph',
            text: 'Choose 8 of the 12 groups whose 3rd-place team advances. Editable until end of Matchday 2.',
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
          {
            type: 'note',
            color: 'yellow',
            text: 'You pick 8 of 12 — at least 4 are always correct. Points kick in from 5 correct.',
          },
        ],
      },
      {
        type: 'subsection',
        title: 'Knockout',
        variant: 'prediction',
        blocks: [
          {
            type: 'paragraph',
            text: 'Predict the winner of every match from R32 to the Final. Editable round by round, no later than Quarter-Finals start.',
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
          {
            type: 'note',
            color: 'green',
            text: 'Full = correct winner via the exact path. Partial = your pick advanced through a different match in the same round.',
          },
          {
            type: 'note',
            color: 'yellow',
            text: 'The Bracket screen shows the full tournament picture. Use Edit Mode to freely explore changes before saving.',
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
        text: 'A fine is deducted each time you save a change. Cost depends on the current tournament stage.',
      },
      {
        type: 'subsection',
        title: 'What counts as a change?',
        blocks: [
          {
            type: 'bullet',
            items: [
              "Group Stage — each team moved in a group's finishing order: 1 change.",
              '3rd Place — each group toggled: 1 change.',
              'Knockout — changing a predicted winner in any round: 1 change (may cascade to later rounds).',
              'Bonus — changing a question answer: 1 change.',
            ],
          },
          {
            type: 'table',
            headers: ['Tournament Stage', 'Fine / Change'],
            rows: [
              { cells: ['Before tournament', '0 (free)'], highlight: true },
              { cells: ['Matchday 1', '−1 pt'] },
              { cells: ['Matchday 2', '−2 pts'] },
              { cells: ['Matchday 3', '−3 pts'] },
              { cells: ['Before Round of 32', '−4 pts'] },
              { cells: ['Before Round of 16', '−5 pts'] },
              { cells: ['Before Quarter-Final', '−6 pts'] },
            ],
          },
        ],
      },
      {
        type: 'subsection',
        title: '🔄 Bracket Reset (One-Time)',
        blocks: [
          {
            type: 'paragraph',
            text: 'Before the Round of 32, you can fully reset your knockout bracket once — clearing all predictions to start fresh with the real teams.',
          },
          {
            type: 'paragraph',
            text: 'Two prediction statuses matter for the reset cost:',
          },
          {
            type: 'bullet',
            items: [
              '🔴 Invalid — no winner selected, or the selected team has already been eliminated. No points are possible from this slot.',
              '🟠 Unreachable — your selected winner cannot reach this match. At best, only Partial points are possible.',
            ],
          },
          {
            type: 'table',
            headers: ['Status', 'Reset Cost'],
            compact: true,
            rows: [
              { cells: ['Invalid 🔴', '−2 pts each'] },
              { cells: ['Unreachable 🟠', '−1 pt each'] },
            ],
          },
          {
            type: 'note',
            color: 'red',
            text: 'One-time only. Not available after Round of 32 kicks off.',
          },
        ],
      },
    ],
  },
  {
    id: 'availability',
    title: 'Prediction Windows',
    emoji: '📅',
    content: [
      {
        type: 'paragraph',
        text: 'Each prediction type has an editing window. Once a stage begins or the deadline passes, it locks.',
      },
      {
        type: 'table',
        headers: ['Stage', 'Groups', '3rd', 'R32', 'R16', 'QF', 'SF', 'Final'],
        isWide: true,
        rows: [
          { cells: ['Pre-tournament', '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Matchday 1–2', '✅', '✅', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Matchday 3', '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre R32', '❌', '❌', '✅', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre R16', '❌', '❌', '❌', '✅', '✅', '✅', '✅'] },
          { cells: ['Pre QF', '❌', '❌', '❌', '❌', '✅', '✅', '✅'] },
          { cells: ['QF+', '❌', '❌', '❌', '❌', '❌', '❌', '❌'] },
        ],
      },
      {
        type: 'note',
        color: 'red',
        text: 'While any knockout round is live, ALL bracket predictions are locked — including rounds not yet started.',
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
        text: 'Compete in leagues with friends. Two league types available:',
      },
      {
        type: 'mode-cards',
        cards: [
          {
            mode: 'Classic Mode',
            emoji: '⚽',
            color: '#38bdf8',
            description: 'Match predictions + Bonus questions',
            includes: ['Matches', 'Bonus'],
          },
          {
            mode: 'Multi Mode',
            emoji: '🏆',
            color: '#f59e0b',
            description: 'The full prediction experience',
            includes: ['Matches', 'Bonus', 'Groups', '3rd Place', 'Knockout', 'Fines'],
          },
        ],
      },
      {
        type: 'tiebreaker',
        items: [
          'More points from match predictions',
          'Fewer fines (if relevant)',
          'Earlier registration date',
        ],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderParagraphWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={styles.paragraph}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={[styles.paragraph, styles.paragraphBold]}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
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
            return <View key={i}>{renderParagraphWithBold(block.text)}</View>;

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
                isWide={block.isWide}
              />
            );

          case 'subsection':
            return (
              <View key={i} style={[styles.subsection, block.variant === 'prediction' && styles.subsectionPredictionSpacing]}>
                {block.variant === 'prediction' ? (
                  <Text style={styles.subsectionLabelA}>{block.title}</Text>
                ) : (
                  <Text style={styles.subsectionTitle}>{block.title}</Text>
                )}
                <RenderBlocks blocks={block.blocks} />
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

          case 'temptation-card':
            return (
              <View key={i} style={styles.temptationCard}>
                <Text style={styles.temptationTitle}>🎰 Temptation — High Risk / High Reward</Text>
                <View style={styles.temptationDivider} />
                <Text style={styles.temptationBody}>
                  Tap Temptation on any match to unlock 3 rare scoreline options almost nobody else
                  has predicted. Guess correctly and your points are doubled. Options update live
                  based on all players' picks.
                </Text>
              </View>
            );

          case 'mode-cards':
            return (
              <View key={i} style={styles.modeCardsRow}>
                {block.cards.map((card, j) => (
                  <View
                    key={j}
                    style={[
                      styles.modeCard,
                      { borderColor: card.color + '55' },
                    ]}
                  >
                    <View style={styles.modeCardHeader}>
                      <Text style={styles.modeCardEmoji}>{card.emoji}</Text>
                      <Text style={[styles.modeCardName, { color: card.color }]}>{card.mode}</Text>
                    </View>
                    <Text style={styles.modeCardDesc}>{card.description}</Text>
                    <View style={styles.modeCardDivider} />
                    <View style={styles.modeCardPills}>
                      {card.includes.map((item, k) => (
                        <View key={k} style={styles.modeCardPill}>
                          <Text style={styles.modeCardPillText}>{item}</Text>
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
  subsectionPredictionSpacing: { marginTop: 30 },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
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
  },

  // Paragraph
  paragraph: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
  paragraphBold: { fontWeight: '700', color: '#e2e8f0' },

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
  tiebreakerSub: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
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

  // Temptation card
  temptationCard: {
    backgroundColor: '#1c1200',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    gap: 0,
  },
  temptationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
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
  },
  modeCardDesc: {
    fontSize: 12,
    color: '#64748b',
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
  },
});
