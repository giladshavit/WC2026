import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PredictionsTopTabs from './PredictionsTopTabs';
import ResultsScreen from '../screens/results/ResultsScreen';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#a0aec0',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
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
          title: 'Predictions',
          tabBarLabel: 'Predictions',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🎯</Text>,
        }}
      />
      <Tab.Screen 
        name="ResultsTab" 
        component={ResultsScreen}
        options={{ 
          title: 'Results',
          tabBarLabel: 'Results',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📊</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

