import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiService, League } from '../services/api';

export default function LeaguesScreen() {
  const navigation = useNavigation();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeagues = async () => {
    try {
      const userLeagues = await apiService.getUserLeagues();
      setLeagues(userLeagues);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      Alert.alert('Error', 'Failed to load leagues');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeagues();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  // Refresh leagues when screen comes into focus (e.g., after creating/joining a league)
  useFocusEffect(
    React.useCallback(() => {
      fetchLeagues();
    }, [])
  );

  const handleGlobalLeague = () => {
    (navigation as any).navigate('LeagueDetails', { leagueId: 'global' });
  };

  const handleCreateLeague = () => {
    (navigation as any).navigate('CreateLeague');
  };

  const handleJoinLeague = () => {
    (navigation as any).navigate('JoinLeague');
  };

  const handleLeaguePress = (league: League) => {
    (navigation as any).navigate('LeagueDetails', { leagueId: league.id });
  };

  const renderLeagueItem = ({ item }: { item: League }) => (
    <TouchableOpacity
      style={styles.leagueCard}
      onPress={() => handleLeaguePress(item)}
    >
      <View style={styles.leagueHeader}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <Text style={styles.memberCount}>{item.member_count} members</Text>
      </View>
      {item.description && (
        <Text style={styles.leagueDescription}>{item.description}</Text>
      )}
      <View style={styles.leagueFooter}>
        <Text style={styles.inviteCode}>Code: {item.invite_code}</Text>
        <Text style={styles.joinedDate}>
          Joined: {new Date(item.joined_at || item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGlobalLeague = () => (
    <TouchableOpacity
      style={[styles.leagueCard, styles.globalLeagueCard]}
      onPress={handleGlobalLeague}
    >
      <View style={styles.leagueHeader}>
        <Text style={[styles.leagueName, styles.globalLeagueName]}>🌍 Global League</Text>
        <Text style={styles.memberCount}>All players</Text>
      </View>
      <Text style={styles.leagueDescription}>
        Compete against all players worldwide
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading leagues...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leagues</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCreateLeague}
          >
            <Text style={styles.headerButtonText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleJoinLeague}
          >
            <Text style={styles.headerButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderLeagueItem}
        ListHeaderComponent={renderGlobalLeague}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  globalLeagueCard: {
    backgroundColor: '#e8f4fd',
    borderColor: '#007AFF',
    borderWidth: 2,
    marginBottom: 16,
  },
  leagueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  globalLeagueName: {
    color: '#007AFF',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  leagueDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  leagueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteCode: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  joinedDate: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
