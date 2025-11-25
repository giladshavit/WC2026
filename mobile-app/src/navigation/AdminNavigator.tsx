import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AdminMenuScreen from '../screens/admin/AdminMenuScreen';
import AdminMatchesScreen from '../screens/admin/AdminMatchesScreen';
import AdminGroupsScreen from '../screens/admin/AdminGroupsScreen';
import AdminThirdPlaceScreen from '../screens/admin/AdminThirdPlaceScreen';
import AdminKnockoutScreen from '../screens/admin/AdminKnockoutScreen';
import AdminStageScreen from '../screens/admin/AdminStageScreen';

export type AdminStackParamList = {
  AdminMenu: undefined;
  AdminMatches: undefined;
  AdminGroups: undefined;
  AdminThirdPlace: undefined;
  AdminKnockout: undefined;
  AdminStage: undefined;
};

const Stack = createStackNavigator<AdminStackParamList>();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#dc2626', // Red for admin
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
        name="AdminMenu"
        component={AdminMenuScreen}
        options={{
          title: 'Admin Panel',
        }}
      />
      <Stack.Screen
        name="AdminMatches"
        component={AdminMatchesScreen}
        options={{
          title: 'Match Results',
        }}
      />
      <Stack.Screen
        name="AdminGroups"
        component={AdminGroupsScreen}
        options={{
          title: 'Group Results',
        }}
      />
      <Stack.Screen
        name="AdminThirdPlace"
        component={AdminThirdPlaceScreen}
        options={{
          title: 'Third Place',
        }}
      />
      <Stack.Screen
        name="AdminKnockout"
        component={AdminKnockoutScreen}
        options={{
          title: 'Knockout Results',
        }}
      />
      <Stack.Screen
        name="AdminStage"
        component={AdminStageScreen}
        options={{
          title: 'Stage Management',
        }}
      />
    </Stack.Navigator>
  );
}

