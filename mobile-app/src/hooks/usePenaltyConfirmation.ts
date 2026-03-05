import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTournament } from '../contexts/TournamentContext';

export const usePenaltyConfirmation = () => {
  const { penaltyPerChange } = useTournament();

  const showPenaltyConfirmation = useCallback((
    requestFunction: () => Promise<void>,
    numberOfChanges: number,
    onCancel?: () => void
  ) => {
    const totalPenalty = penaltyPerChange && penaltyPerChange > 0 
      ? numberOfChanges * penaltyPerChange 
      : 0;

    if (totalPenalty === 0) {
      // No penalty, execute request directly
      requestFunction();
      return;
    }

    // Show penalty confirmation dialog
    Alert.alert(
      'Penalty Warning',
      `These changes will deduct ${totalPenalty} points from your current score`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Call the onCancel function if provided
            if (onCancel) {
              onCancel();
            }
          }
        },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => {
            requestFunction();
          }
        }
      ]
    );
  }, [penaltyPerChange]);

  return { showPenaltyConfirmation };
};
