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

type GridCardProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  onPress: () => void;
  multi?: boolean;
};

function GridCard({ title, subtitle, icon, iconBg, onPress, multi }: GridCardProps) {
  return (
    <TouchableOpacity
      style={[styles.gridCard, multi && styles.gridCardMulti]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.gridCardInner}>
        <View style={[styles.iconGrid, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.gridTitle}>{title}</Text>
        <Text style={styles.gridSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridRow}>
            <GridCard
              title="Match"
              subtitle="Predict every score"
              icon={<Ionicons name="football-outline" size={26} color="#38bdf8" />}
              onPress={() => navigation.navigate('MatchPredictions')}
              iconBg="rgba(56,189,248,0.12)"
            />
            <GridCard
              title="Bonus"
              subtitle="Special questions"
              icon={<Ionicons name="gift-outline" size={26} color="#38bdf8" />}
              onPress={() => navigation.navigate('BonusPredictions')}
              iconBg="rgba(56,189,248,0.12)"
            />
          </View>

          <View style={styles.multiSeparator}>
            <View style={styles.separatorLine} />
            <View style={styles.separatorBadge}>
              <Ionicons name="trophy-outline" size={11} color="#f59e0b" />
              <Text style={styles.separatorText}>Multi Mode only</Text>
            </View>
            <View style={styles.separatorLine} />
          </View>

          <View style={styles.gridRow}>
            <GridCard
              title="Route"
              subtitle="Groups & bracket"
              icon={<Ionicons name="git-branch-outline" size={26} color="#f59e0b" />}
              onPress={() => navigation.navigate('RoutePredictions')}
              iconBg="rgba(245,158,11,0.12)"
              multi
            />
            <GridCard
              title="Full Bracket"
              subtitle="Full tournament"
              icon={<BracketIcon size={22} color="#f59e0b" />}
              onPress={() => navigation.navigate('Bracket')}
              iconBg="rgba(245,158,11,0.12)"
              multi
            />
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

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },

  gridCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    minHeight: 140,
    backgroundColor: '#1e3a5f',
  },

  gridCardMulti: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },

  gridCardInner: {
    flex: 1,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconGrid: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  gridTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
    textAlign: 'center',
  },

  gridSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Subtle separator between classic and multi rows
  multiSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
});
