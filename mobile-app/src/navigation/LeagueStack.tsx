import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LeaguesScreen from '../screens/leagues/LeaguesScreen';
import CreateLeagueScreen from '../screens/leagues/CreateLeagueScreen';
import JoinLeagueScreen from '../screens/leagues/JoinLeagueScreen';
import LeagueDetailsScreen from '../screens/leagues/LeagueDetailsScreen';

const Stack = createStackNavigator();

export default function LeagueStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="LeaguesMain" 
        component={LeaguesScreen}
        options={{ 
          title: 'Leagues',
          headerShown: false, // LeaguesScreen has its own header
        }}
      />
      <Stack.Screen 
        name="CreateLeague" 
        component={CreateLeagueScreen}
        options={{ 
          title: 'Create League',
        }}
      />
      <Stack.Screen 
        name="JoinLeague" 
        component={JoinLeagueScreen}
        options={{ 
          title: 'Join League',
        }}
      />
      <Stack.Screen 
        name="LeagueDetails" 
        component={LeagueDetailsScreen}
        options={{ 
          title: 'League Details',
          headerShown: false, // LeagueDetailsScreen has its own header
        }}
      />
    </Stack.Navigator>
  );
}
