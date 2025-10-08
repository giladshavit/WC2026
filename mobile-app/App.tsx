import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomTabs from './src/navigation/BottomTabs';

export default function App() {
  useEffect(() => {
    // Force RTL layout for Hebrew
    I18nManager.forceRTL(true);
    I18nManager.allowRTL(true);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <BottomTabs />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
