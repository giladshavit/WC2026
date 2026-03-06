import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTournament } from '../contexts/TournamentContext';

export const useFineConfirmation = () => {
  const { finePerChange } = useTournament();

  const showFineConfirmation = useCallback((
    requestFunction: () => Promise<void>,
    numberOfChanges: number,
    onCancel?: () => void
  ) => {
    const totalFine = finePerChange && finePerChange > 0
      ? numberOfChanges * finePerChange
      : 0;

    if (totalFine === 0) {
      // No fine, execute request directly
      requestFunction();
      return;
    }

    // Show fine confirmation dialog
    Alert.alert(
      'Fine Warning',
      `These changes will deduct ${totalFine} points from your current score`,
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
  }, [finePerChange]);

  return { showFineConfirmation };
};
