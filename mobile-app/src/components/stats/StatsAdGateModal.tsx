import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useStatsAccess } from '../../hooks/useStatsAccess';
import { useToast } from '../toast/Toast';
import { showRewardedAd } from '../../services/adService';

export interface StatsAdGateModalProps {
  visible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export default function StatsAdGateModal({
  visible,
  onClose,
  onUnlocked,
}: StatsAdGateModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { adsEnabled, onAdCompleted } = useStatsAccess();
  const [loading, setLoading] = useState(false);
  const isRTL = I18nManager.isRTL;
  const textAlign = isRTL ? 'right' : 'left';

  const handleWatchAd = async () => {
    if (!adsEnabled) {
      onAdCompleted();
      showToast(t('statsAds.adSimulated'), 'success');
      onUnlocked();
      onClose();
      return;
    }

    try {
      setLoading(true);
      await showRewardedAd(() => {
        onAdCompleted();
      });
      // Only reaches here if ad was watched fully
      onUnlocked();
      onClose();
    } catch (error: any) {
      if (error?.message !== 'USER_CANCELED') {
        showToast('Could not load ad. Please try again.', 'error');
      }
      // USER_CANCELED: popup stays open silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.modalContent, { direction: isRTL ? 'rtl' : 'ltr' }]}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="play-circle-outline" size={48} color="#38bdf8" />
          </View>

          <Text style={[styles.title, { textAlign: isRTL ? 'center' : 'center' }]}>
            {t('statsAds.title')}
          </Text>

          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            {t('statsAds.subtitle')}
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleWatchAd}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.primaryButtonText, { writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {t('statsAds.watchAd')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={[styles.ghostButtonText, { writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                {t('statsAds.maybeLater')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 58, 95, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: '85%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 10,
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 24,
    width: '100%',
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0284c7',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  ghostButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
