import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = StackNavigationProp<MainStackParamList, 'PredictionsMenu'>;

const options: Array<{
  title: string;
  description: string;
  emoji: string;
  navigateTo: keyof MainStackParamList;
}> = [
  {
    title: 'Match Predictions',
    description: 'Enter scores for every match',
    emoji: '⚽',
    navigateTo: 'MatchPredictions',
  },
  {
    title: 'Route Predictions',
    description: 'Set your bracket and knockout path',
    emoji: '🗺️',
    navigateTo: 'RoutePredictions',
  },
  {
    title: 'Show Full Bracket',
    description: 'View complete tournament bracket',
    emoji: '🏆',
    navigateTo: 'Bracket',
  },
];

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heading}>Pick a prediction flow</Text>
        <Text style={styles.caption}>
          Decide whether you want to fill in match-by-match scores or manage your overall bracket path.
        </Text>

        <View style={styles.buttonsRow}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.title}
              style={styles.circleButton}
              onPress={() => navigation.navigate(option.navigateTo)}
              activeOpacity={0.85}
            >
              <Text style={styles.emoji}>{option.emoji}</Text>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f5ff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 12,
    textAlign: 'center',
    width: '100%',
  },
  caption: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 32,
    textAlign: 'center',
    width: '100%',
  },
  buttonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  circleButton: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 42,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  description: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 4,
  },
});


