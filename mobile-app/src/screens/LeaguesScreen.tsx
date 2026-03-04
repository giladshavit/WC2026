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
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService, League } from '../services/api';

const AVATAR_COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function LeaguesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLeagueId, setCopiedLeagueId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  useFocusEffect(
    React.useCallback(() => {
      fetchLeagues();
      const params = (route.params as { showToast?: string }) || {};
      if (params.showToast) {
        setToastMsg(params.showToast);
        (navigation as any).setParams({ showToast: undefined });
      }
    }, [route.params])
  );

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 1500);
    return () => clearTimeout(t);
  }, [toastMsg]);

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

  const handleCopyInviteCode = async (e: any, league: League) => {
    e.stopPropagation();
    if (league.invite_code) {
      await Clipboard.setStringAsync(league.invite_code);
      setCopiedLeagueId(league.id);
      setTimeout(() => setCopiedLeagueId(null), 2000);
    }
  };

  const renderLeagueItem = ({ item, index }: { item: League; index: number }) => {
    const leagueWithRank = item as League & { user_rank?: number };
    return (
    <TouchableOpacity
      style={styles.leagueCard}
      onPress={() => handleLeaguePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.leagueCardTop}>
        <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % 5] }]}>
          <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.leagueCardCenter}>
          <Text style={styles.leagueName}>{item.name}</Text>
          <View style={styles.memberRow}>
            <Ionicons name="people-outline" size={14} color="#64748b" />
            <Text style={styles.memberCount}>{item.member_count} members</Text>
          </View>
        </View>
        <View style={styles.leagueCardRight}>
          {leagueWithRank.user_rank != null && (
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>#{leagueWithRank.user_rank}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </View>
      <View style={styles.leagueCardBottom}>
        <TouchableOpacity
          style={styles.inviteRow}
          onPress={(e) => handleCopyInviteCode(e, item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="lock-closed-outline" size={12} color="#9ca3af" />
          <Text style={styles.inviteCodeLabel}>Code:</Text>
          <Text style={styles.inviteCode}>{item.invite_code}</Text>
          {copiedLeagueId === item.id ? (
            <Text style={styles.copiedText}>Copied!</Text>
          ) : null}
        </TouchableOpacity>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748b" />
          <Text style={styles.joinedDate}>
            {new Date(item.joined_at || item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
  };

  const renderGlobalLeague = () => (
    <TouchableOpacity
      style={styles.globalLeagueCard}
      onPress={handleGlobalLeague}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#16a34a', '#15803d']}
        style={styles.globalLeagueGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="globe-outline" size={32} color="#ffffff" style={styles.globalTrophy} />
        <View style={styles.globalLeagueContent}>
          <Text style={styles.globalLeagueTitle}>Global League</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ffffff" />
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <>
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIconCircle}>
          <Ionicons name="people-outline" size={60} color="#86efac" />
        </View>
        <Text style={styles.emptyTitle}>No private leagues yet</Text>
        <Text style={styles.emptySubtitle}>
          Create your own or join friends with an invite code
        </Text>
      </View>
      <View style={styles.inlineButtonsWrapper}>
        {renderButtons(true)}
      </View>
    </>
  );

  const renderButtons = (inline: boolean) => (
    <View style={inline ? styles.inlineButtons : styles.bottomButtons}>
      <TouchableOpacity
        style={[styles.emptyButton, styles.emptyButtonCreate]}
        onPress={handleCreateLeague}
        activeOpacity={0.7}
      >
        <Text style={[styles.emptyButtonText, styles.emptyButtonCreateText]}>+ Create League</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={handleJoinLeague}
        activeOpacity={0.7}
      >
        <Text style={styles.emptyButtonText}>Enter Code</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFixedBottomBar = () => (
    <View style={styles.bottomBarContainer}>
      {renderButtons(false)}
    </View>
  );

  const renderLoadingSkeletons = () => (
    <View style={styles.skeletonContainer}>
      <View style={[styles.skeleton, styles.skeletonTall]} />
      <View style={styles.skeleton} />
      <View style={styles.skeleton} />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leagues</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.waveSvgContainer}>
        <Svg
          height="28"
          width="100%"
          viewBox="0 0 390 28"
          preserveAspectRatio="none"
        >
          <Path
            d="M0,0 C97.5,28 292.5,28 390,0 L390,0 L0,0 Z"
            fill="#f1f5f9"
          />
        </Svg>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.mainContent}>
          <View style={styles.contentArea}>
            {renderLoadingSkeletons()}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      <View style={styles.mainContent}>
        <FlatList
          style={styles.list}
          data={leagues}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderLeagueItem}
          ListHeaderComponent={
            <>
              {renderGlobalLeague()}
              {leagues.length === 0 && renderEmptyState()}
            </>
          }
          ListEmptyComponent={null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={[
            styles.listContainer,
            leagues.length > 0 && styles.listContainerWithBottomBar,
          ]}
          showsVerticalScrollIndicator={false}
        />
        {leagues.length > 0 && renderFixedBottomBar()}
      </View>
      {toastMsg && (
        <View style={styles.toast} pointerEvents="none">
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerWrapper: {
    backgroundColor: '#16a34a',
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  waveSvgContainer: {
    position: 'absolute',
    bottom: -28,
    left: 0,
    right: 0,
    height: 28,
  },
  mainContent: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: '#f1f5f9',
  },
  list: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },
  listContainerWithBottomBar: {
    paddingBottom: 100,
  },
  globalLeagueCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  globalLeagueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    minHeight: 100,
  },
  globalTrophy: {
    marginRight: 16,
  },
  globalLeagueContent: {
    flex: 1,
  },
  globalLeagueTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  leagueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leagueCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  leagueCardCenter: {
    flex: 1,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberCount: {
    fontSize: 13,
    color: '#64748b',
  },
  leagueCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankPill: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rankPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  leagueCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteCodeLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  inviteCode: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  copiedText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginLeft: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinedDate: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
    justifyContent: 'center',
  },
  inlineButtonsWrapper: {
    paddingTop: 16,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#16a34a',
    alignItems: 'center',
  },
  emptyButtonCreate: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  emptyButtonCreateText: {
    color: '#ffffff',
  },
  skeletonContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  skeleton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 80,
    marginBottom: 12,
  },
  skeletonTall: {
    height: 100,
    marginBottom: 16,
  },
  toast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toastContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
});
