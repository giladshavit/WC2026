import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupsScreen from '../screens/predictions/GroupsScreen';
import ThirdPlaceScreen from '../screens/predictions/ThirdPlaceScreen';
import KnockoutScreen from '../screens/predictions/KnockoutScreen';

const Tab = createMaterialTopTabNavigator();

export default function PredictionsTopTabs() {
  // Mark that RoutePredictions screen is being opened (first time)
  useFocusEffect(
    React.useCallback(() => {
      // Set flag to indicate this is first time opening RoutePredictions
      AsyncStorage.setItem('knockoutFirstTimeOpening', 'true');
      
      return () => {
        // Cleanup: when leaving RoutePredictions, clear the flag
        // This ensures next time we come from main screen, it will be first time again
      };
    }, [])
  );

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        tabBarStyle: {
          backgroundColor: '#d4edda',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#16a34a',
          height: 3,
        },
      }}
    >
      <Tab.Screen 
        name="Groups" 
        component={GroupsScreen}
        options={{ title: 'Groups' }}
      />
      <Tab.Screen 
        name="ThirdPlace" 
        component={ThirdPlaceScreen}
        options={{ title: '3rd Place' }}
      />
      <Tab.Screen 
        name="Knockout" 
        component={KnockoutScreen}
        options={{ title: 'Knockout' }}
      />
    </Tab.Navigator>
  );
}

