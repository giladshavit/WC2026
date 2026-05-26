import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiService } from '../../services/api';
import { useToast } from '../../components/toast/Toast';
import { ErrorModal } from '../../components/modals/CustomModals';

type EditLeagueParams = {
  leagueId: number;
  leagueName: string;
  scoreMode: 'multi' | 'classic';
  simpleBonus: boolean;
  isOwner: boolean;
};

export default function EditLeagueScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { showToast } = useToast();
  const params = route.params as EditLeagueParams;
  const [name, setName] = useState(params.leagueName ?? '');
  const [scoreMode, setScoreMode] = useState<'multi' | 'classic'>(params.scoreMode ?? 'multi');
  const [simpleBonus, setSimpleBonus] = useState(params.simpleBonus ?? false);
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [openTooltip, setOpenTooltip] = useState<'mode' | 'bonus' | null>(null);

  const handleUpdateLeague = async () => {
    setNameError(null);
    if (!name.trim()) { setNameError(t('editLeague.errorRequired')); return; }
    if (name.trim().length < 3) { setNameError(t('editLeague.errorTooShort')); return; }
    if (name.trim().length > 100) { setNameError(t('editLeague.errorTooLong')); return; }

    setLoading(true);
    try {
      await apiService.updateLeague(params.leagueId, {
        name: name.trim(),
        score_mode: scoreMode,
        simple_bonus: scoreMode === 'classic' ? simpleBonus : false,
      });
      showToast(t('editLeague.successToast'), 'success');
      (navigation as any).navigate('LeagueDetails', {
        leagueId: params.leagueId,
        leagueUpdated: Date.now(),
        updatedName: name.trim(),
      });
    } catch (error: any) {
      const status = error?.httpStatus ?? 0;
      let msg = t('editLeague.errorGeneric');
      if (status === 403) msg = t('editLeague.errorNotOwner');
      else if (status === 404) msg = t('editLeague.errorNotFound');
      else if (status === 404 || status === 405) msg = t('editLeague.serverNotReady');
      setErrorModal({ title: t('editLeague.errorTitle'), message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!params.isOwner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94a3b8', textAlign: 'center', paddingHorizontal: 24 }}>
            {t('editLeague.errorNotOwner')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, direction: 'ltr' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <SafeAreaView
        style={styles.container}
        edges={['bottom']}
        onStartShouldSetResponderCapture={() => {
          if (openTooltip !== null) { setOpenTooltip(null); return false; }
          return false;
        }}
      >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.keyboardAvoidingView, openTooltip !== null && { zIndex: 100, elevation: 12 }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => setOpenTooltip(null)}
        >
          <View style={styles.formCard}>
            {openTooltip !== null && (
              <View pointerEvents="box-only" style={StyleSheet.absoluteFillObject}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={() => setOpenTooltip(null)}
                />
              </View>
            )}
            <Text style={styles.label} maxFontSizeMultiplier={1.2}>
              {t('editLeague.screenTitle')}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.2}>{t('editLeague.leagueName')}</Text>
              <TextInput
                style={[styles.input, nameFocused && styles.inputFocused]}
                value={name}
                onChangeText={(text) => { setName(text); setNameError(null); }}
                placeholder={t('editLeague.leagueNamePlaceholder')}
                placeholderTextColor="#64748b"
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <View style={styles.inputFooterRow}>
                <Text style={[styles.fieldError, !nameError && styles.fieldErrorHidden]}>
                  {nameError ?? ' '}
                </Text>
                <Text style={styles.characterCount}>{name.length}/100</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.tooltipLabelWrap}>
                <View style={styles.tooltipLabelRow}>
                  <Text style={[styles.label, { marginBottom: 0, marginLeft: 0 }]} maxFontSizeMultiplier={1.2}>{t('editLeague.defaultViewMode')}</Text>
                  <TouchableOpacity
                    onPress={() => setOpenTooltip((prev) => (prev === 'mode' ? null : 'mode'))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="help-circle-outline" size={17} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                {openTooltip === 'mode' && (
                  <View style={styles.tooltipBubble}>
                    <View>
                      <Text style={{ color: '#38bdf8', fontWeight: '700' }}>{t('editLeague.classic')}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        {t('editLeague.classicDesc')}
                      </Text>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: '#f59e0b', fontWeight: '700' }}>{t('editLeague.multi')}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        {t('editLeague.multiDesc')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    scoreMode === 'multi'
                      ? { backgroundColor: 'rgba(251,191,36,0.18)', borderColor: '#f59e0b' }
                      : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                  ]}
                  onPress={() => {
                    setScoreMode('multi');
                    setSimpleBonus(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trophy-outline" size={14} color={scoreMode === 'multi' ? '#f59e0b' : '#64748b'} />
                  <Text
                    style={[styles.modeBtnText, scoreMode === 'multi' ? { color: '#f59e0b', fontWeight: '700' } : {}]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    {t('editLeague.multiMode')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    scoreMode === 'classic'
                      ? { backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8' }
                      : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                  ]}
                  onPress={() => setScoreMode('classic')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="football-outline" size={14} color={scoreMode === 'classic' ? '#38bdf8' : '#64748b'} />
                  <Text
                    style={[styles.modeBtnText, scoreMode === 'classic' ? { color: '#38bdf8', fontWeight: '700' } : {}]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    {t('editLeague.classicMode')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {scoreMode === 'classic' && (
              <View style={styles.inputGroup}>
                <View style={styles.tooltipLabelWrap}>
                  <View style={styles.tooltipLabelRow}>
                    <Text style={[styles.label, { marginBottom: 0, marginLeft: 0 }]} maxFontSizeMultiplier={1.2}>{t('editLeague.bonusMode')}</Text>
                    <TouchableOpacity
                      onPress={() => setOpenTooltip((prev) => (prev === 'bonus' ? null : 'bonus'))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="help-circle-outline" size={17} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  {openTooltip === 'bonus' && (
                    <View style={styles.tooltipBubble}>
                      <View>
                        <Text style={{ color: '#f1f5f9', fontWeight: '700' }}>{t('editLeague.fullBonus')}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                          {t('editLeague.fullBonusDesc')}
                        </Text>
                      </View>
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ color: '#16a34a', fontWeight: '700' }}>{t('editLeague.basicBonus')}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                          {t('editLeague.basicBonusDesc')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      !simpleBonus
                        ? {
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderColor: 'rgba(255,255,255,0.35)',
                          }
                        : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                    ]}
                    onPress={() => setSimpleBonus(false)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.modeBtnText, !simpleBonus ? { color: '#f1f5f9', fontWeight: '700' } : {}]}
                      maxFontSizeMultiplier={1.2}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.7}
                    >
                      {t('editLeague.fullBonus')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      simpleBonus
                        ? { backgroundColor: 'rgba(22,163,74,0.18)', borderColor: '#16a34a' }
                        : { backgroundColor: '#0f2744', borderColor: '#2d4a6e' },
                    ]}
                    onPress={() => setSimpleBonus(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.modeBtnText, simpleBonus ? { color: '#16a34a', fontWeight: '700' } : {}]}
                      maxFontSizeMultiplier={1.2}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.7}
                    >
                      {t('editLeague.basicBonus')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled, { marginTop: 8 }]}
              onPress={handleUpdateLeague}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.createButtonText} maxFontSizeMultiplier={1.2}>
                {loading ? t('editLeague.updating') : t('editLeague.updateButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  formCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    overflow: 'visible',
  },
  inputGroup: {
    marginBottom: 20,
  },
  tooltipLabelWrap: {
    position: 'relative',
    marginBottom: 6,
    marginLeft: 4,
    zIndex: 100,
  },
  tooltipLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipBubble: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    zIndex: 100,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 220,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#0f2744',
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f1f5f9',
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: '#2563eb',
  },
  characterCount: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success screen
  successContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  leagueNameHighlight: {
    fontWeight: '700',
    color: '#93c5fd',
  },
  inviteCodeSection: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    marginVertical: 24,
  },
  inviteCodeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  inviteCodeBox: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#475569',
    width: '100%',
    minHeight: 100,
    position: 'relative',
  },
  copyIconInBox: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'transparent',
    padding: 4,
    borderRadius: 20,
  },
  inviteCodeTextCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  inviteCodeText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    width: '100%',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  shareText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  doneButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
  },
  shareButtonText: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '600',
  },
  inputFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 4,
  },
  fieldErrorHidden: {
    color: 'transparent',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2d4a6e',
    backgroundColor: '#0f2744',
  },
  modeBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
});
