import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import LeaguesScreen from '../screens/leagues/LeaguesScreen';
import CreateLeagueScreen from '../screens/leagues/CreateLeagueScreen';
import EditLeagueScreen from '../screens/leagues/EditLeagueScreen';
import JoinLeagueScreen from '../screens/leagues/JoinLeagueScreen';
import LeagueDetailsScreen from '../screens/leagues/LeagueDetailsScreen';

const Stack = createStackNavigator();

export default function LeagueStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e293b',
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
          title: t('createLeague.createButton'),
          headerBackTitle: t('leagues.title'),
        }}
      />
      <Stack.Screen 
        name="JoinLeague" 
        component={JoinLeagueScreen}
        options={{ 
          title: t('joinLeague.title'),
          headerBackTitle: t('leagues.title'),
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
      <Stack.Screen
        name="EditLeague"
        component={EditLeagueScreen}
        options={({ route }: any) => ({
          title: '',  // EditLeagueScreen renders its own header title via i18n
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        })}
      />
    </Stack.Navigator>
  );
}
