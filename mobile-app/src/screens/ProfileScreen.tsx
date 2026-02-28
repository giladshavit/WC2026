import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  return (
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
          <Text style={styles.username}>@{user?.username ?? '—'}</Text>
        </View>

        {/* Points card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsValue}>{user?.total_points ?? 0}</Text>
          <Text style={styles.pointsLabel}>Total Points</Text>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#16a34a',
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
  username: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
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
