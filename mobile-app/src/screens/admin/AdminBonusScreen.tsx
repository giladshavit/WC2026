import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { GroupPrediction } from '../../services/api';

type QuestionId = 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'k1' | 'k2' | 'k3' | 't1' | 't2';

interface Option {
  value: string;
  label: string;
}

interface Question {
  id: QuestionId;
  label: string;
  section: string;
  options: Option[];
}

const { width: screenWidth } = Dimensions.get('window');

const STATIC_OPTIONS: Record<string, Option[]> = {
  g1: [
    { value: 'under_120', label: '0–119' },
    { value: '120_139', label: '120–139' },
    { value: '140_159', label: '140–159' },
    { value: '160_179', label: '160–179' },
    { value: '180_199', label: '180–199' },
    { value: '200_plus', label: '200+' },
  ],
  g4: [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5_plus', label: '5+' },
  ],
  g5: [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5_plus', label: '5+' },
  ],
  k1: [
    { value: 'under_30', label: '0–29' },
    { value: '30_39', label: '30–39' },
    { value: '40_49', label: '40–49' },
    { value: '50_59', label: '50–59' },
    { value: '60_69', label: '60–69' },
    { value: '70_79', label: '70–79' },
    { value: '80_plus', label: '80+' },
  ],
  k2: [
    { value: '0_3', label: '0–3' },
    { value: '4_5', label: '4–5' },
    { value: '6_7', label: '6–7' },
    { value: '8_9', label: '8–9' },
    { value: '10_11', label: '10–11' },
    { value: '12_plus', label: '12+' },
  ],
  k3: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ value: String(i), label: String(i) })),
  t1: [
    { value: 'under_160', label: '0–159' },
    { value: '160_189', label: '160–189' },
    { value: '190_219', label: '190–219' },
    { value: '220_249', label: '220–249' },
    { value: '250_280', label: '250–280' },
    { value: '280_plus', label: '280+' },
  ],
  t2: [
    { value: '0_3', label: '0–3' },
    { value: '4_5', label: '4–5' },
    { value: '6_7', label: '6–7' },
    { value: '8_9', label: '8–9' },
    { value: '10_11', label: '10–11' },
    { value: '12_plus', label: '12+' },
  ],
};

const QUESTIONS: Question[] = [
  { id: 'g1', section: 'Group Stage', label: 'Total goals in Group Stage', options: STATIC_OPTIONS.g1 },
  { id: 'g2', section: 'Group Stage', label: 'Top scoring group', options: [] },
  { id: 'g3', section: 'Group Stage', label: 'Top scoring team in Group Stage', options: [] },
  { id: 'g4', section: 'Group Stage', label: 'Teams finishing with 9/9 points', options: STATIC_OPTIONS.g4 },
  { id: 'g5', section: 'Group Stage', label: 'Teams with clean sheets in group stage', options: STATIC_OPTIONS.g5 },
  { id: 'k1', section: 'Knockout', label: 'Total goals in Knockout Stage', options: STATIC_OPTIONS.k1 },
  { id: 'k2', section: 'Knockout', label: 'Matches decided by penalty shootout', options: STATIC_OPTIONS.k2 },
  { id: 'k3', section: 'Knockout', label: '3rd-place teams reaching Quarter Finals', options: STATIC_OPTIONS.k3 },
  { id: 't1', section: 'Tournament', label: 'Total goals in the tournament', options: STATIC_OPTIONS.t1 },
  { id: 't2', section: 'Tournament', label: 'Scoreless draws (0:0) in the tournament', options: STATIC_OPTIONS.t2 },
];

const SECTION_COLORS: Record<string, string> = {
  'Group Stage': '#16a34a',
  'Knockout': '#dc7f1e',
  'Tournament': '#7c3aed',
};

