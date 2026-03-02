import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ConfirmResetModalProps {
  visible: boolean;
  changesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmResetModal({
  visible, changesCount, onClose, onConfirm
}: ConfirmResetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>

          <View style={styles.iconContainer}>
            <Ionicons name="refresh-outline" size={32} color="#dc2626" />
          </View>

          <Text style={styles.title}>Reset Changes</Text>

          <Text style={styles.subtitle}>
            This will discard{' '}
            <Text style={styles.boldText}>
              {changesCount} change{changesCount !== 1 ? 's' : ''}
            </Text>
            {' '}and restore your bracket to the last saved state.
            {'\n'}This cannot be undone.
          </Text>

          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={styles.warningText}>
              All unsaved predictions will be lost
            </Text>
          </View>

          <TouchableOpacity style={styles.destructiveButton} onPress={onConfirm}>
            <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.destructiveButtonText}>Reset All Changes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: '#374151',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
    flex: 1,
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
    width: '100%',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  destructiveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
