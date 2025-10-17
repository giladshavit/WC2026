import React from 'react';
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
  if (!match) return null;

  const handleWinnerSelection = (winnerId: number) => {
    onSave(match.id, winnerId);
    onClose();
  };

  const isTeam1Winner = match.winner_team_id === match.team1_id;
  const isTeam2Winner = match.winner_team_id === match.team2_id;

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
                  isTeam1Winner && styles.winnerCard,
                  !match.team1_id && styles.disabledCard
                ]}
                onPress={() => match.team1_id && handleWinnerSelection(match.team1_id)}
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
                  <Text style={[
                    styles.teamName,
                    isTeam1Winner && styles.winnerText,
                    !match.team1_id && styles.disabledText
                  ]}>
                    {match.team1_name || 'TBD'}
                  </Text>
                  {isTeam1Winner && (
                    <Text style={styles.winnerBadge}>🏆</Text>
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
                  isTeam2Winner && styles.winnerCard,
                  !match.team2_id && styles.disabledCard
                ]}
                onPress={() => match.team2_id && handleWinnerSelection(match.team2_id)}
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
                  <Text style={[
                    styles.teamName,
                    isTeam2Winner && styles.winnerText,
                    !match.team2_id && styles.disabledText
                  ]}>
                    {match.team2_name || 'TBD'}
                  </Text>
                  {isTeam2Winner && (
                    <Text style={styles.winnerBadge}>🏆</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                Tap on a team to select them as the winner
              </Text>
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
    padding: 16,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  winnerCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  disabledCard: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.6,
  },
  teamContent: {
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  winnerText: {
    color: '#059669',
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
});
