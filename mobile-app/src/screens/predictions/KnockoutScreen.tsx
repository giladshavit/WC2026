import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/KnockoutMatchCard';

const Tab = createMaterialTopTabNavigator();

interface KnockoutScreenProps {}

// Individual stage component
function StageScreen({ stage, stageName }: { stage: string; stageName: string }) {
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPredictions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const data = await apiService.getKnockoutPredictions(1, stage);
      setPredictions(data);
    } catch (error) {
      console.error(`Error fetching ${stage} predictions:`, error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchPredictions();
  }, [stage]);

  // Also fetch when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchPredictions();
    }, [stage])
  );

  const handleRefresh = () => {
    fetchPredictions(true);
  };

  const handleTeamPress = (teamId: number) => {
    // TODO: Implement team selection logic
    console.log(`Selected team ${teamId}`);
  };

  const renderMatch = ({ item }: { item: KnockoutPrediction }) => (
    <KnockoutMatchCard 
      prediction={item} 
      onTeamPress={handleTeamPress}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading {stageName}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.stageContainer}>
      <FlatList
        data={predictions}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </View>
  );
}

export default function KnockoutScreen({}: KnockoutScreenProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#718096',
      }}
    >
      <Tab.Screen 
        name="Round32" 
        component={() => <StageScreen stage="round32" stageName="Round of 32" />}
        options={{ tabBarLabel: 'Round 32' }}
      />
      <Tab.Screen 
        name="Round16" 
        component={() => <StageScreen stage="round16" stageName="Round of 16" />}
        options={{ tabBarLabel: 'Round 16' }}
      />
      <Tab.Screen 
        name="Quarter" 
        component={() => <StageScreen stage="quarter" stageName="Quarter Final" />}
        options={{ tabBarLabel: 'Quarter' }}
      />
      <Tab.Screen 
        name="Semi" 
        component={() => <StageScreen stage="semi" stageName="Semi Final" />}
        options={{ tabBarLabel: 'Semi' }}
      />
      <Tab.Screen 
        name="Final" 
        component={() => <StageScreen stage="final" stageName="Final" />}
        options={{ tabBarLabel: 'Final' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabIndicator: {
    backgroundColor: '#667eea',
    height: 3,
  },
  stageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#718096',
  },
  listContainer: {
    padding: 0,
  },
});

