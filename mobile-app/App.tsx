import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomTabs from './src/navigation/BottomTabs';
import { TournamentProvider } from './src/contexts/TournamentContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <TournamentProvider>
        <NavigationContainer>
          <BottomTabs />
          <StatusBar style="auto" />
        </NavigationContainer>
      </TournamentProvider>
    </SafeAreaProvider>
  );
}