export default function AdminBonusScreen() {
  const [selected, setSelected] = useState<Record<QuestionId, string>>({
    g1: '', g2: '', g3: '', g4: '', g5: '',
    k1: '', k2: '', k3: '', t1: '', t2: '',
  });
  const [selectedInterim, setSelectedInterim] = useState<Record<QuestionId, string>>({
    g1: '', g2: '', g3: '', g4: '', g5: '',
    k1: '', k2: '', k3: '', t1: '', t2: '',
  });
  const [loading, setLoading] = useState<Record<QuestionId, boolean>>({
    g1: false, g2: false, g3: false, g4: false, g5: false,
    k1: false, k2: false, k3: false, t1: false, t2: false,
  });
  const [results, setResults] = useState<Record<QuestionId, string | null>>({
    g1: null, g2: null, g3: null, g4: null, g5: null,
    k1: null, k2: null, k3: null, t1: null, t2: null,
  });
  const [groups, setGroups] = useState<GroupPrediction[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    apiService.getGroups(1)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    const loadExisting = async () => {
      setLoadingExisting(true);
      try {
        const existing = await apiService.getAdminBonusResults();
        const toVal = (v: string | null | undefined) => (v ?? '').split(',')[0]?.trim() ?? '';
        setSelected((prev) => ({
          ...prev,
          g1: toVal(existing.g1_correct),
          g2: toVal(existing.g2_correct),
          g3: toVal(existing.g3_correct),
          g4: toVal(existing.g4_correct),
          g5: toVal(existing.g5_correct),
          k1: toVal(existing.k1_correct),
          k2: toVal(existing.k2_correct),
          k3: toVal(existing.k3_correct),
          t1: toVal(existing.t1_correct),
          t2: toVal(existing.t2_correct),
        }));
        setSelectedInterim((prev) => ({
          ...prev,
          g1: toVal(existing.g1_interim),
          g2: toVal(existing.g2_interim),
          g3: toVal(existing.g3_interim),
          g4: toVal(existing.g4_interim),
          g5: toVal(existing.g5_interim),
          k1: toVal(existing.k1_interim),
          k2: toVal(existing.k2_interim),
          k3: toVal(existing.k3_interim),
          t1: toVal(existing.t1_interim),
          t2: toVal(existing.t2_interim),
        }));
      } catch (e) {
        console.error('Failed to load bonus results:', e);
      } finally {
        setLoadingExisting(false);
      }
    };
    loadExisting();
  }, []);

  const allTeams = groups.flatMap((g) => (g.teams || []).map((t) => ({ ...t, groupId: g.group_id })));

  const [savingInterim, setSavingInterim] = useState(false);

  const handleSaveInterim = async () => {
    setSavingInterim(true);
    try {
      const payload: Record<string, string | null> = {};
      (Object.keys(selectedInterim) as QuestionId[]).forEach((id) => {
        payload[`${id}_interim`] = selectedInterim[id] || null;
      });
      await apiService.updateBonusInterim(payload);
      Alert.alert('Success', 'Interim values saved.');
    } catch (e: any) {
      console.error('Failed to save interim values:', e);
      Alert.alert('Error', e?.message || 'Failed to save interim values.');
    } finally {
      setSavingInterim(false);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const payload = {
        g1_correct: selected.g1 || null,
        g2_correct: selected.g2 || null,
        g3_correct: selected.g3 || null,
        g4_correct: selected.g4 || null,
        g5_correct: selected.g5 || null,
        k1_correct: selected.k1 || null,
        k2_correct: selected.k2 || null,
        k3_correct: selected.k3 || null,
        t1_correct: selected.t1 || null,
        t2_correct: selected.t2 || null,
      };
      await apiService.updateBonusResults(payload);
      Alert.alert('Success', 'Bonus results updated and all predictions re-settled.');
    } catch (e: any) {
      console.error('Failed to save bonus results:', e);
      Alert.alert('Error', e?.message || 'Failed to save bonus results.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSettle = async (q: Question) => {
    const value = selected[q.id];
    if (!value) {
      Alert.alert('Select an answer', `Please select the correct answer for: ${q.label}`);
      return;
    }

    const label = q.id === 'g2'
      ? groups.find((g) => String(g.group_id) === value)?.group_name ?? value
      : q.id === 'g3'
        ? allTeams.find((t) => String(t.id) === value)?.name ?? value
        : q.options.find((o) => o.value === value)?.label ?? value;

    Alert.alert(
      `Settle "${q.label}"?`,
      `Correct answer: ${label}\n\nThis will grade all users for this question. Each correct prediction earns 8 pts.\n\nThis action is permanent for already-settled questions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          style: 'default',
          onPress: async () => {
            setLoading((prev) => ({ ...prev, [q.id]: true }));
            setResults((prev) => ({ ...prev, [q.id]: null }));
            try {
              const res = await apiService.settleBonusQuestion(q.id, value);
              setResults((prev) => ({
                ...prev,
                [q.id]: `✅ Correct: ${res.correct} | Incorrect: ${res.incorrect} | Already settled: ${res.skipped_already_settled}`,
              }));
            } catch (e: any) {
              setResults((prev) => ({
                ...prev,
                [q.id]: `❌ Error: ${e?.message || 'Unknown error'}`,
              }));
            } finally {
              setLoading((prev) => ({ ...prev, [q.id]: false }));
            }
          },
        },
      ]
    );
  };

  const renderPicker = (q: Question, isInterim = false) => {
    const sel = isInterim ? selectedInterim : selected;
    const setSel = isInterim ? setSelectedInterim : setSelected;
    const accentColor = isInterim ? '#f59e0b' : '#16a34a';
    const accentBg = isInterim ? 'rgba(245,158,11,0.15)' : 'rgba(22,163,74,0.15)';

    if (q.id === 'g2') {
      if (loadingGroups) return <ActivityIndicator color={accentColor} style={{ marginVertical: 12 }} />;
      const CARD_W = Math.floor((screenWidth - 40 - 24) / 3);
      const FLAG_W = Math.floor((CARD_W - 20) / 2);
      const FLAG_H = Math.floor(FLAG_W * 0.65);
      return (
        <View style={styles.flagGrid}>
          {groups.map((g) => {
            const isSelected = sel[q.id] === String(g.group_id);
            const teams = (g.teams || []).slice(0, 4);
            return (
              <TouchableOpacity
                key={g.group_id}
                style={[
                  styles.groupCard,
                  isSelected && (isInterim ? { backgroundColor: accentBg, borderColor: accentColor } : styles.groupCardSelected),
                ]}
                onPress={() => setSel((prev) => ({ ...prev, [q.id]: String(g.group_id) }))}
              >
                <Text style={[styles.groupName, isSelected && { color: accentColor }]}>{g.group_name}</Text>
                <View style={styles.flagRow}>
                  {teams.map((t) =>
                    t.flag_url ? (
                      <Image key={t.id} source={{ uri: t.flag_url }} style={{ width: FLAG_W, height: FLAG_H, borderRadius: 4 }} />
                    ) : (
                      <View key={t.id} style={[styles.flagPlaceholder, { width: FLAG_W, height: FLAG_H }]} />
                    )
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (q.id === 'g3') {
      if (loadingGroups) return <ActivityIndicator color={accentColor} style={{ marginVertical: 12 }} />;
      const GAP = 6;
      const COLS = 6;
      const CELL_W = Math.floor((screenWidth - 40 - (COLS - 1) * GAP) / COLS);
      const FLAG_W = Math.floor(CELL_W * 0.85);
      const FLAG_H = Math.floor(FLAG_W / 1.5);
      return (
        <ScrollView horizontal={false} showsVerticalScrollIndicator style={{ maxHeight: 220 }}>
          <View style={[styles.flagGrid, { gap: GAP }]}>
            {allTeams.map((t) => {
              const isSelected = sel[q.id] === String(t.id);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.teamCell,
                    isSelected && (isInterim ? { backgroundColor: accentBg, borderColor: accentColor } : styles.teamCellSelected),
                    { width: CELL_W },
                  ]}
                  onPress={() => setSel((prev) => ({ ...prev, [q.id]: String(t.id) }))}
                >
                  {t.flag_url ? (
                    <Image source={{ uri: t.flag_url }} style={{ width: FLAG_W, height: FLAG_H, borderRadius: 4 }} resizeMode="contain" />
                  ) : (
                    <View style={[styles.flagPlaceholder, { width: FLAG_W, height: FLAG_H }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={styles.pillRow}>
        {q.options.map((opt) => {
          const isSelected = sel[q.id] === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.pill,
                isSelected && (isInterim ? { backgroundColor: accentBg, borderColor: accentColor } : styles.pillSelected),
              ]}
              onPress={() => setSel((prev) => ({ ...prev, [q.id]: opt.value }))}
            >
              <Text style={[styles.pillText, isSelected && { color: accentColor }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const sections = ['Group Stage', 'Knockout', 'Tournament'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Bonus Results</Text>
        <Text style={styles.subheading}>Select correct answer per question to grade all users</Text>

        {loadingExisting ? (
          <ActivityIndicator color="#16a34a" style={{ marginVertical: 16 }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.saveAllBtn, savingAll && styles.settleBtnDisabled, { flex: 1 }]}
              onPress={handleSaveAll}
              disabled={savingAll}
            >
              {savingAll ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.settleBtnText}>Save All Results</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveInterimBtn, savingInterim && styles.settleBtnDisabled, { flex: 1 }]}
              onPress={handleSaveInterim}
              disabled={savingInterim}
            >
              {savingInterim ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.settleBtnText}>Save Interim Values</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {sections.map((section) => (
          <View key={section} style={styles.sectionBlock}>
            <View style={[styles.sectionHeader, { backgroundColor: SECTION_COLORS[section] }]}>
              <Text style={styles.sectionTitle}>{section}</Text>
            </View>

            {QUESTIONS.filter((q) => q.section === section).map((q) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.questionMeta}>
                  <Text style={styles.questionId}>{q.id.toUpperCase()}</Text>
                  <Text style={styles.questionLabel}>{q.label}</Text>
                </View>

                {renderPicker(q)}

                <View style={styles.interimSection}>
                  <Text style={styles.interimLabel}>⚡ Current / Interim</Text>
                  {renderPicker(q, true)}
                </View>

                <TouchableOpacity
                  style={[styles.settleBtn, loading[q.id] && styles.settleBtnDisabled]}
                  onPress={() => handleSettle(q)}
                  disabled={loading[q.id]}
                >
                  {loading[q.id] ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.settleBtnText}>
                      {selected[q.id]
                        ? `Settle: ${q.id === 'g2'
                          ? groups.find((g) => String(g.group_id) === selected[q.id])?.group_name ?? selected[q.id]
                          : q.id === 'g3'
                            ? allTeams.find((t) => String(t.id) === selected[q.id])?.name ?? selected[q.id]
                            : q.options.find((o) => o.value === selected[q.id])?.label ?? selected[q.id]}`
                        : 'Select an answer first'}
                    </Text>
                  )}
                </TouchableOpacity>

                {results[q.id] && (
                  <Text style={[styles.resultText, results[q.id]?.startsWith('✅') ? styles.resultOk : styles.resultErr]}>
                    {results[q.id]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 28, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  sectionBlock: { marginBottom: 24 },
  sectionHeader: {
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  questionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  questionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  questionId: {
    backgroundColor: '#f1f5f9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
    fontSize: 11, fontWeight: '700', color: '#475569',
  },
  questionLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  pillSelected: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: '#16a34a' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  pillTextSelected: { color: '#16a34a' },
  flagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' },
  groupCard: {
    width: Math.floor((screenWidth - 40 - 24) / 3) - 4,
    padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9',
    borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center',
  },
  groupCardSelected: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: '#16a34a' },
  groupName: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  groupNameSelected: { color: '#16a34a' },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  teamCell: {
    padding: 4, borderRadius: 8, backgroundColor: '#f1f5f9',
    borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center',
  },
  teamCellSelected: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: '#16a34a' },
  flagPlaceholder: { backgroundColor: '#94a3b8', borderRadius: 4 },
  saveAllBtn: {
    backgroundColor: '#16a34a', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: 'center',
  },
  saveInterimBtn: {
    backgroundColor: '#f59e0b', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: 'center',
  },
  interimSection: {
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  interimLabel: {
    fontSize: 12, fontWeight: '700', color: '#f59e0b', marginBottom: 10,
  },
  settleBtn: {
    backgroundColor: '#16a34a', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', marginTop: 4,
  },
  settleBtnDisabled: { opacity: 0.5 },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultText: { fontSize: 12, marginTop: 8, fontWeight: '500' },
  resultOk: { color: '#16a34a' },
  resultErr: { color: '#dc2626' },
});
