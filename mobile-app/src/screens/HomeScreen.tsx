import * as React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Rect } from 'react-native-svg';
import PredictOLogo from '../components/shared/PredictOLogo';
import { MainStackParamList } from '../navigation/MainNavigator';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const STAGE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  PRE_GROUP_STAGE: { label: 'Pre-Tournament', emoji: '⏳', color: '#38bdf8' },
  GROUP_CYCLE_1: { label: 'Matchday 1', emoji: '⚽', color: '#16a34a' },
  GROUP_CYCLE_2: { label: 'Matchday 2', emoji: '⚽', color: '#16a34a' },
  GROUP_CYCLE_3: { label: 'Matchday 3', emoji: '⚽', color: '#16a34a' },
  PRE_ROUND32: { label: 'Pre Round of 32', emoji: '🔜', color: '#f59e0b' },
  ROUND32: { label: 'Round of 32', emoji: '🔥', color: '#ef4444' },
  PRE_ROUND16: { label: 'Pre Round of 16', emoji: '🔜', color: '#f59e0b' },
  ROUND16: { label: 'Round of 16', emoji: '🔥', color: '#ef4444' },
  PRE_QUARTER: { label: 'Pre Quarter-Final', emoji: '🔜', color: '#f59e0b' },
  QUARTER: { label: 'Quarter-Final', emoji: '🔥', color: '#ef4444' },
  PRE_SEMI: { label: 'Pre Semi-Final', emoji: '🔜', color: '#f59e0b' },
  SEMI: { label: 'Semi-Final', emoji: '🔥', color: '#ef4444' },
  THIRD_PLACE: { label: 'Third Place', emoji: '🥉', color: '#94a3b8' },
  FINAL: { label: 'The Final', emoji: '🏆', color: '#fbbf24' },
};

type NavigationProp = StackNavigationProp<MainStackParamList, 'Home'>;

const screenWidth = Dimensions.get('window').width;
const buttonSize = (screenWidth - 24 * 2 - 16) / 2;

function StatsBarChartIcon({ size = 36 }: { size?: number }) {
  const bars = [
    { fill: '#f87171', h: 22 },
    { fill: '#60a5fa', h: 14 },
    { fill: '#4ade80', h: 26 },
    { fill: '#facc15', h: 18 },
  ];
  const w = 5;
  const gap = 2;
  const pad = 5;
  const baseY = 28;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      {bars.map((b, i) => (
        <Rect
          key={i}
          x={pad + i * (w + gap)}
          y={baseY - b.h}
          width={w}
          height={b.h}
          rx={2}
          fill={b.fill}
        />
      ))}
    </Svg>
  );
}

