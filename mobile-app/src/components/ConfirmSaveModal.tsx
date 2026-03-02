import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ConfirmSaveModalProps {
  visible: boolean;
  changesCount: number;
  penaltyPoints: number;
  penaltyPerChange: number;
  onClose: () => void;
  onConfirm: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function ConfirmSaveModal({
  visible,
  changesCount,
  penaltyPoints,
  penaltyPerChange,
  onClose,
  onConfirm,
}: ConfirmSaveModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={() => {}}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="save-outline" size={32} color="#15803d" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Save Changes</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            You're about to commit{' '}
            <Text style={styles.boldText}>
              {changesCount} change{changesCount !== 1 ? 's' : ''}
            </Text>
            {' '}to your bracket.
          </Text>

          {/* Penalty display */}
          {penaltyPoints > 0 ? (
            <>
              <Text style={styles.penaltyMessage}>Saving will apply a penalty of</Text>
              <View style={styles.penaltyBadge}>
                <Text style={styles.penaltyNumber}>{penaltyPoints}</Text>
                <Text style={styles.penaltyLabel}>
                  {penaltyPoints === 1 ? 'point' : 'points'}
                </Text>
              </View>
              <Text style={styles.penaltySubMessage}>Are you sure you want to save?</Text>
            </>
          ) : (
            <View style={styles.freeBadge}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#15803d" style={{ marginRight: 6 }} />
              <Text style={styles.freeText}>No penalty points for this save</Text>
            </View>
          )}

          {/* Primary button */}
          <Pressable
            style={styles.primaryButton}
            onPress={onConfirm}
          >
            <Ionicons name="save-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Save & Commit</Text>
          </Pressable>

          {/* Secondary button */}
          <Pressable
            style={styles.secondaryButton}
            onPress={onClose}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: screenWidth - 48,
    maxWidth: 360,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: '#374151',
  },
  penaltyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  penaltyBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginVertical: 10,
    gap: 6,
  },
  penaltyNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#b45309',
  },
  penaltyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b45309',
  },
  penaltySubMessage: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  freeText: {
    fontSize: 13,
    color: '#15803d',
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    width: '100%',
    height: 50,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
