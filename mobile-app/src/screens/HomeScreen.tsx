import * as React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  PixelRatio,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Rect } from 'react-native-svg';
import PredictOLogo from '../components/shared/PredictOLogo';
import { MainStackParamList } from '../navigation/MainNavigator';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useTranslation } from 'react-i18next';
import { IS_RTL } from '../utils/rtl';

const STAGE_STYLES: Record<string, { color: string }> = {
  PRE_GROUP_STAGE: { color: '#38bdf8' },
  GROUP_CYCLE_1: { color: '#16a34a' },
  GROUP_CYCLE_2: { color: '#16a34a' },
  GROUP_CYCLE_3: { color: '#16a34a' },
  PRE_ROUND32: { color: '#f59e0b' },
  ROUND32: { color: '#ef4444' },
  PRE_ROUND16: { color: '#f59e0b' },
  ROUND16: { color: '#ef4444' },
  PRE_QUARTER: { color: '#f59e0b' },
  QUARTER: { color: '#ef4444' },
  PRE_SEMI: { color: '#f59e0b' },
  SEMI: { color: '#ef4444' },
  THIRD_PLACE: { color: '#94a3b8' },
  FINAL: { color: '#fbbf24' },
  TOURNAMENT_OVER: { color: '#94a3b8' },
};

