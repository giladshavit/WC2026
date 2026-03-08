import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ConfirmExitModalProps {
  visible: boolean;
  changesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmExitModal({
  visible, changesCount, onClose, onConfirm
}: ConfirmExitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>

          <View style={styles.iconContainer}>
            <Ionicons name="exit-outline" size={32} color="#d97706" />
          </View>

          <Text style={styles.title}>Exit Edit Mode?</Text>

          <View style={styles.warningBadge}>
            <Text style={styles.warningNumber}>{changesCount}</Text>
            <Text style={styles.warningLabel}>
              {changesCount === 1 ? 'change' : 'changes'} will be lost
            </Text>
          </View>

          <TouchableOpacity style={styles.destructiveButton} onPress={onConfirm}>
            <Ionicons name="exit-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.destructiveButtonText}>Exit Without Saving</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Stay & Keep Editing</Text>
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
    backgroundColor: '#fffbeb',
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
  warningBadge: {
    alignItems: 'center',
    marginVertical: 12,
  },
  warningNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#d97706',
    lineHeight: 52,
  },
  warningLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    marginTop: 2,
  },
  destructiveButton: {
    backgroundColor: '#d97706',
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
