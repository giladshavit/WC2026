import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MatchesScreen from '../screens/predictions/MatchesScreen';
import PredictionsMenuScreen from '../screens/PredictionsMenuScreen';
import PredictionsTopTabs from './PredictionsTopTabs';
import LeagueStack from './LeagueStack';
import StatisticsScreen from '../screens/StatisticsScreen';
import BracketScreen from '../screens/predictions/BracketScreen';
import AdminNavigator from './AdminNavigator';

export type MainStackParamList = {
  Home: undefined;
  Profile: undefined;
  PredictionsMenu: undefined;
  MatchPredictions: undefined;
  RoutePredictions: undefined;
  Bracket: undefined;
  Leagues: undefined;
  Statistics: undefined;
  Admin: undefined;
};

const Stack = createStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#16a34a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
        headerBackTitleVisible: false,
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
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name="PredictionsMenu"
        component={PredictionsMenuScreen}
        options={{
          title: 'My Predictions',
        }}
      />
      <Stack.Screen
        name="MatchPredictions"
        component={MatchesScreen}
        options={{
          title: 'Match Predictions',
        }}
      />
      <Stack.Screen
        name="RoutePredictions"
        component={PredictionsTopTabs}
        options={{
          title: 'Route Predictions',
        }}
      />
      <Stack.Screen
        name="Bracket"
        component={BracketScreen}
        options={{
          title: 'Full Bracket',
          headerBackTitle: 'back',
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
        }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminNavigator}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}


