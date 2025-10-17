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
import { BracketMatch } from '../utils/bracketCalculator';

interface MatchEditModalProps {
  visible: boolean;
  match: BracketMatch | null;
  onClose: () => void;
  onSave: (matchId: number, winnerId: number) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MatchEditModal({ visible, match, onClose, onSave }: MatchEditModalProps) {
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [hasChanged, setHasChanged] = useState(false);

  // Smart team name display logic
  const getTeamNameDisplayProps = (teamName: string) => {
    const nameLength = teamName.length;
    const hasMultipleWords = teamName.includes(' ');
    
    // Short names (≤12 characters): Always stay on one line with normal font
    if (nameLength <= 12) {
      return {
        numberOfLines: 1,
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.9, // Allow slight shrinking
        fontSize: 16
      };
    }
    
    // Medium names (13-20 characters): Allow 2 lines with good font size
    if (nameLength <= 20) {
      return {
        numberOfLines: 2,
        adjustsFontSizeToFit: false,
        fontSize: 15
      };
    }
    
    // Long names (>20 characters) or names with many words: Allow 2 lines with smaller font
    return {
      numberOfLines: 2,
      adjustsFontSizeToFit: false,
      fontSize: 13
    };
  };

  useEffect(() => {
    if (match) {
      setSelectedWinner(match.winner_team_id || null);
      setHasChanged(false);
    }
  }, [match]);

  if (!match) return null;

  // Get display props for both teams
  const team1DisplayProps = getTeamNameDisplayProps(match.team1_name || 'TBD');
  const team2DisplayProps = getTeamNameDisplayProps(match.team2_name || 'TBD');

  const handleTeamSelection = (teamId: number) => {
    setSelectedWinner(teamId);
    setHasChanged(teamId !== match.winner_team_id);
  };

  const handleUpdate = () => {
    if (selectedWinner && hasChanged) {
      onSave(match.id, selectedWinner);
      onClose();
    }
  };

  const isTeam1TBD = !match.team1_name || match.team1_name === 'TBD';
  const isTeam2TBD = !match.team2_name || match.team2_name === 'TBD';
  const isTeam1Selected = selectedWinner === match.team1_id && !isTeam1TBD;
  const isTeam2Selected = selectedWinner === match.team2_id && !isTeam2TBD;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Match</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Match Info */}
            <View style={styles.matchContainer}>
              <Text style={styles.matchStage}>{match.stage.toUpperCase()}</Text>
              <Text style={styles.matchId}>Match #{match.id}</Text>
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
                  {isTeam1Selected && (
                    <Text style={styles.winnerBadge}>✓</Text>
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
                  {isTeam2Selected && (
                    <Text style={styles.winnerBadge}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Update Button - Always visible for consistent height */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.updateButton,
                  !hasChanged && styles.disabledButton
                ]}
                onPress={handleUpdate}
                disabled={!hasChanged}
              >
                <Text style={[
                  styles.updateButtonText,
                  !hasChanged && styles.disabledButtonText
                ]}>
                  עדכן
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  matchContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  matchStage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  matchId: {
    fontSize: 14,
    color: '#9ca3af',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 8,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
  },
  winnerCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  selectedCard: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    borderWidth: 3,
  },
  disabledCard: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.6,
  },
  teamContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8, // Fixed distance from top edge
    height: '100%',
  },
  flag: {
    width: 48,
    height: 32,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
  },
  teamName: {
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 20, // Better line spacing for multi-line text
  },
  winnerText: {
    color: '#059669',
    fontWeight: 'bold',
  },
  selectedText: {
    color: '#15803d',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#9ca3af',
  },
  winnerBadge: {
    fontSize: 20,
    marginTop: 4,
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  instructionsContainer: {
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  updateButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
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
});
