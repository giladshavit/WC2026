import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IS_RTL } from '../../utils/rtl';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { useToast } from '../../components/toast/Toast';
import { ConfirmationModal } from '../../components/modals/CustomModals';

const SHARE_URL = 'https://getpredicto.com/download';

export default function MyProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, logout, getCurrentUserId } = useAuth();
  const { showToast } = useToast();
  const [signOutModal, setSignOutModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible((v) => !v)}
          style={{ paddingRight: 16, paddingVertical: 8 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Profile menu"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#94a3b8" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleLogout = () => {
    setSignOutModal(true);
  };

  const handleDeleteAccount = async () => {
    try {
      await apiService.deleteAccount();
      await logout();
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleShareApp = async () => {
    await Share.share({
      message: t('profile.shareAppMessage', { url: SHARE_URL }),
    });
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
              <Text style={styles.avatarText} maxFontSizeMultiplier={1.3}>
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>
          <Text style={styles.name} maxFontSizeMultiplier={1.3}>{user?.name ?? '—'}</Text>
        </View>

        {/* Points card */}
        <View style={styles.pointsCard}>
          {pointsLoading ? (
            <ActivityIndicator size="small" color="#16a34a" style={styles.pointsLoader} />
          ) : (
            <Text style={styles.pointsValue} maxFontSizeMultiplier={1.3}>{totalPoints}</Text>
          )}
          <Text style={styles.pointsLabel} maxFontSizeMultiplier={1.3}>{t('profile.totalPoints')}</Text>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#16a34a" />
            <Text style={[styles.infoLabel, { textAlign: IS_RTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.3}>{t('profile.username')}</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{user?.username ?? '—'}</Text>
          </View>
          {user?.email && !user.email.endsWith('@privaterelay.appleid.com') ? (
            <>
              <View style={styles.infoSeparator} />
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={18} color="#16a34a" />
                <Text style={[styles.infoLabel, { textAlign: IS_RTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.0}>{t('profile.email')}</Text>
                <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit maxFontSizeMultiplier={1.0}>{user.email}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.infoSeparator} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#16a34a" />
            <Text style={[styles.infoLabel, { textAlign: IS_RTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.3}>{t('profile.memberSince')}</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
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

        <TouchableOpacity
          style={styles.shareAppButton}
          onPress={handleShareApp}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('profile.shareApp')}
        >
          <Text style={styles.shareAppButtonText} maxFontSizeMultiplier={1.3}>
            {t('profile.shareApp')}
          </Text>
          <Ionicons name="share-outline" size={18} color="#22d3ee" />
        </TouchableOpacity>

        {/* Logout button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          {IS_RTL ? (
            <>
              <Text style={styles.logoutText} maxFontSizeMultiplier={1.3}>{t('profile.signOut')}</Text>
              <Ionicons name="log-in-outline" size={18} color="#ef4444" />
            </>
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutText} maxFontSizeMultiplier={1.3}>{t('profile.signOut')}</Text>
            </>
          )}
        </TouchableOpacity>
        </ScrollView>
      <ConfirmationModal
        visible={signOutModal}
        title={t('profile.signOutModal.title')}
        message={t('profile.signOutModal.message')}
        confirmLabel={t('profile.signOutModal.confirm')}
        cancelLabel={t('common.cancel')}
        destructive={true}
        onConfirm={() => {
          setSignOutModal(false);
          logout();
        }}
        onCancel={() => setSignOutModal(false)}
      />
      {menuVisible && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        />
      )}
      {menuVisible && (
        <View style={styles.menuDropdownFloating}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuVisible(false);
              setDeleteModal(true);
            }}
          >
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={styles.menuItemText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <ConfirmationModal
        visible={deleteModal}
        title={t('profile.deleteModal.title')}
        message={t('profile.deleteModal.message')}
        confirmLabel={t('profile.deleteModal.confirm')}
        cancelLabel={t('common.cancel')}
        destructive={true}
        onConfirm={() => {
          setDeleteModal(false);
          handleDeleteAccount();
        }}
        onCancel={() => setDeleteModal(false)}
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
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  menuDropdownFloating: {
    position: 'absolute',
    right: 16,
    top: 8,
    zIndex: 101,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 2,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 11,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
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
    flexShrink: 0,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoValueSpacer: {
    flex: 1,
  },
  shareAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(224, 242, 254, 0.08)',
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 253, 0.3)',
  },
  shareAppButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22d3ee',
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
