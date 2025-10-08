import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MatchesScreen from '../screens/predictions/MatchesScreen';
import GroupsScreen from '../screens/predictions/GroupsScreen';
import ThirdPlaceScreen from '../screens/predictions/ThirdPlaceScreen';
import KnockoutScreen from '../screens/predictions/KnockoutScreen';

const Tab = createMaterialTopTabNavigator();

export default function PredictionsTopTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#a0aec0',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
          flexDirection: 'row-reverse', // RTL for top tabs
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#667eea',
          height: 3,
        },
      }}
    >
      <Tab.Screen 
        name="Matches" 
        component={MatchesScreen}
        options={{ title: 'משחקים' }}
      />
      <Tab.Screen 
        name="Groups" 
        component={GroupsScreen}
        options={{ title: 'מיקומים' }}
      />
      <Tab.Screen 
        name="ThirdPlace" 
        component={ThirdPlaceScreen}
        options={{ title: 'מקום 3' }}
      />
      <Tab.Screen 
        name="Knockout" 
        component={KnockoutScreen}
        options={{ title: 'נוקאאוט' }}
      />
    </Tab.Navigator>
  );
}

