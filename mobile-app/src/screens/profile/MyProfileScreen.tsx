import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { useToast } from '../../components/toast/Toast';
import { ConfirmationModal } from '../../components/modals/CustomModals';

export default function MyProfileScreen() {
  const { user, logout, getCurrentUserId } = useAuth();
  const { showToast } = useToast();
  const [signOutModal, setSignOutModal] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number>(user?.total_points ?? 0);
  const [pointsLoading, setPointsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchPoints = async () => {
        const userId = getCurrentUserId();
        if (!userId) {
          setPointsLoading(false);
          return;
        }
        try {
          setPointsLoading(true);
          const data = await apiService.getUserFullProfile(userId);
          setTotalPoints(data.total_points);
        } catch (error) {
          console.error('Error fetching profile:', error);
          showToast('Could not load profile data', 'error');
        } finally {
          setPointsLoading(false);
        }
      };
      fetchPoints();
    }, [getCurrentUserId])
  );

  const handleLogout = () => {
    setSignOutModal(true);
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView style={styles.container}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Green header with avatar */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.name ?? '—'}</Text>
        </View>

        {/* Points card */}
        <View style={styles.pointsCard}>
          {pointsLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={styles.pointsLoader} />
          ) : (
            <Text style={styles.pointsValue}>{totalPoints}</Text>
          )}
          <Text style={styles.pointsLabel}>Total Points</Text>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#16a34a" />
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{user?.username ?? '—'}</Text>
          </View>
          <View style={styles.infoSeparator} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color="#16a34a" />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
          </View>
          <View style={styles.infoSeparator} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#16a34a" />
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </Text>
          </View>
        </View>

        {/* Logout button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        </ScrollView>
      <ConfirmationModal
        visible={signOutModal}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          setSignOutModal(false);
          logout();
        }}
        onCancel={() => setSignOutModal(false)}
      />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  header: {
    backgroundColor: '#1e293b',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  pointsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  pointsLoader: {
    marginBottom: 2,
  },
  pointsValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#16a34a',
    marginBottom: 2,
  },
  pointsLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
  },
  infoSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 42,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
});
