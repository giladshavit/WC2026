import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import MatchesScreen from '../screens/predictions/MatchesScreen';
import PredictionsMenuScreen from '../screens/predictions/PredictionsMenuScreen';
import PredictionsTopTabs from './PredictionsTopTabs';
import LeagueStack from './LeagueStack';
import StatisticsScreen from '../screens/statistics/StatisticsScreen';
import BracketScreen from '../screens/predictions/BracketScreen';
import BonusScreen from '../screens/predictions/BonusScreen';
import AdminNavigator from './AdminNavigator';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import RulesScreen from '../screens/RulesScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import QuickPicksScreen from '../screens/onboarding/QuickPicksScreen';
import QuickPicksT3Screen from '../screens/onboarding/QuickPicksT3Screen';
import QuickPicksDoneScreen from '../screens/onboarding/QuickPicksDoneScreen';
import type { MainStackParamList } from './MainStackParamList';

export type { MainStackParamList };

const Stack = createStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#16a34a',
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={MyProfileScreen}
        options={{
          title: 'Profile',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
        }}
      />
      <Stack.Screen
        name="PredictionsMenu"
        component={PredictionsMenuScreen}
        options={{
          title: 'My Predictions',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
        }}
      />
      <Stack.Screen
        name="MatchPredictions"
        component={MatchesScreen}
        options={{
          title: 'Match Predictions',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
          headerTintColor: '#e2e8f0',
        }}
      />
      <Stack.Screen
        name="RoutePredictions"
        component={PredictionsTopTabs}
        options={{
          title: 'Route Predictions',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
          headerTintColor: '#e2e8f0',
        }}
      />
      <Stack.Screen
        name="Bracket"
        component={BracketScreen}
        options={{
          title: 'Full Bracket',
          headerBackTitle: 'back',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
          headerTintColor: '#e2e8f0',
        }}
      />
      <Stack.Screen
        name="BonusPredictions"
        component={BonusScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Leagues"
        component={LeagueStack}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          title: 'Statistics',
          headerStyle: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
        }}
      />
      <Stack.Screen
        name="Rules"
        component={RulesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QuickPicks"
        component={QuickPicksScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QuickPicksT3"
        component={QuickPicksT3Screen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QuickPicksDone"
        component={QuickPicksDoneScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}


