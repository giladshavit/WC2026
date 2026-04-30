import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_RTL } from '../utils/rtl';
import PredictionsTopTabs from './PredictionsTopTabs';
import MatchesScreen from '../screens/predictions/MatchesScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import LeagueStack from './LeagueStack';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#a0aec0',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          writingDirection: IS_RTL ? 'rtl' : 'ltr',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingTop: 5,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}
    >
      <Tab.Screen 
        name="PredictionsTab" 
        component={PredictionsTopTabs}
        options={{ 
          title: t('nav.predictions'),
          tabBarLabel: t('nav.predictions'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🎯</Text>,
        }}
      />
      <Tab.Screen 
        name="MatchesTab" 
        component={MatchesScreen}
        options={{ 
          title: t('nav.matches'),
          tabBarLabel: t('nav.matches'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>⚽</Text>,
        }}
      />
      <Tab.Screen 
        name="LeaguesTab" 
        component={LeagueStack}
        options={{ 
          title: t('nav.leagues'),
          tabBarLabel: t('nav.leagues'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏆</Text>,
          headerShown: false, // LeagueStack handles its own headers
        }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={MyProfileScreen}
        options={{ 
          title: t('profile.title'),
          tabBarLabel: t('profile.title'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

