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

interface EnterEditModeModalProps {
  visible: boolean;
  onClose: () => void;
  onEnterEditMode: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function EnterEditModeModal({
  visible,
  onClose,
  onEnterEditMode,
}: EnterEditModeModalProps) {
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
            <Ionicons name="create-outline" size={32} color="#0f766e" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Enter Edit Mode</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            To make changes to your bracket, switch to Edit Mode. Note that saving changes will apply fine points.
          </Text>

          {/* Primary button */}
          <Pressable
            style={styles.primaryButton}
            onPress={onEnterEditMode}
          >
            <Ionicons name="create-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Enter Edit Mode</Text>
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
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
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
