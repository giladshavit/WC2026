import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService, League } from '../../services/api';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal } from '../../components/modals/CustomModals';

const AVATAR_COLORS = ['#2563eb', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function LeaguesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLeagueId, setCopiedLeagueId] = useState<number | null>(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    goBack?: boolean;
  } | null>(null);

  const fetchLeagues = async () => {
    try {
      const userLeagues = await apiService.getUserLeagues();
      setLeagues(userLeagues);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      setErrorModal({ title: 'Failed to Load', message: 'Could not load leagues. Please try again.', goBack: true });
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
        showToast(params.showToast, 'success');
        (navigation as any).setParams({ showToast: undefined });
      }
    }, [route.params, showToast])
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
            <Ionicons name="people-outline" size={14} color="#94a3b8" />
            <Text style={styles.memberCount}>{item.member_count} members</Text>
          </View>
        </View>
        <View style={styles.leagueCardRight}>
          {leagueWithRank.user_rank != null && (
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>#{leagueWithRank.user_rank}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </View>
      </View>
      <View style={styles.leagueCardBottom}>
        <TouchableOpacity
          style={styles.inviteRow}
          onPress={(e) => handleCopyInviteCode(e, item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="lock-closed-outline" size={12} color="#64748b" />
          <Text style={styles.inviteCodeLabel}>Code:</Text>
          <Text style={styles.inviteCode}>{item.invite_code}</Text>
          {copiedLeagueId === item.id ? (
            <Text style={styles.copiedText}>Copied!</Text>
          ) : null}
        </TouchableOpacity>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
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
        colors={['#2563eb', '#1e40af']}
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
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIconCircle}>
        <Ionicons name="people-outline" size={60} color="#64748b" />
      </View>
      <Text style={styles.emptyTitle}>No private leagues yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your own or join friends with an invite code
      </Text>
    </View>
  );

  const renderButtons = () => (
    <View style={styles.bottomButtons}>
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
      {renderButtons()}
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
            fill="#1e293b"
          />
        </Svg>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.statusBarFill}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <SafeAreaView style={styles.container} edges={['top']}>
          {renderHeader()}
        <View style={styles.mainContent}>
          <View style={styles.contentArea}>
            {renderLoadingSkeletons()}
          </View>
        </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.statusBarFill}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
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
            styles.listContainerWithBottomBar,
          ]}
          showsVerticalScrollIndicator={false}
        />
        {renderFixedBottomBar()}
      </View>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title}
          message={errorModal?.message ?? ''}
          onClose={() => {
            setErrorModal(null);
            if (errorModal?.goBack) navigation.goBack();
          }}
          onGoBack={errorModal?.goBack ? () => {
            setErrorModal(null);
            navigation.goBack();
          } : undefined}
          goBackLabel="Go Back"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBarFill: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerWrapper: {
    backgroundColor: '#1e293b',
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
    backgroundColor: '#1e293b',
  },
  list: {
    flex: 1,
    backgroundColor: '#1e293b',
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
    shadowColor: '#2563eb',
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
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#2d4a6e',
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
    color: '#f1f5f9',
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  leagueCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankPill: {
    backgroundColor: '#2563eb',
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
    color: '#94a3b8',
  },
  inviteCode: {
    fontSize: 13,
    color: '#cbd5e1',
    fontFamily: 'monospace',
  },
  copiedText: {
    fontSize: 12,
    color: '#2563eb',
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
    color: '#94a3b8',
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
    backgroundColor: 'rgba(51,65,85,0.6)',
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
    justifyContent: 'center',
  },
  emptyButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2563eb',
    alignItems: 'center',
  },
  emptyButtonCreate: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#93c5fd',
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
});
