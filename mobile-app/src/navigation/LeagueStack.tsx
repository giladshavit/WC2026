import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LeaguesScreen from '../screens/LeaguesScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import JoinLeagueScreen from '../screens/JoinLeagueScreen';
import LeagueDetailsScreen from '../screens/LeagueDetailsScreen';

const Stack = createStackNavigator();

export default function LeagueStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#16a34a',
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
