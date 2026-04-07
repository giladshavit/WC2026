import React from 'react';
import { StatusBar } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupsContainerScreen from '../screens/predictions/GroupsContainerScreen';
import KnockoutScreen from '../screens/predictions/KnockoutScreen';

const Tab = createMaterialTopTabNavigator();

export default function PredictionsTopTabs() {
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.setItem('knockoutFirstTimeOpening', 'true');

      return () => {};
    }, [])
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#16a34a',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 'bold',
            textAlign: 'center',
          },
          tabBarStyle: {
            backgroundColor: '#1e293b',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#2d4a6e',
          },
          tabBarIndicatorStyle: {
            backgroundColor: '#16a34a',
            height: 3,
          },
        }}
      >
        <Tab.Screen name="Groups" component={GroupsContainerScreen} options={{ title: 'Group Stage' }} />
        <Tab.Screen name="Knockout" component={KnockoutScreen} options={{ title: 'Knockout Stage' }} />
      </Tab.Navigator>
    </>
  );
}
