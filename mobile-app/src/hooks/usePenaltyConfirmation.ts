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
      `השינויים יורידו לך ${totalPenalty} נקודות מהניקוד הנוכחי שלך`,
      [
        {
          text: 'לא לבצע',
          style: 'cancel',
          onPress: () => {
            // Call the onCancel function if provided
            if (onCancel) {
              onCancel();
            }
          }
        },
        {
          text: 'לבצע',
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
