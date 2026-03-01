import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// ─── Penalty Confirmation Modal ─────────────────────────────────────────────

interface PenaltyModalProps {
  visible: boolean;
  penaltyPoints: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PenaltyConfirmationModal({ visible, penaltyPoints, onConfirm, onCancel }: PenaltyModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="save-outline" size={28} color="#16a34a" />
          </View>

          <Text style={styles.title}>Save Prediction</Text>

          <Text style={styles.message}>Saving will apply a penalty of</Text>

          <View style={styles.penaltyBadge}>
            <Text style={styles.penaltyNumber}>{penaltyPoints}</Text>
            <Text style={styles.penaltyLabel}>{penaltyPoints === 1 ? 'point' : 'points'}</Text>
          </View>

          <Text style={styles.subMessage}>Are you sure you want to save?</Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Save & Accept Penalty</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onCancel}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Unsaved Changes Exit Modal ──────────────────────────────────────────────

interface ExitModalProps {
  visible: boolean;
  onDiscard: () => void;
  onStay: () => void;
}

export function UnsavedChangesModal({ visible, onDiscard, onStay }: ExitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onStay}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="exit-outline" size={28} color="#ef4444" />
          </View>

          <Text style={styles.title}>Unsaved Changes</Text>
          <Text style={styles.message}>
            You have unsaved predictions.{'\n'}If you leave now, your changes will be lost.
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonDestructive]}
              onPress={onDiscard}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Leave Without Saving</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onStay}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonTextCancel}>Stay</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Maximum Reached Modal ───────────────────────────────────────────────────

interface MaximumReachedModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MaximumReachedModal({ visible, onClose }: MaximumReachedModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="checkmark-done-outline" size={28} color="#d97706" />
          </View>

          <Text style={styles.title}>Maximum Reached</Text>
          <Text style={styles.message}>
            You've already selected 8 teams.{'\n'}
            Remove a team first to add another.
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonTextCancel}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '82%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
  subMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
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
  buttonsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#16a34a',
  },
  buttonDestructive: {
    backgroundColor: '#ef4444',
  },
  buttonCancel: {
    backgroundColor: '#f1f5f9',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});
