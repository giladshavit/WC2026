import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BracketMatch } from '../utils/bracketCalculator';

interface MatchEditModalProps {
  visible: boolean;
  match: BracketMatch | null;
  onClose: () => void;
  onSave: (matchId: number, winnerId: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');

const STAGE_STYLES: Record<string, { bg: string; text: string }> = {
  round32: { bg: '#eff6ff', text: '#3b82f6' },
  round16: { bg: '#f5f3ff', text: '#7c3aed' },
  quarter: { bg: '#fffbeb', text: '#d97706' },
  semi: { bg: '#fff1f2', text: '#e11d48' },
  final: { bg: '#fefce8', text: '#ca8a04' },
};

export default function MatchEditModal({ visible, match, onClose, onSave }: MatchEditModalProps) {
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [hasChanged, setHasChanged] = useState(false);

  const getTeamNameDisplayProps = (teamName: string) => {
    const nameLength = teamName.length;
    if (nameLength <= 12) {
      return { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.9, fontSize: 16 };
    }
    if (nameLength <= 20) {
      return { numberOfLines: 2, adjustsFontSizeToFit: false, fontSize: 15 };
    }
    return { numberOfLines: 2, adjustsFontSizeToFit: false, fontSize: 13 };
  };

  useEffect(() => {
    if (match) {
      setSelectedWinner(match.winner_team_id || null);
      setHasChanged(false);
    }
  }, [match]);

  if (!match) return null;

  const team1DisplayProps = getTeamNameDisplayProps(match.team1_name || 'TBD');
  const team2DisplayProps = getTeamNameDisplayProps(match.team2_name || 'TBD');

  const handleTeamSelection = (teamId: number) => {
    setSelectedWinner(teamId);
    setHasChanged(teamId !== match.winner_team_id);
  };

  const handleUpdate = () => {
    if (selectedWinner && hasChanged) {
      onSave(match.id, selectedWinner);
    }
  };

  const isTeam1TBD = !match.team1_name || match.team1_name === 'TBD';
  const isTeam2TBD = !match.team2_name || match.team2_name === 'TBD';
  const isTeam1Selected = selectedWinner === match.team1_id && !isTeam1TBD;
  const isTeam2Selected = selectedWinner === match.team2_id && !isTeam2TBD;

  const stageKey = match.stage?.toLowerCase?.() || 'round32';
  const stageStyle = STAGE_STYLES[stageKey] || STAGE_STYLES.round32;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={[styles.modal, { overflow: 'hidden' }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Pick a Winner</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Stage Badge */}
              <View style={styles.matchContainer}>
                <View style={[styles.stageBadge, { backgroundColor: stageStyle.bg, borderColor: stageStyle.text }]}>
                  <Text style={[styles.stageText, { color: stageStyle.text }]}>
                    {match.stage?.toUpperCase?.() || 'ROUND32'}
                  </Text>
                </View>
              </View>

              {/* Teams */}
              <View style={styles.teamsContainer}>
                {/* Team 1 */}
                <TouchableOpacity
                  style={[
                    styles.teamCard,
                    isTeam1Selected && styles.selectedCard,
                    !match.team1_id && styles.disabledCard
                  ]}
                  onPress={() => match.team1_id && handleTeamSelection(match.team1_id)}
                  disabled={!match.team1_id}
                >
                  <View style={styles.teamContent}>
                    {match.team1_flag && (
                      <Image
                        source={{ uri: match.team1_flag }}
                        style={styles.flag}
                        resizeMode="contain"
                      />
                    )}
                    <Text
                      style={[
                        styles.teamName,
                        isTeam1Selected && styles.selectedText,
                        !match.team1_id && styles.disabledText,
                        { fontSize: team1DisplayProps.fontSize }
                      ]}
                      numberOfLines={team1DisplayProps.numberOfLines}
                      adjustsFontSizeToFit={team1DisplayProps.adjustsFontSizeToFit}
                      minimumFontScale={team1DisplayProps.minimumFontScale || 0.8}
                    >
                      {match.team1_name || 'TBD'}
                    </Text>
                  </View>
                  <View style={styles.checkPlaceholder}>
                    {isTeam1Selected && (
                      <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* VS */}
                <View style={styles.vsContainer}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                {/* Team 2 */}
                <TouchableOpacity
                  style={[
                    styles.teamCard,
                    isTeam2Selected && styles.selectedCard,
                    !match.team2_id && styles.disabledCard
                  ]}
                  onPress={() => match.team2_id && handleTeamSelection(match.team2_id)}
                  disabled={!match.team2_id}
                >
                  <View style={styles.teamContent}>
                    {match.team2_flag && (
                      <Image
                        source={{ uri: match.team2_flag }}
                        style={styles.flag}
                        resizeMode="contain"
                      />
                    )}
                    <Text
                      style={[
                        styles.teamName,
                        isTeam2Selected && styles.selectedText,
                        !match.team2_id && styles.disabledText,
                        { fontSize: team2DisplayProps.fontSize }
                      ]}
                      numberOfLines={team2DisplayProps.numberOfLines}
                      adjustsFontSizeToFit={team2DisplayProps.adjustsFontSizeToFit}
                      minimumFontScale={team2DisplayProps.minimumFontScale || 0.8}
                    >
                      {match.team2_name || 'TBD'}
                    </Text>
                  </View>
                  <View style={styles.checkPlaceholder}>
                    {isTeam2Selected && (
                      <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.updateButton, !hasChanged && styles.disabledButton]}
                  onPress={handleUpdate}
                  disabled={!hasChanged}
                  activeOpacity={hasChanged ? 0.8 : 1}
                >
                  <Text style={[styles.updateButtonText, !hasChanged && styles.disabledButtonText]}>
                    {hasChanged ? 'Confirm Winner' : 'Select a Winner'}
                  </Text>
                  {hasChanged && (
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.buttonArrow} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    width: screenWidth * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 20,
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  matchContainer: {
    alignItems: 'center',
    marginTop: -30,
    marginBottom: 16,
  },
  stageBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  stageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    minHeight: 140,
  },
  selectedCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
    borderWidth: 2.5,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledCard: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.6,
  },
  teamContent: {
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    width: 56,
    height: 36,
    marginBottom: 8,
  },
  teamName: {
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 20,
  },
  selectedText: {
    color: '#15803d',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#9ca3af',
  },
  checkPlaceholder: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsContainer: {
    width: 36,
    alignItems: 'center',
  },
  vsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6b7280',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  updateButton: {
    backgroundColor: '#16a34a',
    width: '100%',
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#e5e7eb',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  buttonArrow: {
    marginLeft: 4,
  },
});
