import './src/i18n/index';
import React, { useState, useEffect } from 'react';
import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet, Text, TextInput, I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';
import MainNavigator from './src/navigation/MainNavigator';
import AuthScreen from './src/screens/auth/AuthScreen';
import SocialUsernameScreen from './src/screens/auth/SocialUsernameScreen';
import SplashScreen from './src/screens/SplashScreen';
import { TournamentProvider } from './src/contexts/TournamentContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/toast/Toast';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Settings } from 'react-native-fbsdk-next';
import {
  extractJoinInviteCodeFromUrl,
  usePendingInviteCode,
} from './src/hooks/usePendingInviteCode';

const isHebrew = (getLocales()[0]?.languageTag ?? 'en').toLowerCase().startsWith('he');
I18nManager.allowRTL(isHebrew);
I18nManager.forceRTL(isHebrew);

export { IS_RTL } from './src/utils/rtl';

// Global font scaling cap — allows up to 30% enlargement, prevents layout breakage
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.3;
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.3;

const navigationRef = createNavigationContainerRef();

/** Join League lives under LeagueStack (Leagues), not Home — see reset state below */
const linking = {
  prefixes: ['predicto://', 'https://getpredicto.com', 'https://www.getpredicto.com'],
  config: {
    screens: {
      Home: '',
    },
  },
};

const processedJoinDeepLinkUrls = new Set<string>();

function dispatchJoinInviteReset(code: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        {
          name: 'Leagues',
          state: {
            routes: [
              { name: 'LeaguesMain' },
              { name: 'JoinLeague', params: { code } },
            ],
            index: 1,
          },
        },
      ],
    })
  );
}

/** Authenticated-only: normalize URL consumption for join deep links */
function tryConsumeJoinInviteUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const code = extractJoinInviteCodeFromUrl(url);
  if (!code || processedJoinDeepLinkUrls.has(url)) return false;
  processedJoinDeepLinkUrls.add(url);
  dispatchJoinInviteReset(code);
  return true;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { saveInviteCode, getPendingInviteCode, clearInviteCode } = usePendingInviteCode();
  const launchLinkUrl = Linking.useLinkingURL();
  const [showSplash, setShowSplash] = useState(true);
  const [navReady, setNavReady] = useState(false);
  const [pendingSocialReg, setPendingSocialReg] = useState<{
    provider: 'google' | 'apple';
    google_id?: string;
    apple_id?: string;
    email?: string;
    name?: string;
    id_token?: string;
    identity_token?: string;
  } | null>(null);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  /** Deep link invite: stash for logged-out users; reset stack (Home → JoinLeague) when logged in */
  useEffect(() => {
    if (isLoading || !launchLinkUrl) return;
    const code = extractJoinInviteCodeFromUrl(launchLinkUrl);
    if (!code) return;
    if (!isAuthenticated) void saveInviteCode(code);
    else if (!showSplash && navReady) tryConsumeJoinInviteUrl(launchLinkUrl);
  }, [launchLinkUrl, isLoading, isAuthenticated, saveInviteCode, showSplash, navReady]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const code = extractJoinInviteCodeFromUrl(url);
      if (!code) return;
      if (!isAuthenticated) {
        void saveInviteCode(code);
        return;
      }
      if (!navigationRef.isReady()) return;
      tryConsumeJoinInviteUrl(url);
    });
    return () => subscription.remove();
  }, [isAuthenticated, saveInviteCode]);

  useEffect(() => {
    if (showSplash || isLoading || !isAuthenticated || !navReady) return;

    let cancelled = false;
    (async () => {
      const pending = await getPendingInviteCode();
      if (!pending || cancelled) return;
      await clearInviteCode();
      if (!navigationRef.isReady()) return;
      dispatchJoinInviteReset(pending);
    })();

    return () => {
      cancelled = true;
    };
  }, [showSplash, isLoading, isAuthenticated, navReady, getPendingInviteCode, clearInviteCode]);

  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <NavigationContainer
        ref={navigationRef}
        linking={linking as any}
        onReady={() => setNavReady(true)}
      >
        {isAuthenticated ? (
          <MainNavigator />
        ) : pendingSocialReg ? (
          <SocialUsernameScreen
            provider={pendingSocialReg.provider}
            google_id={pendingSocialReg.google_id}
            apple_id={pendingSocialReg.apple_id}
            email={pendingSocialReg.email}
            prefillName={pendingSocialReg.name}
            id_token={pendingSocialReg.id_token}
            identity_token={pendingSocialReg.identity_token}
            onSuccess={() => setPendingSocialReg(null)}
            onBack={() => setPendingSocialReg(null)}
          />
        ) : (
          <AuthScreen onSocialRegistration={(data) => setPendingSocialReg(data)} />
        )}
        <StatusBar style="light" />
      </NavigationContainer>
    </ToastProvider>
  );
}

function AppRoot() {
  useEffect(() => {
    (async () => {
      try {
        const { status } = await requestTrackingPermissionsAsync();
        await Settings.setAdvertiserTrackingEnabled(status === 'granted');
      } catch (e) {
        console.warn('Tracking/Facebook SDK init failed:', e);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TournamentProvider>
          <AppContent />
        </TournamentProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  try {
    return <AppRoot />;
  } catch (error) {
    console.error('App() synchronous render error', error);
    if (error instanceof Error) {
      console.error('App() stack', error.stack);
    } else {
      console.error('App() non-Error', String(error));
    }
    throw error;
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
