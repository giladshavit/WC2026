import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import BracketIcon from '../../components/icons/BracketIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../../navigation/MainNavigator';

type NavigationProp = StackNavigationProp<MainStackParamList, 'PredictionsMenu'>;

type PredictionsScreenName = 'MatchPredictions' | 'RoutePredictions' | 'Bracket' | 'BonusPredictions';

const options: Array<{
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  navigateTo: PredictionsScreenName;
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
    title: 'Bonus Predictions',
    subtitle: 'Special tournament questions',
    icon: 'gift-outline',
    navigateTo: 'BonusPredictions',
  },
  {
    title: 'Full Bracket',
    subtitle: 'View your complete tournament bracket',
    icon: 'grid-outline',
    navigateTo: 'Bracket',
  },
];

const renderIcon = (option: typeof options[0]) => {
  if (option.navigateTo === 'Bracket') {
    return <BracketIcon size={28} color="#16a34a" />;
  }
  return <Ionicons name={option.icon} size={28} color="#16a34a" />;
};

export default function PredictionsMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
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
              {renderIcon(option)}
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
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
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '400',
  },
});
