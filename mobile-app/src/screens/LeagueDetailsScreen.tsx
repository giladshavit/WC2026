import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiService, LeagueStanding, LeagueStandingsResponse } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';

type SortKey = 'total' | 'matches' | 'groups' | 'knockout' | 'penalty';

interface RouteParams {
  leagueId: string | number;
}

// Extended standing with optional penalty (API may not return it yet)
interface StandingWithPenalty extends LeagueStanding {
  penalty?: number;
}

export default function LeagueDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as RouteParams;
  const { getCurrentUserId } = useAuth();

  const [standingsData, setStandingsData] = useState<LeagueStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('total');

  const isGlobalLeague = leagueId === 'global';
  const currentUserId = getCurrentUserId();

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

  const sortedStandings = useMemo(() => {
    if (!standingsData?.standings) return [];
    const standings = [...standingsData.standings] as StandingWithPenalty[];
    const penalty = (s: StandingWithPenalty) => s.penalty ?? 0;
    const groupsPlusThird = (s: StandingWithPenalty) =>
      (s.groups_points ?? 0) + (s.third_place_points ?? 0);

    standings.sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return (b.total_points ?? 0) - (a.total_points ?? 0);
        case 'matches':
          return (b.matches_points ?? 0) - (a.matches_points ?? 0);
        case 'groups':
          return groupsPlusThird(b) - groupsPlusThird(a);
        case 'knockout':
          return (b.knockout_points ?? 0) - (a.knockout_points ?? 0);
        case 'penalty':
          return penalty(a) - penalty(b);
        default:
          return 0;
      }
    });
    return standings;
  }, [standingsData?.standings, sortBy]);

  const truncateName = (name: string, maxLen: number = 14) =>
    name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name;

  const renderTableRow = ({ item, index }: { item: StandingWithPenalty; index: number }) => {
    const isTopThree = index < 3;
    const rankDisplay = isTopThree ? ['🥇', '🥈', '🥉'][index] : (index + 1).toString();
    const isCurrentUser = currentUserId !== null && item.user_id === currentUserId;
    const penaltyVal = item.penalty ?? 0;
    const groupsPlusThird = (item.groups_points ?? 0) + (item.third_place_points ?? 0);
    const rowBg =
      isCurrentUser
        ? '#e8f4fd'
        : isTopThree
          ? index === 0
            ? '#fffef5'
            : index === 1
              ? '#f8f8f8'
              : '#fff9f0'
          : index % 2 === 0
            ? '#fff'
            : '#f9f9f9';

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBg }]}>
        <View style={styles.colRank}>
          <Text style={[styles.cellText, styles.cellCenter, isCurrentUser && styles.cellBold]}>
            {rankDisplay}
          </Text>
        </View>
        <View style={styles.colName}>
          <Text
            style={[styles.cellText, styles.cellLeft, isCurrentUser && styles.cellBold]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {truncateName(item.name)}
          </Text>
        </View>
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{item.matches_points ?? 0}</Text>
        </View>
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{groupsPlusThird}</Text>
        </View>
        <View style={styles.colNum}>
          <Text style={[styles.cellText, styles.cellCenter]}>{item.knockout_points ?? 0}</Text>
        </View>
        <View style={styles.colNum}>
          <Text
            style={[
              styles.cellText,
              styles.cellCenter,
              penaltyVal > 0 && styles.cellPenalty,
            ]}
          >
            {penaltyVal > 0 ? penaltyVal : '—'}
          </Text>
        </View>
        <View style={styles.colTotal}>
          <Text style={[styles.cellTotal, styles.cellCenter, isCurrentUser && styles.cellBold]}>
            {item.total_points ?? 0}
          </Text>
        </View>
      </View>
    );
  };

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'matches', label: 'Matches' },
    { key: 'groups', label: 'Groups' },
    { key: 'knockout', label: 'Knockout' },
    { key: 'penalty', label: 'Penalty' },
  ];

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

      <View style={styles.tableWrapper}>
        <View style={styles.sortRowContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sortRow}
            contentContainerStyle={styles.sortRowContent}
          >
            {sortButtons.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.sortButton, sortBy === key && styles.sortButtonActive]}
                onPress={() => setSortBy(key)}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    sortBy === key && styles.sortButtonTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tableHeader}>
          <View style={styles.colRank}><Text style={[styles.headerCell, styles.cellCenter]}>#</Text></View>
          <View style={styles.colName}><Text style={[styles.headerCell, styles.cellLeft]}>Player</Text></View>
          <View style={styles.colNum}><Text style={[styles.headerCell, styles.cellCenter]}>⚽</Text></View>
          <View style={styles.colNum}><Text style={[styles.headerCell, styles.cellCenter]}>🏠</Text></View>
          <View style={styles.colNum}><Text style={[styles.headerCell, styles.cellCenter]}>🏆</Text></View>
          <View style={styles.colNum}><Text style={[styles.headerCell, styles.cellCenter]}>⚠️</Text></View>
          <View style={styles.colTotal}><Text style={[styles.headerCell, styles.cellCenter]}>Pts</Text></View>
        </View>

        <FlatList
          data={sortedStandings}
          keyExtractor={(item) => item.user_id.toString()}
          renderItem={renderTableRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          style={styles.tableBody}
          contentContainerStyle={styles.tableBodyContent}
          showsVerticalScrollIndicator={true}
        />
      </View>
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 2,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 1,
  },
  leagueInfo: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 8,
    padding: 8,
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
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inviteCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace',
    marginRight: 6,
  },
  copyText: {
    fontSize: 11,
    color: '#666',
  },
  tableWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sortRowContainer: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  sortRow: {
    flexGrow: 0,
  },
  sortRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 28,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c3e50',
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#2c3e50',
    borderColor: '#2c3e50',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#2c3e50',
    paddingHorizontal: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  tableBody: {
    flex: 1,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tableBodyContent: {
    paddingBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  colRank: {
    width: 32,
  },
  colName: {
    flex: 1,
    minWidth: 60,
  },
  colNum: {
    width: 28,
  },
  colTotal: {
    width: 38,
  },
  cellText: {
    fontSize: 12,
    color: '#333',
  },
  cellTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  cellCenter: {
    textAlign: 'center',
  },
  cellLeft: {
    textAlign: 'left',
  },
  cellBold: {
    fontWeight: 'bold',
  },
  cellPenalty: {
    color: '#D32F2F',
    fontWeight: '600',
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
