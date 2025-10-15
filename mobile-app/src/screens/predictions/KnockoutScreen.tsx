import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
// import { useFocusEffect } from '@react-navigation/native';
import { KnockoutPrediction, apiService } from '../../services/api';
import KnockoutMatchCard from '../../components/KnockoutMatchCard';

const Tab = createMaterialTopTabNavigator();

interface KnockoutScreenProps {}

// Type for pending changes
interface PendingChange {
  prediction_id: number;
  winner_team_number: number; // 1 or 2
  winner_team_name: string;
}

// Context to avoid passing props that cause remounts
const KnockoutContext = React.createContext<{
  pendingChanges: PendingChange[];
  onTeamPress: (predictionId: number, teamId: number, teamName: string, teamNumber: number) => void;
  onSendChanges: () => void;
  onRefreshData: () => void;
  refreshTrigger: number;
}>({ pendingChanges: [], onTeamPress: () => {}, onSendChanges: () => {}, onRefreshData: () => {}, refreshTrigger: 0 });

// Individual stage component
const StageScreen = React.memo(({ route }: { route: any }) => {
  const { stage, stageName } = route.params || {};
  const { pendingChanges, onTeamPress, onSendChanges, onRefreshData, refreshTrigger } = useContext(KnockoutContext);
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

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

  // Listen for refresh requests from parent
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchPredictions();
    }
  }, [refreshTrigger]);

  // Remove useFocusEffect to prevent screen refresh on team press
  // useFocusEffect(
  //   React.useCallback(() => {
  //     // Only refresh if there are no pending changes to avoid losing user selections
  //     if (pendingChanges.length === 0) {
  //       fetchPredictions();
  //     }
  //   }, [stage, pendingChanges.length])
  // );

  const handleRefresh = () => {
    fetchPredictions(true);
  };

  const handleTeamPress = (teamId: number) => {
    // Find the prediction for this team
    const prediction = predictions.find(p => p.team1_id === teamId || p.team2_id === teamId);
    if (!prediction) return;

    const teamNumber = prediction.team1_id === teamId ? 1 : 2;
    const teamName = teamNumber === 1 ? prediction.team1_name : prediction.team2_name;
    
    if (teamName) {
      onTeamPress(prediction.id, teamId, teamName, teamNumber);
    }
  };

  const renderMatch = ({ item }: { item: KnockoutPrediction }) => {
    const isTBD = (name?: string | null) => !name || name === 'TBD' || name.trim() === '';
    // Skip rendering if both teams are TBD
    if (isTBD(item.team1_name) && isTBD(item.team2_name)) {
      return null;
    }
    // Find pending change for this prediction
    const pendingChange = pendingChanges.find(change => change.prediction_id === item.id);
    const pendingWinner = pendingChange ? 
      (pendingChange.winner_team_number === 1 ? item.team1_id : item.team2_id) : 
      undefined;

    return (
      <KnockoutMatchCard 
        prediction={item} 
        onTeamPress={handleTeamPress}
        pendingWinner={pendingWinner}
      />
    );
  };

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
        keyExtractor={(item) => `prediction-${item.id}`}
        contentContainerStyle={[styles.listContainer, pendingChanges.length > 0 && styles.listWithButton]}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      {pendingChanges.length > 0 && (
        <View style={styles.pendingChangesContainer}>
          <Text style={styles.pendingChangesText}>
            {pendingChanges.length} שינויים ממתינים
          </Text>
          <TouchableOpacity 
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={onSendChanges}
            disabled={sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? 'שולח...' : 'שלח שינויים'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

export default function KnockoutScreen({}: KnockoutScreenProps) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [sending, setSending] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const userId = 1; // Hardcoded for now

  const handleTeamPress = React.useCallback((predictionId: number, teamId: number, teamName: string, teamNumber: number) => {
    setPendingChanges(prev => {
      // Remove existing change for this prediction if any
      const filtered = prev.filter(change => change.prediction_id !== predictionId);
      // Add new change
      return [...filtered, {
        prediction_id: predictionId,
        winner_team_number: teamNumber,
        winner_team_name: teamName
      }];
    });
  }, []);

  const handleSendChanges = React.useCallback(async () => {
    if (pendingChanges.length === 0) return;

    setSending(true);
    try {
      const result = await apiService.updateBatchKnockoutPredictions(userId, pendingChanges);
      
      Alert.alert(
        'הצלחה!', 
        `נשמרו ${pendingChanges.length} שינויים בהצלחה`,
        [{ text: 'אישור', onPress: () => {
          setPendingChanges([]);
          // Trigger refresh of all stage screens
          setRefreshTrigger(prev => prev + 1);
        }}]
      );
    } catch (error) {
      console.error('Error sending changes:', error);
      Alert.alert(
        'שגיאה', 
        'שגיאה בשליחת השינויים. נסה שוב.',
        [{ text: 'אישור' }]
      );
    } finally {
      setSending(false);
    }
  }, [pendingChanges, userId]);

  const handleRefreshData = React.useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <KnockoutContext.Provider value={{ pendingChanges, onTeamPress: handleTeamPress, onSendChanges: handleSendChanges, onRefreshData: handleRefreshData, refreshTrigger }}>
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
          component={StageScreen}
          initialParams={{ stage: 'round32', stageName: 'Round of 32' }}
          options={{ tabBarLabel: 'Round 32' }}
        />
        <Tab.Screen 
          name="Round16" 
          component={StageScreen}
          initialParams={{ stage: 'round16', stageName: 'Round of 16' }}
          options={{ tabBarLabel: 'Round 16' }}
        />
        <Tab.Screen 
          name="Quarter" 
          component={StageScreen}
          initialParams={{ stage: 'quarter', stageName: 'Quarter Final' }}
          options={{ tabBarLabel: 'Quarter' }}
        />
        <Tab.Screen 
          name="Semi" 
          component={StageScreen}
          initialParams={{ stage: 'semi', stageName: 'Semi Final' }}
          options={{ tabBarLabel: 'Semi' }}
        />
        <Tab.Screen 
          name="Final" 
          component={StageScreen}
          initialParams={{ stage: 'final', stageName: 'Final' }}
          options={{ tabBarLabel: 'Final' }}
        />
      </Tab.Navigator>
    </KnockoutContext.Provider>
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
  listWithButton: {
    paddingBottom: 80, // Space for the fixed button
  },
  pendingChangesContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f0fdf4',
    padding: 12,
    margin: 0,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10b981',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pendingChangesText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

