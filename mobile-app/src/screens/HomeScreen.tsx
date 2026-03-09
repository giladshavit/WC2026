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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import PredictOLogo from '../components/shared/PredictOLogo';
import { MainStackParamList } from '../navigation/MainNavigator';
import { useAuth } from '../contexts/AuthContext';

type NavigationProp = StackNavigationProp<MainStackParamList, 'Home'>;

const screenWidth = Dimensions.get('window').width;
const buttonSize = (screenWidth - 24 * 2 - 16) / 2;

const actions: Array<{
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: Exclude<keyof MainStackParamList, 'UserProfile'>;
}> = [
  {
    title: 'Profile',
    subtitle: 'Account & preferences',
    icon: 'person-circle-outline',
    navigateTo: 'Profile',
  },
  {
    title: 'My Predictions',
    subtitle: 'Matches & bracket picks',
    icon: 'help-circle-outline',
    navigateTo: 'PredictionsMenu',
  },
  {
    title: 'Leagues',
    subtitle: 'Compete with friends',
    icon: 'trophy-outline',
    navigateTo: 'Leagues',
  },
  {
    title: 'Statistics',
    subtitle: 'Standings & insights',
    icon: 'bar-chart-outline',
    navigateTo: 'Statistics',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isAdmin =
    (user?.user_id != null && user.user_id >= 1 && user.user_id <= 10) ||
    user?.is_admin === true;

  const renderButton = (
    action: (typeof actions)[0],
    isPrimary: boolean
  ) => (
    <TouchableOpacity
      key={action.title}
      style={[styles.circleButton, isPrimary && styles.primaryButton]}
      onPress={() => navigation.navigate(action.navigateTo)}
      activeOpacity={0.8}
    >
      <Ionicons
        name={action.icon}
        size={36}
        color={isPrimary ? '#ffffff' : '#16a34a'}
        style={styles.icon}
      />
      <Text
        style={[
          styles.buttonTitle,
          isPrimary && styles.primaryButtonTitle,
        ]}
      >
        {action.title}
      </Text>
      <Text
        style={[
          styles.buttonSubtitle,
          isPrimary && styles.primaryButtonSubtitle,
        ]}
      >
        {action.subtitle}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoContainer}>
          <PredictOLogo size="small" variant="light" />
        </View>
        <View style={styles.logoSeparator} />
        <Text style={styles.greeting}>
          Welcome back, {user?.username ?? 'Champ'}!
        </Text>
        <Text style={styles.subtitle}>Where do you want to go?</Text>

        <View style={styles.waveSvgContainer}>
          <Svg
            height="32"
            width="100%"
            viewBox="0 0 390 32"
            preserveAspectRatio="none"
          >
            <Path
              d="M0,0 C97.5,32 292.5,32 390,0 L390,0 L0,0 Z"
              fill="#16a34a"
            />
          </Svg>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.buttonsGrid}>
          {actions.map((action) =>
            renderButton(action, action.navigateTo === 'PredictionsMenu')
          )}
        </View>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    overflow: 'visible',
  },
  logoContainer: {
    alignItems: 'flex-start',
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
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
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
  },
  circleButton: {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
    shadowColor: '#16a34a',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  adminPillText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  icon: {
    marginBottom: 8,
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  primaryButtonTitle: {
    color: '#ffffff',
  },
  buttonSubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  primaryButtonSubtitle: {
    color: 'rgba(255,255,255,0.8)',
  },
});
