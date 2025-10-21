import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, AppConfig } from '../services/api';

interface TournamentContextType {
  currentStage: string | null;
  penaltyPerChange: number | null;
  isLoading: boolean;
  error: string | null;
  refreshTournamentData: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

interface TournamentProviderProps {
  children: ReactNode;
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ children }) => {
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [penaltyPerChange, setPenaltyPerChange] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTournamentData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const config: AppConfig = await apiService.getAppConfig();
      
      setCurrentStage(config.current_stage);
      setPenaltyPerChange(config.penalty_per_change);
    } catch (err) {
      console.error('Failed to fetch tournament config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament config');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTournamentData();
  }, []);

  const value: TournamentContextType = {
    currentStage,
    penaltyPerChange,
    isLoading,
    error,
    refreshTournamentData,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = (): TournamentContextType => {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};