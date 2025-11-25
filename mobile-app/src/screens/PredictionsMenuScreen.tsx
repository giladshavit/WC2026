import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = StackNavigationProp<MainStackParamList, 'PredictionsMenu'>;

const options: Array<{
  title: string;
  emoji: string;
  navigateTo: keyof MainStackParamList;
}> = [
  {
    title: 'Match Predictions',
    emoji: '⚽',
    navigateTo: 'MatchPredictions',
  },
  {
    title: 'Route Predictions',
    emoji: '🗺️',
    navigateTo: 'RoutePredictions',
  },
  {
    title: 'Show Full Bracket',
    emoji: '🏆',
    navigateTo: 'Bracket',
  },
];

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heading}>My Predictions</Text>
        <Text style={styles.subheading}>Choose how you want to manage your predictions</Text>

        <View style={styles.buttonsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.title}
              style={[
                styles.circleButton,
                index === 2 && styles.lastButton, // Center the last button
              ]}
              onPress={() => navigation.navigate(option.navigateTo)}
              activeOpacity={0.85}
            >
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{option.emoji}</Text>
              </View>
              <Text style={styles.title}>{option.title}</Text>
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
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  subheading: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 48,
    textAlign: 'center',
    width: '100%',
    fontWeight: '400',
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  circleButton: {
    width: '45%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginHorizontal: '2.5%',
    marginBottom: 20,
  },
  lastButton: {
    // Center the third button
    marginLeft: '27.5%',
    marginRight: '27.5%',
  },
  emojiContainer: {
    marginBottom: 12,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 20,
  },
});


