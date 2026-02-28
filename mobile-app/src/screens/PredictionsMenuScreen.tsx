import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/MainNavigator';

type NavigationProp = StackNavigationProp<MainStackParamList, 'PredictionsMenu'>;

const options: Array<{
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  navigateTo: keyof MainStackParamList;
}> = [
  {
    title: 'Match Predictions',
    subtitle: 'Predict scores for every match',
    icon: 'football-outline',
    navigateTo: 'MatchPredictions',
  },
  {
    title: 'Route Predictions',
    subtitle: 'Groups, 3rd place & knockout bracket',
    icon: 'git-branch-outline',
    navigateTo: 'RoutePredictions',
  },
  {
    title: 'Full Bracket',
    subtitle: 'View your complete tournament bracket',
    icon: 'grid-outline',
    navigateTo: 'Bracket',
  },
];

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option.title}
            style={styles.card}
            onPress={() => navigation.navigate(option.navigateTo)}
            activeOpacity={0.75}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={option.icon} size={28} color="#16a34a" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '400',
  },
});
