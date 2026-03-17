import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import BracketIcon from '../../components/icons/BracketIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../../navigation/MainNavigator';

type NavigationProp = StackNavigationProp<MainStackParamList, 'PredictionsMenu'>;

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  const renderRow = (
    key: string,
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    onPress: () => void,
    iconBg: string,
  ) => (
    <TouchableOpacity key={key} style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Classic rows — no header, they're universal */}
            {renderRow(
              'match-predictions',
              'Match Predictions',
              'Predict scores for every match',
              <Ionicons name="football-outline" size={26} color="#38bdf8" />,
              () => navigation.navigate('MatchPredictions'),
              'rgba(56,189,248,0.12)',
            )}
            <View style={styles.divider} />
            {renderRow(
              'bonus-predictions',
              'Bonus Predictions',
              'Special tournament questions',
              <Ionicons name="gift-outline" size={26} color="#38bdf8" />,
              () => navigation.navigate('BonusPredictions'),
              'rgba(56,189,248,0.12)',
            )}

            {/* Multi-only separator — subtle, inline, not a hard break */}
            <View style={styles.multiSeparator}>
              <View style={styles.separatorLine} />
              <View style={styles.separatorBadge}>
                <Ionicons name="trophy-outline" size={11} color="#f59e0b" />
                <Text style={styles.separatorText}>Multi Mode only</Text>
              </View>
              <View style={styles.separatorLine} />
            </View>

            {/* Multi-only rows — same card, slightly tinted background */}
            <View style={styles.multiBlock}>
              {renderRow(
                'route-predictions',
                'Route Predictions',
                'Groups, 3rd place & knockout bracket',
                <Ionicons name="git-branch-outline" size={26} color="#f59e0b" />,
                () => navigation.navigate('RoutePredictions'),
                'rgba(245,158,11,0.12)',
              )}
              <View style={styles.divider} />
              {renderRow(
                'full-bracket',
                'Full Bracket',
                'View your complete tournament bracket',
                <BracketIcon size={22} color="#f59e0b" />,
                () => navigation.navigate('Bracket'),
                'rgba(245,158,11,0.12)',
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },

  card: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  rowSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: '#2d4a6e',
    marginLeft: 74,
  },

  // Subtle separator between classic and multi rows
  multiSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245,158,11,0.25)',
  },
  separatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  separatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Slight amber tint behind multi-only rows to hint they're different
  multiBlock: {
    backgroundColor: 'rgba(245,158,11,0.04)',
  },
});
