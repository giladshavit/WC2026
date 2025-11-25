import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainStackParamList } from '../navigation/MainNavigator';
import { useAuth } from '../contexts/AuthContext';

type NavigationProp = StackNavigationProp<MainStackParamList, 'Home'>;

const actions: Array<{
  title: string;
  subtitle: string;
  emoji: string;
  navigateTo: keyof MainStackParamList;
}> = [
  {
    title: 'Profile',
    subtitle: 'View your details and preferences',
    emoji: '👤',
    navigateTo: 'Profile',
  },
  {
    title: 'My Predictions',
    subtitle: 'Manage your match and bracket picks',
    emoji: '🎯',
    navigateTo: 'PredictionsMenu',
  },
  {
    title: 'Leagues',
    subtitle: 'Compete with friends and communities',
    emoji: '🏆',
    navigateTo: 'Leagues',
  },
  {
    title: 'Statistics',
    subtitle: 'Track standings and insights',
    emoji: '📊',
    navigateTo: 'Statistics',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  
  // Check if user is admin (for now, check by username - you can change this logic)
  const isAdmin = user?.username === 'admin' || user?.username === 'gilad';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.greeting}>Welcome back!</Text>
        <Text style={styles.subtitle}>Choose where you want to go</Text>

        <View style={styles.buttonsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.title}
              style={styles.circleButton}
              onPress={() => navigation.navigate(action.navigateTo)}
              activeOpacity={0.8}
            >
              <Text style={styles.emoji}>{action.emoji}</Text>
              <Text style={styles.buttonTitle}>{action.title}</Text>
              <Text style={styles.buttonSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.circleButton, styles.adminButton]}
              onPress={() => navigation.navigate('Admin' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.emoji}>⚙️</Text>
              <Text style={styles.buttonTitle}>Admin</Text>
              <Text style={styles.buttonSubtitle}>Manage tournament</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f5ff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 24,
  },
  buttonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  buttonSubtitle: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 4,
  },
  adminButton: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
});



