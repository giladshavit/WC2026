import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ActivityIndicator, RefreshControl,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, UserFullProfile } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'matches' | 'bracket';

export default function StatisticsScreen() {
  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const { getCurrentUserId } = useAuth();

  const fetchProfile = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const data = await apiService.getUserFullProfile(userId);
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCurrentUserId]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No statistics available yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderBar = (segments: Array<{ value: number; color: string }>) => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return null;
    return (
      <View style={styles.barContainer}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <View key={i} style={[styles.barSegment, { flex: s.value, backgroundColor: s.color }]}>
            <Text style={styles.barText}>{s.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRow = (color: string, label: string, value: string | number) => (
    <View style={styles.statsRow}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  const renderMatchesTab = () => {
    const { matches } = profile;
    return (
      <View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Match Predictions</Text>
            <Text style={styles.cardScore}>{matches.score} pts</Text>
          </View>
          <Text style={styles.judgedText}>
            {matches.total_judged} judged{matches.pending > 0 ? ` • ${matches.pending} pending` : ''}
          </Text>
          {matches.total_judged > 0 && (
            <>
              {renderBar([
                { value: matches.exact, color: '#4CAF50' },
                { value: matches.correct_outcome, color: '#FF9800' },
                { value: matches.wrong, color: '#F44336' },
              ])}
              {renderRow('#4CAF50', 'Exact Score', matches.exact)}
              {renderRow('#FF9800', 'Correct Outcome', matches.correct_outcome)}
              {renderRow('#F44336', 'Wrong', matches.wrong)}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderBracketTab = () => {
    const { groups, knockout } = profile;
    return (
      <View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Group Predictions</Text>
            <Text style={styles.cardScore}>{groups.score} pts</Text>
          </View>
          <Text style={styles.judgedText}>
            {groups.judged_groups}/{groups.total_groups} groups judged
          </Text>

          {groups.judged_groups > 0 && (
            <>
              {renderBar([
                { value: groups.accuracy_distribution['4'] || 0, color: '#4CAF50' },
                { value: groups.accuracy_distribution['3'] || 0, color: '#8BC34A' },
                { value: groups.accuracy_distribution['2'] || 0, color: '#FF9800' },
                { value: groups.accuracy_distribution['1'] || 0, color: '#FF5722' },
                { value: groups.accuracy_distribution['0'] || 0, color: '#F44336' },
              ])}
              {renderRow('#4CAF50', '4/4 positions', groups.accuracy_distribution['4'] || 0)}
              {renderRow('#8BC34A', '3/4 positions', groups.accuracy_distribution['3'] || 0)}
              {renderRow('#FF9800', '2/4 positions', groups.accuracy_distribution['2'] || 0)}
              {renderRow('#FF5722', '1/4 positions', groups.accuracy_distribution['1'] || 0)}
              {renderRow('#F44336', '0/4 positions', groups.accuracy_distribution['0'] || 0)}

              <Text style={styles.sectionSubtitle}>Position Accuracy</Text>
              {renderRow('#16a34a', '1st place', `${groups.position_totals.first}/${groups.judged_groups}`)}
              {renderRow('#16a34a', '2nd place', `${groups.position_totals.second}/${groups.judged_groups}`)}
              {renderRow('#16a34a', '3rd place', `${groups.position_totals.third}/${groups.judged_groups}`)}
              {renderRow('#9ca3af', '4th place', `${groups.position_totals.fourth}/${groups.judged_groups}`)}
            </>
          )}
        </View>

        {groups.judged_groups > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Per Group</Text>
            {groups.per_group.filter(g => g.correct_positions_count !== null).map((g) => (
              <View key={g.group_id} style={styles.groupRow}>
                <Text style={styles.groupName}>{g.group_name}</Text>
                <View style={styles.groupRight}>
                  <Text style={[styles.groupPositions, { marginRight: 12 }]}>{g.correct_positions_count}/4</Text>
                  <Text style={styles.groupPoints}>{g.points} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Knockout Predictions</Text>
            <Text style={styles.cardScore}>{knockout.score} pts</Text>
          </View>

          {(() => {
            const judged = knockout.correct_full + knockout.correct_partial + knockout.incorrect;
            const preResult = knockout.valid + knockout.invalid + knockout.unreachable;
            return (
              <>
                <Text style={styles.judgedText}>
                  {judged} judged{preResult > 0 ? ` • ${preResult} pending` : ''}
                </Text>

                {judged > 0 && (
                  <>
                    {renderBar([
                      { value: knockout.correct_full, color: '#4CAF50' },
                      { value: knockout.correct_partial, color: '#FF9800' },
                      { value: knockout.incorrect, color: '#F44336' },
                    ])}
                    {renderRow('#4CAF50', 'Correct (full points)', knockout.correct_full)}
                    {renderRow('#FF9800', 'Correct (partial)', knockout.correct_partial)}
                    {renderRow('#F44336', 'Incorrect', knockout.incorrect)}
                  </>
                )}

                {preResult > 0 && (
                  <>
                    <Text style={styles.sectionSubtitle}>Pending Predictions</Text>
                    {renderRow('#4CAF50', 'Valid', knockout.valid)}
                    {knockout.invalid > 0 && renderRow('#F44336', 'Need attention', knockout.invalid)}
                    {knockout.unreachable > 0 && renderRow('#FF9800', 'Unreachable path', knockout.unreachable)}
                  </>
                )}
              </>
            );
          })()}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchProfile(); }}
            tintColor="#16a34a"
          />
        }
      >
        <View style={styles.pointsCard}>
          <Text style={styles.pointsValue}>{profile.total_points}</Text>
          <Text style={styles.pointsLabel}>Total Points</Text>
          {profile.penalty > 0 && (
            <Text style={styles.penaltyText}>-{profile.penalty} penalty</Text>
          )}
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
              Matches
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bracket' && styles.tabActive]}
            onPress={() => setActiveTab('bracket')}
          >
            <Text style={[styles.tabText, activeTab === 'bracket' && styles.tabTextActive]}>
              Bracket
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'matches' ? renderMatchesTab() : renderBracketTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f4f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  emptyText: { fontSize: 16, color: '#9ca3af' },

  pointsCard: {
    backgroundColor: '#16a34a', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  pointsValue: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  pointsLabel: { fontSize: 14, color: '#d1fae5', marginTop: 4 },
  penaltyText: { fontSize: 12, color: '#fecaca', marginTop: 4 },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12,
    padding: 4, marginBottom: 16,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#16a34a' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  cardScore: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
  judgedText: { fontSize: 13, color: '#9ca3af', marginBottom: 12 },
  sectionSubtitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 12, marginBottom: 6 },

  barContainer: {
    flexDirection: 'row', height: 32, borderRadius: 10, overflow: 'hidden', marginBottom: 16,
  },
  barSegment: { justifyContent: 'center', alignItems: 'center', minWidth: 24 },
  barText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  statDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statLabel: { flex: 1, fontSize: 14, color: '#374151' },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },

  groupRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  groupName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  groupRight: { flexDirection: 'row', alignItems: 'center' },
  groupPositions: { fontSize: 14, color: '#6b7280' },
  groupPoints: { fontSize: 14, fontWeight: 'bold', color: '#16a34a', minWidth: 45, textAlign: 'right' },
});
