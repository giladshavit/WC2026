import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiService, LeagueStanding, LeagueStandingsResponse } from '../services/api';
import * as Clipboard from 'expo-clipboard';

interface RouteParams {
  leagueId: string | number;
}

export default function LeagueDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as RouteParams;
  
  const [standingsData, setStandingsData] = useState<LeagueStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isGlobalLeague = leagueId === 'global';

  const fetchStandings = async () => {
    try {
      let data: LeagueStandingsResponse;
      
      if (isGlobalLeague) {
        data = await apiService.getGlobalStandings();
      } else {
        data = await apiService.getLeagueStandings(Number(leagueId));
      }
      
      setStandingsData(data);
    } catch (error) {
      console.error('Error fetching standings:', error);
      Alert.alert('Error', 'Failed to load league standings');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStandings();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStandings();
  }, [leagueId]);

  const handleCopyInviteCode = async () => {
    if (standingsData?.league_info?.invite_code) {
      await Clipboard.setStringAsync(standingsData.league_info.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const renderStandingItem = ({ item, index }: { item: LeagueStanding; index: number }) => {
    const isTopThree = index < 3;
    const rankColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#666';
    
    return (
      <View style={[styles.standingItem, isTopThree && styles.topThreeItem]}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, { color: rankColor }]}>
            {isTopThree ? ['🥇', '🥈', '🥉'][index] : item.rank}
          </Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={styles.totalPoints}>{item.total_points}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  const renderPointsBreakdown = ({ item }: { item: LeagueStanding }) => (
    <View style={styles.breakdownContainer}>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Matches:</Text>
        <Text style={styles.breakdownValue}>{item.matches_points}</Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Groups:</Text>
        <Text style={styles.breakdownValue}>{item.groups_points}</Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>3rd Place:</Text>
        <Text style={styles.breakdownValue}>{item.third_place_points}</Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Knockout:</Text>
        <Text style={styles.breakdownValue}>{item.knockout_points}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading standings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!standingsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load league data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.title}>
            {isGlobalLeague ? '🌍 Global League' : standingsData.league_info?.name || 'League'}
          </Text>
          {standingsData.league_info?.description && (
            <Text style={styles.description}>{standingsData.league_info.description}</Text>
          )}
        </View>
      </View>

      {standingsData.league_info && (
        <View style={styles.leagueInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Members:</Text>
            <Text style={styles.infoValue}>{standingsData.standings.length}</Text>
          </View>
          {standingsData.league_info.invite_code && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Invite Code:</Text>
              <TouchableOpacity
                style={styles.inviteCodeContainer}
                onPress={handleCopyInviteCode}
              >
                <Text style={styles.inviteCode}>{standingsData.league_info.invite_code}</Text>
                <Text style={styles.copyText}>Tap to copy</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={standingsData.standings}
        keyExtractor={(item) => item.user_id.toString()}
        renderItem={renderStandingItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.standingsTitle}>Standings</Text>
          </View>
        )}
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  leagueInfo: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  copyText: {
    fontSize: 12,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  standingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  standingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  topThreeItem: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  totalPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  breakdownContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});