type NavigationProp = StackNavigationProp<MainStackParamList, 'Home'>;

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const MAX_BUTTON_SIZE = screenHeight < 700 ? 150 : 200;
const buttonSize = Math.min((screenWidth - 24 * 2 - 16) / 2, MAX_BUTTON_SIZE);

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
  titleKey: 'myPredictions' | 'leagues' | 'statistics' | 'profile';
  subtitleKey: 'allYourPicks' | 'competeWithFriends' | 'standingsInsights' | 'accountDetails';
  icon: string;
  navigateTo: Exclude<keyof MainStackParamList, 'PublicProfile'>;
  accent: string | null;
  accentBorder: string | null;
  iconColor?: string;
}> = [
  {
    titleKey: 'myPredictions',
    subtitleKey: 'allYourPicks',
    icon: 'football-outline',
    navigateTo: 'PredictionsMenu',
    accent: '#162444',
    accentBorder: '#16a34a',
    iconColor: '#4ade80',
  },
  {
    titleKey: 'leagues',
    subtitleKey: 'competeWithFriends',
    icon: 'trophy-outline',
    navigateTo: 'Leagues',
    accent: '#162444',
    accentBorder: '#1e3a8a',
    iconColor: '#fbbf24',
  },
  {
    titleKey: 'statistics',
    subtitleKey: 'standingsInsights',
    icon: 'stats-chart',
    navigateTo: 'Statistics',
    accent: null,
    accentBorder: null,
  },
  {
    titleKey: 'profile',
    subtitleKey: 'accountDetails',
    icon: 'person-circle-outline',
    navigateTo: 'Profile',
    accent: null,
    accentBorder: null,
    iconColor: '#cbd5e1',
  },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  /** Single source: utils/rtl (I18nManager + locale fallback). */
  const layoutRTL = IS_RTL;
  const textAlign: 'left' | 'right' = layoutRTL ? 'right' : 'left';
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStage, setCurrentStage] = React.useState<string | null>(null);
  const [isAdminFromConfig, setIsAdminFromConfig] = React.useState(false);
  const [isFirstSession, setIsFirstSession] = React.useState(false);
  const fontScale = PixelRatio.getFontScale();
  const scrollEnabled = fontScale > 1.2;
  const didCheckRef = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        // Onboarding check: only run once per component mount
        if (!didCheckRef.current) {
          didCheckRef.current = true;

          const completed = await AsyncStorage.getItem('onboarding_completed');

          if (!completed) {
            if (!cancelled) {
              setIsFirstSession(true);
              await AsyncStorage.setItem('is_first_session', 'true');
              navigation.replace('Onboarding', { mode: 'first-session' });
            }
            return;
          }

          // Check if we're returning to Home still within the first session flow
          const firstSession = await AsyncStorage.getItem('is_first_session');
          if (firstSession === 'true' && !cancelled) {
            setIsFirstSession(true);
            await AsyncStorage.removeItem('is_first_session');
          }
        }

        apiService.getAppConfig().then((config) => {
          if (cancelled) return;
          if (config?.current_stage) setCurrentStage(config.current_stage);
          setIsAdminFromConfig(config?.is_admin === true);
        }).catch(() => {});
      })();
      return () => {
        cancelled = true;
      };
    }, [navigation])
  );

  const isAdmin =
    currentStage !== null &&
    ((user?.is_admin === true) || isAdminFromConfig);

  const renderButton = (action: (typeof actions)[0]) => {
    const title = t(`home.${action.titleKey}`);
    const subtitle = t(`home.${action.subtitleKey}`);
    const glowStyle =
      action.navigateTo === 'PredictionsMenu'
        ? {
            backgroundColor: '#162444' as const,
            borderWidth: 3,
            borderColor: '#4ade80' as const,
            shadowColor: '#16a34a' as const,
            shadowOpacity: 0.38,
            shadowRadius: 18,
            shadowOffset: { width: 0 as const, height: 0 as const },
            elevation: 16,
          }
        : action.navigateTo === 'Leagues'
          ? {
              backgroundColor: '#162444' as const,
              borderWidth: 3,
              borderColor: '#fbbf24' as const,
              shadowColor: '#f59e0b' as const,
              shadowOpacity: 0.4,
              shadowRadius: 18,
              shadowOffset: { width: 0 as const, height: 0 as const },
              elevation: 16,
            }
          : null;
    return (
      <TouchableOpacity
        key={action.navigateTo}
        style={[
          styles.circleButton,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          glowStyle ?? styles.secondaryButton,
          action.navigateTo === 'Statistics' && styles.statsButton,
          action.navigateTo === 'Profile' && styles.profileButton,
        ]}
        onPress={() => navigation.navigate(action.navigateTo as never)}
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
        <Text
          style={[
            styles.buttonTitle,
            { textAlign },
            action.accent && styles.accentButtonTitle,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          textBreakStrategy="balanced"
        >
          {title}
        </Text>
        <Text
          style={[
            styles.buttonSubtitle,
            { textAlign },
            action.accent && styles.accentButtonSubtitle,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { direction: layoutRTL ? 'rtl' : 'ltr' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            alignItems: 'flex-start',
          },
        ]}
      >
        <View
          style={[
            styles.logoContainer,
            { alignItems: IS_RTL ? 'flex-end' : 'flex-start' },
          ]}
        >
          <PredictOLogo size="small" variant="light" />
        </View>
        <View
          style={[
            styles.logoSeparator,
            { alignSelf: IS_RTL ? 'flex-end' : 'flex-start' },
          ]}
        />
        <Text
          style={[styles.greeting, { textAlign, writingDirection: layoutRTL ? 'rtl' : 'ltr' }]}
          maxFontSizeMultiplier={1.3}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {isFirstSession ? t('home.welcome') : t('home.welcomeBack')}
          {', '}
          {layoutRTL ? (
            <Text style={styles.greetingLtrEmbed}>{user?.username ?? t('home.champ')}</Text>
          ) : (
            <>{user?.username ?? t('home.champ')}</>
          )}
          {'!'}
        </Text>
        {currentStage && STAGE_STYLES[currentStage] && (
          <Text
            style={[
              styles.stageLine,
              { textAlign, writingDirection: layoutRTL ? 'rtl' : 'ltr' },
            ]}
            maxFontSizeMultiplier={1.3}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            <Text style={styles.stageLabel}>{t('home.stage')}</Text>
            <Text
              style={[
                styles.stageValue,
                { color: STAGE_STYLES[currentStage].color },
              ]}
            >
              {` ${t(`home.stages.${currentStage}`)}`}
            </Text>
          </Text>
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
        scrollEnabled={scrollEnabled}
      >
        <View style={styles.buttonsGrid}>
          {actions.map((action) => renderButton(action))}
        </View>

        <View style={[styles.infoRow, { flexDirection: 'row' }]}>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => navigation.navigate('Rules' as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="book-outline" size={18} color="#cbd5e1" />
            <Text style={[styles.infoBtnTitle, { textAlign }]}>{t('home.rules')}</Text>
            <Text style={[styles.infoBtnSubtitle, { textAlign }]}>{t('home.scoringFines')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.infoBtn, styles.infoBtnHighlight]}
            onPress={() => navigation.navigate('Onboarding' as never)}
            activeOpacity={0.75}
          >
            <Ionicons name="play-circle-outline" size={18} color="#38bdf8" />
            <Text style={[styles.infoBtnTitle, styles.infoBtnTitleHighlight, { textAlign }]}>{t('home.howItWorks')}</Text>
            <Text style={[styles.infoBtnSubtitle, styles.infoBtnSubtitleHighlight, { textAlign }]}>
              {t('home.interactiveGuide')}
            </Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <>
            <TouchableOpacity
              style={styles.adminPill}
              onPress={() => navigation.navigate('Admin' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={14} color="#9ca3af" />
              <Text style={[styles.adminPillText, { textAlign }]}>{t('home.admin')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugPill}
              onPress={async () => {
                await AsyncStorage.multiRemove(['onboarding_completed', 'quick_picks_done', 'is_first_session']);
                didCheckRef.current = false;
                navigation.replace('Onboarding', { mode: 'first-session' });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={14} color="#f59e0b" />
              <Text style={[styles.debugPillText, { textAlign }]}>{t('home.replayOnboarding')}</Text>
            </TouchableOpacity>
          </>
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
    paddingTop: 32,
    paddingBottom: 16,
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    overflow: 'visible',
  },
  logoContainer: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  logoSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 10,
    width: '40%',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  greetingLtrEmbed: {
    writingDirection: 'ltr',
  },
  stageLine: {
    marginTop: 6,
    alignSelf: 'stretch',
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
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: 12,
    marginBottom: 4,
  },
  circleButton: {
    padding: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    borderWidth: 2.5,
    borderColor: '#38bdf8',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  profileButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    shadowColor: 'transparent',
    elevation: 0,
  },

  infoRow: {
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  infoBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoBtnHighlight: {
    borderColor: 'rgba(56,189,248,0.4)',
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  infoBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  infoBtnTitleHighlight: {
    color: '#38bdf8',
  },
  infoBtnSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  infoBtnSubtitleHighlight: {
    color: 'rgba(56,189,248,0.7)',
  },

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
  buttonSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  accentButtonSubtitle: { color: 'rgba(255,255,255,0.8)' },
  debugPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#78350f',
    marginTop: 6,
  },
  debugPillText: { fontSize: 13, color: '#f59e0b', fontWeight: '500' },
});
