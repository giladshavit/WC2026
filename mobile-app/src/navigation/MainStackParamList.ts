export type MainStackParamList = {
  Home: undefined;
  Profile: undefined;
  PredictionsMenu: undefined;
  MatchPredictions: undefined;
  RoutePredictions: undefined;
  Bracket: undefined;
  BonusPredictions: undefined;
  Leagues: undefined;
  Statistics: undefined;
  Rules: undefined;
  Onboarding: { mode?: 'first-session' | 'replay' };
  QuickPicks: undefined;
  QuickPicksT3: { selectedT2: number | null };
  QuickPicksDone: undefined;
  Admin: undefined;
  PublicProfile: { userId: number; username: string };
};
