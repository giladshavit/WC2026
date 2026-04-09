import React from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ONBOARDING_MATCHES } from '../../constants/onboardingTeams';

type DemoMatch = (typeof ONBOARDING_MATCHES)[0] & {
  homeScore: string;
  awayScore: string;
  showArrow?: boolean;
};

function DemoMatchCard({
  group,
  date,
  time,
  home,
  away,
  homeScore,
  awayScore,
  showArrow,
}: DemoMatch) {
  const bounce = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!showArrow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, showArrow]);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <View style={cardStyles.topColLeft}>
          <Text style={cardStyles.groupText}>{group}</Text>
        </View>
        <View style={cardStyles.topColCenter}>
          <Text style={cardStyles.dateTimeText}>
            {date} · {time}
          </Text>
        </View>
        <View style={cardStyles.topCol} />
      </View>

      <View style={cardStyles.middleRow}>
        <View style={cardStyles.sideTeam}>
          <Image source={{ uri: home.flag_url }} style={cardStyles.flag} />
          <Text style={cardStyles.teamName} numberOfLines={2}>
            {home.name}
          </Text>
        </View>

        <View style={cardStyles.scoreRow}>
          <View style={cardStyles.scoreBox}>
            <Text style={cardStyles.scoreText}>{homeScore}</Text>
          </View>
          <Text style={cardStyles.scoreColon}>:</Text>
          <View style={cardStyles.awayScoreColumn}>
            <View style={cardStyles.scoreBox}>
              <Text style={cardStyles.scoreText}>{awayScore}</Text>
            </View>
            {showArrow ? (
              <View style={cardStyles.arrowHintBlock}>
                <Animated.Text
                  style={[cardStyles.arrowHintArrow, { transform: [{ translateY: bounce }] }]}
                >
                  ↑
                </Animated.Text>
                <Text style={cardStyles.arrowHintLabel}>Enter score</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={cardStyles.sideTeam}>
          <Image source={{ uri: away.flag_url }} style={cardStyles.flag} />
          <Text style={cardStyles.teamName} numberOfLines={2}>
            {away.name}
          </Text>
        </View>
      </View>

      <View style={cardStyles.bottomRow}>
        <View style={cardStyles.statsPill}>
          <Ionicons name="stats-chart" size={13} color="#93c5fd" />
        </View>
        <View style={cardStyles.x2Pill}>
          <View style={cardStyles.x2PillInner}>
            <Ionicons name="flash" size={11} color="#d8b4fe" />
            <Text style={cardStyles.x2PillText}>x2</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
    minHeight: 130,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  topCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topColLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topColCenter: {
    flex: 1,
    alignItems: 'center',
  },
  groupText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dateTimeText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sideTeam: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
    paddingTop: 4,
  },
  flag: {
    width: 52,
    height: 36,
    borderRadius: 4,
  },
  teamName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  awayScoreColumn: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
  },
  arrowHintBlock: {
    position: 'absolute',
    top: 40,
    left: '50%',
    width: 100,
    marginLeft: -50,
    alignItems: 'center',
  },
  arrowHintArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4ade80',
  },
  arrowHintLabel: {
    fontSize: 11,
    color: '#4ade80',
    textAlign: 'center',
  },
  // Matches MatchCard scoreBox + scoreBoxEditable
  scoreBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f2744',
    borderWidth: 2,
    borderColor: '#16a34a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 0,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    includeFontPadding: false,
  },
  scoreColon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#cbd5e1',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  x2PillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsPill: {
    backgroundColor: 'rgba(59,130,246,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  x2Pill: {
    backgroundColor: 'rgba(168,85,247,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  x2PillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d8b4fe',
  },
});

const DEMO_SCORES = [
  { home: '3', away: '2' },
  { home: '1', away: '' },
  { home: '', away: '' },
];

export default function MatchesPage() {
  const demo = ONBOARDING_MATCHES.slice(0, 3);

  return (
    <View style={styles.classicPage}>
      <View style={styles.classicBadge}>
        <Text style={styles.classicBadgeText} allowFontScaling={false}>CLASSIC MODE</Text>
      </View>
      <Text style={styles.classicSubtitle} maxFontSizeMultiplier={1.3}>
        Predict the exact score of every match
      </Text>

      <View style={styles.cardsBlock}>
        {demo.map((m, i) => (
          <DemoMatchCard
            key={m.id}
            {...m}
            homeScore={DEMO_SCORES[i]?.home ?? ''}
            awayScore={DEMO_SCORES[i]?.away ?? ''}
            showArrow={i === 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  classicPage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    justifyContent: 'flex-start',
  },
  classicBadge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    marginBottom: 6,
  },
  classicBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  classicSubtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  cardsBlock: {
    flexGrow: 0,
  },
});