const actions: Array<{
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: Exclude<keyof MainStackParamList, 'UserProfile'>;
  accent: string | null;
  accentBorder: string | null;
  iconColor?: string;
}> = [
  {
    title: 'My Predictions',
    subtitle: 'Matches & bracket picks',
    icon: 'help-circle-outline',
    navigateTo: 'PredictionsMenu',
    accent: '#162444',
    accentBorder: '#16a34a',
    iconColor: '#4ade80',
  },
  {
    title: 'Leagues',
    subtitle: 'Compete with friends',
    icon: 'trophy-outline',
    navigateTo: 'Leagues',
    accent: '#162444',
    accentBorder: '#1e3a8a',
    iconColor: '#fbbf24',
  },
  {
    title: 'Statistics',
    subtitle: 'Standings & insights',
    icon: 'stats-chart',
    navigateTo: 'Statistics',
    accent: null,
    accentBorder: null,
  },
  {
    title: 'Profile',
    subtitle: 'Account & preferences',
    icon: 'person-circle-outline',
    navigateTo: 'Profile',
    accent: null,
    accentBorder: null,
    iconColor: '#94a3b8',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStage, setCurrentStage] = React.useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      apiService.getAppConfig().then((config) => {
        if (config?.current_stage) setCurrentStage(config.current_stage);
      }).catch(() => {});
    }, [])
  );

  const isAdmin =
    (user?.user_id != null && user.user_id >= 1 && user.user_id <= 10) ||
    user?.is_admin === true;

  const renderButton = (action: (typeof actions)[0]) => {
    const glowStyle =
      action.navigateTo === 'PredictionsMenu'
        ? {
            backgroundColor: '#162444' as const,
            borderWidth: 3,
            borderColor: '#4ade80' as const,
            shadowColor: '#16a34a' as const,
            shadowOpacity: 0.7,
            shadowRadius: 24,
            shadowOffset: { width: 0 as const, height: 0 as const },
            elevation: 16,
          }
        : action.navigateTo === 'Leagues'
          ? {
              backgroundColor: '#162444' as const,
              borderWidth: 3,
              borderColor: '#fbbf24' as const,
              shadowColor: '#f59e0b' as const,
              shadowOpacity: 0.65,
              shadowRadius: 24,
              shadowOffset: { width: 0 as const, height: 0 as const },
              elevation: 16,
            }
          : null;
    return (
      <TouchableOpacity
        key={action.title}
        style={[
          styles.circleButton,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          glowStyle ?? styles.secondaryButton,
          action.navigateTo === 'Statistics' && styles.statsButton,
          action.navigateTo === 'Profile' && styles.profileButton,
        ]}
        onPress={() => navigation.navigate(action.navigateTo)}
        activeOpacity={0.8}
      >
        {action.navigateTo === 'Statistics' ? (
          <View style={styles.icon}>
            <StatsBarChartIcon size={38} />
          </View>
        ) : (
          <Ionicons
            name={action.icon}
            size={action.navigateTo === 'Leagues' ? 40 : 36}
            color={action.iconColor ?? (action.accent ? '#ffffff' : '#94a3b8')}
            style={styles.icon}
          />
        )}
        <Text style={[styles.buttonTitle, action.accent && styles.accentButtonTitle]}>
          {action.title}
        </Text>
        <Text style={[styles.buttonSubtitle, action.accent && styles.accentButtonSubtitle]}>
          {action.subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoContainer}>
          <PredictOLogo size="small" variant="light" />
        </View>
        <View style={styles.logoSeparator} />
        <Text style={styles.greeting}>
          Welcome back, {user?.username ?? 'Champ'}!
        </Text>
        {currentStage && STAGE_LABELS[currentStage] && (
          <View style={styles.stageRow}>
            <Text style={styles.stageLabel}>Stage:</Text>
            <Text style={[styles.stageValue, { color: STAGE_LABELS[currentStage].color }]}>
              {STAGE_LABELS[currentStage].label}
            </Text>
          </View>
        )}

        <View style={styles.waveSvgContainer}>
          <Svg height="32" width="100%" viewBox="0 0 390 32" preserveAspectRatio="none">
            <Path d="M0,0 C97.5,32 292.5,32 390,0 L390,0 L0,0 Z" fill="#0f172a" />
          </Svg>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.buttonsGrid}>
          {actions.map((action) => renderButton(action))}
        </View>

        {/* How to Play — styled as a secondary action row, consistent with the dark card feel */}
        <TouchableOpacity
          style={styles.rulesRow}
          onPress={() => navigation.navigate('Rules' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.rulesIconWrap}>
            <Ionicons name="book-outline" size={20} color="#94a3b8" />
          </View>
          <View style={styles.rulesTextWrap}>
            <Text style={styles.rulesTitle}>How to Play</Text>
            <Text style={styles.rulesSubtitle}>Rules, scoring & penalties</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={styles.adminPill}
            onPress={() => navigation.navigate('Admin' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={14} color="#9ca3af" />
            <Text style={styles.adminPillText}>Admin</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1e293b' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    overflow: 'visible',
  },
  logoContainer: { alignItems: 'flex-start', marginBottom: 8 },
  logoSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 10,
    width: '40%',
  },
  greeting: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  stageLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  stageValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  waveSvgContainer: {
    position: 'absolute',
    bottom: -31,
    left: 0,
    right: 0,
    height: 32,
  },
  buttonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 8,
  },
  circleButton: {
    padding: 16,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#334155',
    borderWidth: 1,
    shadowOpacity: 0,
  },
  statsButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  profileButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#475569',
    shadowColor: 'transparent',
    elevation: 0,
  },

  // How to Play row
  rulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  rulesIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rulesTextWrap: { flex: 1 },
  rulesTitle: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  rulesSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Admin
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  adminPillText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  icon: { marginBottom: 8 },
  buttonTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  accentButtonTitle: { color: '#ffffff' },
  buttonSubtitle: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  accentButtonSubtitle: { color: 'rgba(255,255,255,0.8)' },
});
