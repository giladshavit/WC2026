import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Match, apiService } from '../../services/api';
import MatchCard from '../../components/MatchCard';

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async () => {
    try {
      const data = await apiService.getMatches(1); // Using user_id = 1 for now
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את המשחקים. בדוק שהשרת פועל.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleScoreChange = async (matchId: number, homeScore: number | null, awayScore: number | null) => {
    try {
      await apiService.updateMatchPrediction(1, matchId, homeScore, awayScore);
      Alert.alert('הצלחה', 'הניחוש נשמר בהצלחה!');
      // Refresh matches to get updated data
      fetchMatches();
    } catch (error) {
      console.error('Error updating prediction:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את הניחוש. נסה שוב.');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <MatchCard match={item} onScoreChange={handleScoreChange} />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>טוען משחקים...</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>אין משחקים זמינים כרגע</Text>
        <Text style={styles.emptySubtext}>בדוק שהשרת פועל ושהמשחקים נוצרו</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ניחושי משחקים</Text>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    textAlign: 'center',
    marginVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});

