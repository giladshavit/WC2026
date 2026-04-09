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
  finePoints: number;
  finePerChange: number;
  onClose: () => void;
  onConfirm: () => void;
  /** Knockout-specific: free changes info */
  freeChangesInfo?: {
    changesCount: number;
    freeAvailable: number;
    freeRemaining: number;
    paidChanges: number;
    freeUsed: number;
    actualPenalty: number;
  };
}

const { width: screenWidth } = Dimensions.get('window');

export default function ConfirmSaveModal({
  visible,
  changesCount,
  finePoints,
  finePerChange,
  onClose,
  onConfirm,
  freeChangesInfo,
}: ConfirmSaveModalProps) {
  if (freeChangesInfo) {
    const { changesCount, freeRemaining, paidChanges, actualPenalty, freeAvailable, freeUsed } = freeChangesInfo;

    // Case 4: No changes — keep existing behavior
    if (changesCount === 0) {
      const messageLines: string[] = ['Changes: 0'];
      if (freeAvailable > 0) messageLines.push(`Free: ${freeRemaining}`);
      messageLines.push('Free!');
      return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
          <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={styles.content} onPress={() => {}}>
              <View style={styles.iconContainer}>
                <Ionicons name="save-outline" size={32} color="#15803d" />
              </View>
              <Text style={styles.title}>Save Changes</Text>
              {messageLines.map((line, i) => (
                <Text key={i} style={[styles.subtitle, i === messageLines.length - 1 && { color: '#16a34a', fontWeight: '700' }]}>
                  {line}
                </Text>
              ))}
              <Pressable style={[styles.primaryButton, { backgroundColor: '#15803d' }]} onPress={onConfirm}>
                <Ionicons name="save-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Save free</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    // Case 3: All free (freeUsed > 0, actualPenalty === 0)
    if (actualPenalty === 0 && freeUsed > 0) {
      return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
          <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={styles.content} onPress={() => {}}>
              <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="gift-outline" size={32} color="#4ade80" />
              </View>
              <Text style={styles.title}>Confirm Save</Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 20 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#fca5a5' }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#dc2626' }}>{freeUsed}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>changes made</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#4ade80' }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#16a34a' }}>{freeRemaining}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>free remaining</Text>
                </View>
              </View>
              <Pressable style={[styles.primaryButton, { backgroundColor: '#15803d' }]} onPress={onConfirm}>
                <Text style={styles.primaryButtonText}>Save free</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    // Case 3b: No penalty but freeUsed === 0 (e.g. post bracket reset) — avoid "-0 pts"
    if (actualPenalty === 0 && freeUsed === 0 && changesCount > 0) {
      return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
          <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={styles.content} onPress={() => {}}>
              <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="gift-outline" size={32} color="#4ade80" />
              </View>
              <Text style={styles.title}>Confirm Save</Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 20 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#fca5a5' }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#dc2626' }}>{changesCount}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>changes made</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#4ade80' }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#16a34a' }}>{freeRemaining}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>free remaining</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>FINE</Text>
              <View style={{ width: '85%', alignSelf: 'center', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1.5, borderColor: '#86efac' }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#16a34a', letterSpacing: -1 }}>
                  Free
                </Text>
              </View>
              <Pressable style={[styles.primaryButton, { backgroundColor: '#15803d' }]} onPress={onConfirm}>
                <Text style={styles.primaryButtonText}>Save free</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    // Case 2: Mixed (freeUsed > 0, paidChanges > 0)
    if (actualPenalty > 0 && freeUsed > 0) {
      return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
          <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={styles.content} onPress={() => {}}>
              <Text style={styles.title}>Confirm Save</Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#4ade80' }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#16a34a' }}>{freeUsed}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>free used</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#fca5a5' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#dc2626' }}>{paidChanges}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>paid changes</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>FINE</Text>
              <View style={{ width: '85%', alignSelf: 'center', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1.5, borderColor: '#fca5a5' }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#dc2626', letterSpacing: -1 }}>
                  {actualPenalty === 0 ? 'Free' : `-${actualPenalty} pts`}
                </Text>
              </View>
              <Pressable style={[styles.primaryButton, { backgroundColor: '#dc2626' }]} onPress={onConfirm}>
                <Text style={styles.primaryButtonText}>
                  {actualPenalty === 0 ? 'Save free' : `Save (-${actualPenalty} pts)`}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    // Case 1: No free changes (freeUsed === 0, actualPenalty > 0)
    return (
      <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.content} onPress={() => {}}>
            <Text style={styles.title}>Confirm Save</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              FINE
            </Text>
            <View style={{ width: '85%', alignSelf: 'center', alignItems: 'center', backgroundColor: actualPenalty === 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1.5, borderColor: actualPenalty === 0 ? '#86efac' : '#fca5a5' }}>
              <Text style={{ fontSize: 36, fontWeight: '900', color: actualPenalty === 0 ? '#16a34a' : '#dc2626', letterSpacing: -1 }}>
                {actualPenalty === 0 ? 'Free' : `-${actualPenalty} pts`}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
              {actualPenalty === 0
                ? `${changesCount} changes — no fine`
                : `${changesCount} changes will cost ${actualPenalty} pts`}
            </Text>
            <Pressable style={[styles.primaryButton, { backgroundColor: actualPenalty === 0 ? '#15803d' : '#dc2626' }]} onPress={onConfirm}>
              <Text style={styles.primaryButtonText}>
                {actualPenalty === 0 ? 'Save free' : `Save (-${actualPenalty} pts)`}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

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

          {/* Fine display */}
          {finePoints > 0 ? (
            <>
              <Text style={styles.fineMessage}>Saving will apply a fine of</Text>
              <View style={styles.fineBadge}>
                <Text style={styles.fineNumber}>{finePoints}</Text>
                <Text style={styles.fineLabel}>
                  {finePoints === 1 ? 'point' : 'points'}
                </Text>
              </View>
              <Text style={styles.fineSubMessage}>Are you sure you want to save?</Text>
            </>
          ) : (
            <View style={styles.freeBadge}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#15803d" style={{ marginRight: 6 }} />
              <Text style={styles.freeText}>No fine points for this save</Text>
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
  fineMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  fineBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginVertical: 10,
    gap: 6,
  },
  fineNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#b45309',
  },
  fineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b45309',
  },
  fineSubMessage: {
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
  statBoxesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  statBox: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  statBoxNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
});
