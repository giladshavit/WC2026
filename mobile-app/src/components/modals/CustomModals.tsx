import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// ─── Fine Confirmation Modal ─────────────────────────────────────────────

interface FineModalProps {
  visible: boolean;
  finePoints: number;
  onConfirm: () => void;
  onCancel: () => void;
  /** Groups/ThirdPlace: free changes info. When provided, uses free-changes messaging. */
  freeChangesInfo?: {
    totalChanges: number;
    freeAvailable: number;
    paidChanges: number;
    freeUsed: number;
    penalty: number;
  };
}

export function FineConfirmationModal({ visible, finePoints, onConfirm, onCancel, freeChangesInfo }: FineModalProps) {
  if (freeChangesInfo) {
    const { totalChanges, freeAvailable, freeUsed, paidChanges, penalty } = freeChangesInfo;
    const freeRemaining = freeAvailable - freeUsed;

    // Free-only variant: penalty === 0 AND freeUsed > 0
    if (penalty === 0 && freeUsed > 0) {
      return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
            <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
              <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="gift-outline" size={32} color="#4ade80" />
              </View>
              <Text style={styles.title}>Confirm Save</Text>
              <View style={styles.statBoxesRow}>
                <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fca5a5' }]}>
                  <Text style={[styles.statBoxNumber, { color: '#dc2626' }]}>{freeUsed}</Text>
                  <Text style={styles.statBoxLabel}>changes made</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1.5, borderColor: '#4ade80' }]}>
                  <Text style={[styles.statBoxNumber, { color: '#16a34a' }]}>{freeRemaining}</Text>
                  <Text style={styles.statBoxLabel}>free remaining</Text>
                </View>
              </View>
              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#15803d' }]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>Save for Free</Text>
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

    // Penalty + free variant: penalty > 0 AND freeUsed > 0
    if (penalty > 0 && freeUsed > 0) {
      return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
            <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
              <Text style={styles.title}>Confirm Save</Text>
              {/* ROW 1: Two boxes side by side */}
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 }}>
                {/* Box 1: Free used - left */}
                <View style={{
                  flex: 1, alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.12)',
                  borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#4ade80'
                }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#16a34a' }}>
                    {freeUsed}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 }}>
                    free used
                  </Text>
                </View>
                {/* Box 2: Paid changes - right, more prominent */}
                <View style={{
                  flex: 1, alignItems: 'center', backgroundColor: '#fef2f2',
                  borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#fca5a5'
                }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#dc2626' }}>
                    {paidChanges}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 }}>
                    paid changes
                  </Text>
                </View>
              </View>
              {/* ROW 2: Fine amount - compact block */}
              <Text style={{
                fontSize: 10, fontWeight: '700', color: '#94a3b8',
                letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase'
              }}>
                FINE
              </Text>
              <View style={{
                width: '85%', alignSelf: 'center', alignItems: 'center', backgroundColor: '#fef2f2',
                borderRadius: 12, paddingVertical: 10, marginBottom: 24,
                borderWidth: 1.5, borderColor: '#fca5a5'
              }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#dc2626', letterSpacing: -1 }}>
                  -{penalty} pts
                </Text>
              </View>
              {/* Confirm button */}
              <TouchableOpacity
                style={{ backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 14,
                  width: '100%', alignItems: 'center', marginBottom: 10 }}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  Save (-{penalty} pts)
                </Text>
              </TouchableOpacity>
              {/* Cancel button */}
              <TouchableOpacity
                style={{ backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14,
                  width: '100%', alignItems: 'center' }}
                onPress={onCancel}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#64748b', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      );
    }

    // Paid-only case: freeUsed === 0, penalty > 0 — new prominent fine design
    if (penalty > 0 && freeUsed === 0) {
      return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
            <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
              <Text style={styles.title}>Confirm Save</Text>
              <View style={styles.fineBlock}>
                <Text style={styles.fineBlockLabel}>FINE</Text>
                <Text style={styles.fineBlockNumber}>-{penalty} pts</Text>
              </View>
              <Text style={styles.fineSubtext}>
                {totalChanges} changes will cost {penalty} pts
              </Text>
              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#dc2626' }]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>Save (-{penalty} pts)</Text>
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

    // Fallback: no penalty or edge case
    let message = `${totalChanges} changes.`;
    let confirmLabel = 'Save';
    let useGreenButton = true;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
          <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
            <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="save-outline" size={28} color="#16a34a" />
            </View>
            <Text style={styles.title}>Save Changes</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, useGreenButton ? styles.buttonPrimary : styles.buttonDestructive]}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>{confirmLabel}</Text>
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

  // Default flow (e.g. third place): existing English fine messaging
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="save-outline" size={28} color="#16a34a" />
          </View>

          <Text style={styles.title}>Save Prediction</Text>

          <Text style={styles.message}>Saving will apply a fine of</Text>

          <View style={styles.fineBadge}>
            <Text style={styles.fineNumber}>{finePoints}</Text>
            <Text style={styles.fineLabel}>{finePoints === 1 ? 'point' : 'points'}</Text>
          </View>

          <Text style={styles.subMessage}>Are you sure you want to save?</Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Save & Accept Fine</Text>
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

