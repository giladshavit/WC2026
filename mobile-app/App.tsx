import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import MainNavigator from './src/navigation/MainNavigator';
import AuthScreen from './src/screens/auth/AuthScreen';
import SocialUsernameScreen from './src/screens/auth/SocialUsernameScreen';
import SplashScreen from './src/screens/SplashScreen';
import { TournamentProvider } from './src/contexts/TournamentContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/toast/Toast';
import { Text, TextInput } from 'react-native';

// Global font scaling cap — allows up to 30% enlargement, prevents layout breakage
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.3;
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.3;

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
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
      <NavigationContainer>
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

export default function App() {
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