// ─── Leave League Modal ──────────────────────────────────────────────────────

interface LeaveLeagueModalProps {
  visible: boolean;
  leagueName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeaveLeagueModal({ visible, leagueName, onConfirm, onCancel }: LeaveLeagueModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="exit-outline" size={28} color="#ef4444" />
          </View>

          <Text style={styles.title}>Leave League</Text>
          <Text style={styles.message}>
            Are you sure you want to leave "{leagueName}"?
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonDestructive]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Leave</Text>
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

// ─── ErrorModal ─────────────────────────────────────────────────────────────

interface ErrorModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onGoBack?: () => void;
  goBackLabel?: string;
}

export function ErrorModal({
  visible,
  title = 'Something went wrong',
  message,
  onClose,
  onGoBack,
  goBackLabel = 'Go Back',
}: ErrorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="alert-circle-outline" size={28} color="#dc2626" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            {onGoBack ? (
              <>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#1e40af' }]}
                  onPress={onGoBack}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>{goBackLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonTextCancel}>Got it</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonTextCancel}>Got it</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── ConfirmationModal ──────────────────────────────────────────────────────

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const iconColor = destructive ? '#ef4444' : '#16a34a';
  const iconBg = destructive ? '#fee2e2' : '#dcfce7';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name="help-circle-outline" size={28} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, destructive ? styles.buttonDestructive : styles.buttonPrimary]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{confirmLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onCancel}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonTextCancel}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── ValidationModal ────────────────────────────────────────────────────────

interface ValidationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function ValidationModal({ visible, title, message, onClose }: ValidationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="warning-outline" size={28} color="#d97706" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
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

// ─── InfoModal ──────────────────────────────────────────────────────────────

interface InfoModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function InfoModal({ visible, title, message, onClose }: InfoModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="information-circle-outline" size={28} color="#2563eb" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
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

// ─── LockedMatchModal ──────────────────────────────────────────────────────

interface LockedMatchModalProps {
  visible: boolean;
  message?: string;
  onClose: () => void;
}

export function LockedMatchModal({ visible, message, onClose }: LockedMatchModalProps) {
  const displayMessage = message || "This match has already started.\nPredictions are no longer editable.";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name="lock-closed-outline" size={28} color="#64748b" />
          </View>
          <Text style={styles.title}>Match Locked</Text>
          <Text style={styles.message}>
            {displayMessage}
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
    marginBottom: 20,
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
  fineBlock: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    width: '85%',
    alignSelf: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  fineBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: 1,
    marginBottom: 4,
  },
  fineBlockNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#dc2626',
  },
  fineSubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  subMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
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
