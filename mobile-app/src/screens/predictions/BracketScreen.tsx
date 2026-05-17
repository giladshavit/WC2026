  import React, { useState, useEffect, useRef } from 'react';
  import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Animated,
    useWindowDimensions,
    TouchableOpacity,
    Platform,
    Modal,
    Pressable,
    StatusBar,
  } from 'react-native';
  import { useAuth } from '../../contexts/AuthContext';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import Svg, { Line } from 'react-native-svg';
  import { useFocusEffect, useNavigation } from '@react-navigation/native';
  import { apiService, KnockoutPrediction, BracketResetPreview } from '../../services/api';
  import BracketMatchCard from '../../components/cards/BracketMatchCard';
  import MatchEditModal from '../../components/modals/MatchEditModal';
  import EnterEditModeModal from '../../components/modals/EnterEditModeModal';
  import ConfirmSaveModal from '../../components/modals/ConfirmSaveModal';
  import ConfirmResetModal from '../../components/modals/ConfirmResetModal';
  import ConfirmExitModal from '../../components/modals/ConfirmExitModal';
  import { organizeBracketMatches, BracketMatch, OrganizedBracket } from '../../utils/bracketCalculator';
  import { useTournament } from '../../contexts/TournamentContext';
  import { useToast } from '../../components/toast/Toast';
  import { ErrorModal } from '../../components/modals/CustomModals';
  import { captureRef } from 'react-native-view-shot';
  import * as MediaLibrary from 'expo-media-library';
  import * as Sharing from 'expo-sharing';
  import Ionicons from '@expo/vector-icons/Ionicons';
  import { useTranslation } from 'react-i18next';
import { IS_RTL } from '../../utils/rtl';

  interface BracketScreenProps {}

  export default function BracketScreen({}: BracketScreenProps) {
    const navigation = useNavigation();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const pendingNavActionRef = useRef<any>(null);

    // Derived constants - recalculate when dimensions change
    const STATUS_BAR_HEIGHT = 44;
    const TAB_BAR_HEIGHT = 60;
    const NAV_HEADER_HEIGHT = 60;
    const BOTTOM_TABS_HEIGHT = 80;
    const AVAILABLE_HEIGHT = screenHeight - STATUS_BAR_HEIGHT - TAB_BAR_HEIGHT - NAV_HEADER_HEIGHT - BOTTOM_TABS_HEIGHT;
    const BASE_HEIGHT = 680;
    const scaleFactor = Math.min(1.0, Math.max(0.82, AVAILABLE_HEIGHT / BASE_HEIGHT));
    const CARD_W = Math.round(100 * scaleFactor);
    const CARD_H = Math.round(68 * scaleFactor);
    const COLUMN_WIDTH = Math.round(110 * scaleFactor);
    const FINAL_WRAPPER_ABOVE_CARD = Math.round(156 * scaleFactor);
    const rawSpacing = (AVAILABLE_HEIGHT - 40) / 8;
    const minSpacing = CARD_H + 8;
    const spacing = Math.max(rawSpacing, minSpacing);
    const bracketContentHeight = 7 * spacing + CARD_H;
    const Y_OFFSET = Math.max(10, Math.round((AVAILABLE_HEIGHT - bracketContentHeight) / 2));
    const totalBracketHeight = spacing * 8 + CARD_H + Y_OFFSET + 40;
    const TOTAL_BRACKET_WIDTH = 60 + 9 * (COLUMN_WIDTH + 20) + 20;
    const BRACKET_PADDING_LEFT = Math.round(screenWidth * 0.08);
    const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
    const [organizedBracket, setOrganizedBracket] = useState<OrganizedBracket | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [canEditDrafts, setCanEditDrafts] = useState<boolean>(true);
    const [fineInfo, setFineInfo] = useState<{changes_count: number, penalty_per_change: number, total_penalty: number} | null>(null);
    const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
    const [freeChanges, setFreeChanges] = useState<number>(0);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [isEnterEditModeModalVisible, setIsEnterEditModeModalVisible] = useState(false);
    const [isConfirmSaveModalVisible, setIsConfirmSaveModalVisible] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [showNotEditableModal, setShowNotEditableModal] = useState(false);
    const [duplicateWinnersModal, setDuplicateWinnersModal] = useState<string[] | null>(null);
    const [saveSuccessInfo, setSaveSuccessInfo] = useState<{ changes_count: number; penalty_applied: number } | null>(null);
    const [hasUsedBracketReset, setHasUsedBracketReset] = useState(false);
    const [showBracketResetModal, setShowBracketResetModal] = useState(false);
    const [bracketResetPreview, setBracketResetPreview] = useState<BracketResetPreview | null>(null);
    const [isLoadingResetPreview, setIsLoadingResetPreview] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    const { t } = useTranslation();
    const { showToast } = useToast();
    const [errorModal, setErrorModal] = useState<{
      title: string;
      message: string;
      goBack?: boolean;
    } | null>(null);
    
    // Get current user ID
    const { getCurrentUserId } = useAuth();
    const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    
    // Ref for capturing the bracket view
    const bracketRef = useRef<View>(null);

    const [showScrollHint, setShowScrollHint] = useState(true);
    const scrollHintOpacity = useRef(new Animated.Value(1)).current;

    // Get tournament context data
    const { currentStage, finePerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
    
    const isPreTournament = currentStage === 'PRE_GROUP_STAGE' || !currentStage;

    // Toast auto-dismiss
    useEffect(() => {
      if (!toastMsg) return;
      const t = setTimeout(() => setToastMsg(null), 2500);
      return () => clearTimeout(t);
    }, [toastMsg]);

    useEffect(() => {
      if (!loading && organizedBracket) {
        const timer = setTimeout(() => {
          Animated.timing(scrollHintOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }).start(() => setShowScrollHint(false));
        }, 3000);
        return () => clearTimeout(timer);
      }
    }, [loading, organizedBracket]);

    // Info button in header
    useEffect(() => {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setShowInfo(true)}
            style={{ marginRight: 12, padding: 4 }}
          >
            <Ionicons name="information-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      });
    }, [navigation, editMode, isPreTournament, canEditDrafts, currentStage, hasUsedBracketReset]);

    // Intercept back button/gesture when in edit mode
    useEffect(() => {
      if (!editMode) return;

      const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
        e.preventDefault();
        const checkChanges = async () => {
          const userId = getCurrentUserId();
          if (!userId) return;
          try {
            const countResult = await apiService.getDraftChangesCount(userId);
            setFineInfo(countResult);
            if (countResult.free_changes !== undefined) {
              setFreeChanges(countResult.free_changes ?? 0);
            }
            if (countResult.changes_count > 0) {
              setShowExitModal(true);
              pendingNavActionRef.current = e.data.action;
            } else {
              // No changes - exit directly without showing modal
              await executeExit(e.data.action);
            }
          } catch (error) {
            console.error('Error checking draft changes:', error);
            setErrorModal({ title: 'Error', message: 'Could not exit edit mode. Please try again.' });
          }
        };
        checkChanges();
      });

      return unsubscribe;
    }, [editMode, navigation]);

    const refreshFineCount = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId || !editMode) return;
        const result = await apiService.getDraftChangesCount(userId);
        setFineInfo(result);
        if (result.free_changes !== undefined) {
          setFreeChanges(result.free_changes ?? 0);
        }
      } catch (error) {
        console.error('Error refreshing fine count:', error);
      }
    };

    const fetchPredictions = async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        
        // Get current user ID
        const userId = getCurrentUserId();
        if (!userId) {
          setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
          return;
        }
        
        // Fetch all knockout predictions (use draft if in edit mode)
        const allPredictions = await apiService.getKnockoutPredictions(userId, undefined, editMode);
        setPredictions(allPredictions.predictions);
        setCanEditDrafts(allPredictions.can_edit_drafts ?? true);
        setKnockoutScore(allPredictions.knockout_score ?? null);
        setFreeChanges(allPredictions.free_changes ?? 0);

        // Organize into bracket structure
        const { organized, calculateCardCoordinates } = organizeBracketMatches(allPredictions.predictions);
        
        // Calculate card coordinates with current spacing and scaled card height
        const cardHeight = Math.round(60 * scaleFactor);
        calculateCardCoordinates(spacing, cardHeight);
        
        setOrganizedBracket(organized);

        try {
          const preview = await apiService.getBracketResetPreview(userId);
          setHasUsedBracketReset(preview.has_used_reset);
        } catch (_) {
          // Don't block the rest of the flow
        }
        
      } catch (error) {
        console.error('Error fetching bracket predictions:', error);
        setErrorModal({ title: 'Error', message: 'Could not load bracket. Please try again.', goBack: true });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    const drawBracketLines = (padding: number = 60) => {
      if (!organizedBracket) return [];
      const PADDING = padding;
      const SCROLL_PADDING_TOP = 21;
      const COL_WIDTH = COLUMN_WIDTH + 20; // column width + marginRight gap
      const LINE_COLOR = '#94a3b8';
      const LINE_WIDTH = 1.5;

      // Given a match, compute the absolute X/Y of its right edge center and left edge center
      const getCardCenter = (match: BracketMatch, columnIndex: number) => {
        const colX = PADDING + columnIndex * COL_WIDTH;
        const cardX = colX + (COLUMN_WIDTH - CARD_W) / 2;
        const cardY = (match.verticalPosition || 0) * spacing + Y_OFFSET + SCROLL_PADDING_TOP;
        return {
          leftX: cardX,
          rightX: cardX + CARD_W,
          centerY: cardY + CARD_H / 2,
        };
      };

      const lines: React.ReactElement[] = [];
      let lineKey = 0;

      // Draw connector: two source matches feed into one target match
      // sourceIsLeft=true means sources are to the LEFT of target (left bracket side)
      const drawConnector = (
        source1: BracketMatch, source1Col: number,
        source2: BracketMatch, source2Col: number,
        target: BracketMatch, targetCol: number,
        sourceIsLeft: boolean
      ) => {
        const s1 = getCardCenter(source1, source1Col);
        const s2 = getCardCenter(source2, source2Col);
        const t = getCardCenter(target, targetCol);
        const sx1 = sourceIsLeft ? s1.rightX : s1.leftX;
        const sx2 = sourceIsLeft ? s2.rightX : s2.leftX;
        const tx = sourceIsLeft ? t.leftX : t.rightX;
        const midX = (sx1 + tx) / 2;
        lines.push(<Line key={lineKey++} x1={sx1} y1={s1.centerY} x2={midX} y2={s1.centerY} stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />);
        lines.push(<Line key={lineKey++} x1={sx2} y1={s2.centerY} x2={midX} y2={s2.centerY} stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />);
        lines.push(<Line key={lineKey++} x1={midX} y1={s1.centerY} x2={midX} y2={s2.centerY} stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />);
        const avgY = (s1.centerY + s2.centerY) / 2;
        lines.push(<Line key={lineKey++} x1={midX} y1={avgY} x2={tx} y2={avgY} stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />);
      };

      const { round32_left, round16_left, quarter_left, semi, final, quarter_right, round16_right, round32_right } = organizedBracket;
      const findById = (arr: BracketMatch[], id: number) => arr.find(m => m.id === id);

      const cols: number[] = [];
      if (round32_left.length > 0) cols.push(0);
      if (round16_left.length > 0) cols.push(1);
      if (quarter_left.length > 0) cols.push(2);
      if (semi.filter(m => m.id === 101).length > 0) cols.push(3);
      if (final.length > 0) cols.push(4);
      if (semi.filter(m => m.id === 102).length > 0) cols.push(5);
      if (quarter_right.length > 0) cols.push(6);
      if (round16_right.length > 0) cols.push(7);
      if (round32_right.length > 0) cols.push(8);

      const logicalToVisual: Record<number, number> = {};
      cols.forEach((logical, visual) => { logicalToVisual[logical] = visual; });
      const vc = (logical: number) => logicalToVisual[logical] ?? logical;

      // LEFT SIDE: Round32 -> Round16
      const r32l_connections = [
        { s1: 74, s2: 77, t: 89 },
        { s1: 73, s2: 75, t: 90 },
        { s1: 83, s2: 84, t: 93 },
        { s1: 81, s2: 82, t: 94 },
      ];
      r32l_connections.forEach(({ s1, s2, t }) => {
        const m1 = findById(round32_left, s1);
        const m2 = findById(round32_left, s2);
        const mt = findById(round16_left, t);
        if (m1 && m2 && mt) drawConnector(m1, vc(0), m2, vc(0), mt, vc(1), true);
      });

      // LEFT SIDE: Round16 -> Quarter
      const r16l_connections = [
        { s1: 89, s2: 90, t: 97 },
        { s1: 93, s2: 94, t: 98 },
      ];
      r16l_connections.forEach(({ s1, s2, t }) => {
        const m1 = findById(round16_left, s1);
        const m2 = findById(round16_left, s2);
        const mt = findById(quarter_left, t);
        if (m1 && m2 && mt) drawConnector(m1, vc(1), m2, vc(1), mt, vc(2), true);
      });

      // LEFT SIDE: Quarter -> Semi 101
      if (quarter_left.length === 2) {
        const semiMatch = findById(semi, 101);
        if (semiMatch) drawConnector(quarter_left[0], vc(2), quarter_left[1], vc(2), semiMatch, vc(3), true);
      }

      // LEFT SIDE: Semi 101 -> Final (horizontal line at semi's center Y)
      const semi101 = findById(semi, 101);
      if (semi101 && final.length > 0) {
        const s = getCardCenter(semi101, vc(3));
        const fColX = PADDING + vc(4) * COL_WIDTH;
        const fCardLeftX = fColX + (COLUMN_WIDTH - CARD_W) / 2;
        const GAP = 14;
        lines.push(
          <Line key={lineKey++}
            x1={s.rightX} y1={s.centerY}
            x2={fCardLeftX - GAP} y2={s.centerY}
            stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />
        );
      }

      // RIGHT SIDE: Round32 -> Round16
      const r32r_connections = [
        { s1: 76, s2: 78, t: 91 },
        { s1: 79, s2: 80, t: 92 },
        { s1: 86, s2: 88, t: 95 },
        { s1: 85, s2: 87, t: 96 },
      ];
      r32r_connections.forEach(({ s1, s2, t }) => {
        const m1 = findById(round32_right, s1);
        const m2 = findById(round32_right, s2);
        const mt = findById(round16_right, t);
        if (m1 && m2 && mt) drawConnector(m1, vc(8), m2, vc(8), mt, vc(7), false);
      });

      // RIGHT SIDE: Round16 -> Quarter
      const r16r_connections = [
        { s1: 91, s2: 92, t: 99 },
        { s1: 95, s2: 96, t: 100 },
      ];
      r16r_connections.forEach(({ s1, s2, t }) => {
        const m1 = findById(round16_right, s1);
        const m2 = findById(round16_right, s2);
        const mt = findById(quarter_right, t);
        if (m1 && m2 && mt) drawConnector(m1, vc(7), m2, vc(7), mt, vc(6), false);
      });

      // RIGHT SIDE: Quarter -> Semi 102
      if (quarter_right.length === 2) {
        const semiMatch = findById(semi, 102);
        if (semiMatch) drawConnector(quarter_right[0], vc(6), quarter_right[1], vc(6), semiMatch, vc(5), false);
      }

      // RIGHT SIDE: Semi 102 -> Final (horizontal line at semi's center Y)
      const semi102 = findById(semi, 102);
      if (semi102 && final.length > 0) {
        const s = getCardCenter(semi102, vc(5));
        const fColX = PADDING + vc(4) * COL_WIDTH;
        const fCardRightX = fColX + (COLUMN_WIDTH - CARD_W) / 2 + CARD_W;
        const GAP = 14;
        lines.push(
          <Line key={lineKey++}
            x1={s.leftX} y1={s.centerY}
            x2={fCardRightX + GAP} y2={s.centerY}
            stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} />
        );
      }

      return lines;
    };

    // Fetch data when component mounts or comes into focus, or when edit mode changes
    useFocusEffect(
      React.useCallback(() => {
        fetchPredictions().then(() => {
          if (editMode) {
            refreshFineCount();
          }
        });
      }, [editMode])
    );

    const handleEditModeToggle = async () => {
      if (!editMode) {
        if (!canEditDrafts) {
          setErrorModal({ title: 'Cannot Edit', message: 'Predictions cannot be edited while the knockout stage is active.' });
          return;
        }
        // Entering edit mode - create all drafts
        try {
          const userId = getCurrentUserId();
          if (!userId) {
            setErrorModal({ title: 'Error', message: 'User not authenticated', goBack: true });
            return;
          }
          
          setLoading(true);
          await apiService.createAllDrafts(userId);
          setEditMode(true);
          // fetchPredictions and refreshFineCount will be called by useFocusEffect when editMode changes
        } catch (error) {
          console.error('Error creating drafts:', error);
          setErrorModal({ title: 'Error', message: 'Cannot enter edit mode. Please try again.' });
        } finally {
          setLoading(false);
        }
      } else {
        // Exiting edit mode - check for unsaved changes first
        const userId = getCurrentUserId();
        if (!userId) return;
        try {
          const countResult = await apiService.getDraftChangesCount(userId);
          if (countResult.free_changes !== undefined) {
            setFreeChanges(countResult.free_changes ?? 0);
          }
          if (countResult.changes_count === 0) {
            try {
              setLoading(true);
              await apiService.deleteAllDrafts(userId);
              setEditMode(false);
              setFineInfo(null);
            } catch (error) {
              console.error('Error exiting edit mode:', error);
              setErrorModal({ title: 'Error', message: 'Could not exit edit mode. Please try again.' });
            } finally {
              setLoading(false);
            }
          } else {
            setFineInfo(countResult);
            setShowExitModal(true);
          }
        } catch (error) {
          console.error('Error checking draft changes:', error);
          setErrorModal({ title: 'Error', message: 'Could not exit edit mode. Please try again.' });
        }
      }
    };

    const executeExit = async (navAction?: any) => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;
        setLoading(true);
        await apiService.deleteAllDrafts(userId);
        setEditMode(false);
        setFineInfo(null);
        if (navAction) {
          navigation.dispatch(navAction);
        }
      } catch (error) {
        console.error('Error exiting edit mode:', error);
        setErrorModal({ title: 'Error', message: 'Could not exit edit mode. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    const handleEnterEditMode = async () => {
      setIsEnterEditModeModalVisible(false);
      if (!canEditDrafts) {
        setErrorModal({ title: 'Cannot Edit', message: 'Predictions cannot be edited while the knockout stage is active.' });
        return;
      }
      try {
        const userId = getCurrentUserId();
        if (!userId) return;
        setLoading(true);
        await apiService.createAllDrafts(userId);
        setEditMode(true);
      } catch (error) {
        console.error('Error creating drafts:', error);
        setErrorModal({ title: 'Error', message: 'Cannot enter edit mode. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    const handleResetDrafts = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      try {
        const countResult = await apiService.getDraftChangesCount(userId);
        if (countResult.free_changes !== undefined) {
          setFreeChanges(countResult.free_changes ?? 0);
        }
        if (countResult.changes_count === 0) {
          showToast('No changes to reset', 'info');
          return;
        }
        setFineInfo(countResult);
        setShowResetModal(true);
      } catch (error) {
        console.error('Error checking draft changes:', error);
        setErrorModal({ title: 'Error', message: 'Could not reset. Please try again.' });
      }
    };

    const handleBracketResetPress = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      try {
        setIsLoadingResetPreview(true);
        const preview = await apiService.getBracketResetPreview(userId);
        setBracketResetPreview(preview);
        setShowBracketResetModal(true);
      } catch (e) {
        setErrorModal({ title: 'Error', message: 'Could not load reset info. Please try again.' });
      } finally {
        setIsLoadingResetPreview(false);
      }
    };

    const handleConfirmBracketReset = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      setShowBracketResetModal(false);
      try {
        setLoading(true);
        const result = await apiService.applyBracketReset(userId);
        setHasUsedBracketReset(true);
        showToast(`Bracket reset! Fine: -${result.penalty_applied} pts`, 'success');
        await fetchPredictions();
      } catch (e) {
        setErrorModal({ title: 'Error', message: 'Reset failed. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    const executeReset = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;
        setLoading(true);
        await apiService.resetDrafts(userId);
        await fetchPredictions();
        setFineInfo({ changes_count: 0, penalty_per_change: 0, total_penalty: 0 });
      } catch (error) {
        console.error('Error resetting drafts:', error);
        setErrorModal({ title: 'Error', message: 'Could not reset changes. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    const executeCommit = async (userId: number) => {
      try {
        setLoading(true);
        const result = await apiService.commitDrafts(userId);

        setEditMode(false);
        setFineInfo(null);
        setSaveSuccessInfo({
          changes_count: result.changes_count,
          penalty_applied: result.penalty_applied,
        });
        await fetchPredictions();
      } catch (error) {
        console.error('Error committing drafts:', error);
        setErrorModal({ title: 'Error', message: 'Save failed. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    const handleSavePress = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) return;

        const countResult = await apiService.getDraftChangesCount(userId);
        if (countResult.free_changes !== undefined) {
          setFreeChanges(countResult.free_changes ?? 0);
        }

        if (countResult.changes_count === 0) {
          showToast('No changes to save', 'info');
          return;
        }

        setFineInfo(countResult);
        setIsConfirmSaveModalVisible(true);
      } catch (error) {
        console.error('Error in save press:', error);
        setErrorModal({ title: 'Error', message: 'Cannot save at this time. Please try again.' });
      }
    };

    const handleConfirmSave = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      setIsConfirmSaveModalVisible(false);
      try {
        setLoading(true);
        const result = await apiService.commitDrafts(userId);
        setEditMode(false);
        setFineInfo(null);
        setSaveSuccessInfo({
          changes_count: result.changes_count,
          penalty_applied: result.penalty_applied,
        });
        await fetchPredictions();
      } catch (error: any) {
        const detail = error?.detail || error?.message || '';
        if (typeof detail === 'string' && detail.startsWith('DUPLICATE_WINNERS:')) {
          const teams = detail.split(':')[1]?.trim().split(', ') ?? [];
          setDuplicateWinnersModal(teams);
        } else {
          setErrorModal({ title: 'Error', message: 'Save failed. Please try again.' });
        }
      } finally {
        setLoading(false);
      }
    };

    const handleMatchPress = (match: BracketMatch) => {
      setSelectedMatch(match);

      if (isPreTournament) {
        // Pre-tournament: always allow direct edit
        setIsModalVisible(true);
        return;
      }

      // Post-tournament
      if (editMode) {
        // In edit mode: check if this specific prediction is editable
        if (match.is_editable === false) {
          setShowNotEditableModal(true);
        } else {
          setIsModalVisible(true);
        }
      } else {
        // Not in edit mode: check if editable before prompting
        if (match.is_editable === false) {
          setShowNotEditableModal(true);
        } else {
          setIsEnterEditModeModalVisible(true);
        }
      }
    };

    const captureBracket = async () => {
      if (Platform.OS === 'android') return;

      if (!bracketRef.current) {
        setErrorModal({ title: 'Error', message: 'Cannot capture bracket at this time.' });
        return;
      }
      try {
        setIsCapturing(true);
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          setErrorModal({ title: 'Permission Required', message: 'Photo library access is required to save bracket images.' });
          return;
        }
        const uri = await captureRef(bracketRef.current, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
          useRenderInContext: true,
        });
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('Bracket Screenshots', asset, false);
        showToast('Bracket saved to photos!', 'success');
      } catch (error) {
        console.error('Error capturing bracket:', error);
        setErrorModal({ title: 'Error', message: 'Could not save bracket to photos. Please try again.' });
      } finally {
        setIsCapturing(false);
      }
    };

    const shareBracket = async () => {
      if (!bracketRef.current) return;
      try {
        setIsCapturing(true);
        const uri = await captureRef(bracketRef.current, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
          useRenderInContext: true,
        });
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          setErrorModal({ title: 'Not Available', message: 'Sharing is not available on this device.' });
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your bracket',
        });
      } catch (error) {
        console.error('Error sharing bracket:', error);
        setErrorModal({ title: 'Error', message: 'Could not share bracket. Please try again.' });
      } finally {
        setIsCapturing(false);
      }
    };

    const renderColumn = (title: string, matches: BracketMatch[], isFinal = false, columnIndex = 0) => {
      if (matches.length === 0) return null;

      return (
        <View
          style={[
            styles.column,
            isFinal && styles.finalColumn,
            { width: COLUMN_WIDTH },
            isFinal && { zIndex: 10 },
          ]}
        >
          {/* Remove column titles to save space */}
          <View style={[styles.matchesContainer, { minHeight: totalBracketHeight + Y_OFFSET }]}>
            {matches.map((match, index) => {
              // For final cards, shift the wrapper UP so the card itself sits at the correct Y
              const isThisFinal = match.stage === 'final';
              const calculatedMarginTop = Math.max(
                0,
                (match.verticalPosition || index) * spacing + Y_OFFSET - (isThisFinal ? FINAL_WRAPPER_ABOVE_CARD : 0)
              );

              return (
              <View 
                key={match.id} 
                style={[
                  styles.matchWrapper,
                  { marginTop: calculatedMarginTop },
                  isFinal && { zIndex: 10, elevation: 10 },
                ]}
              >
                <BracketMatchCard
                  match={match}
                  onPress={handleMatchPress}
                  isModified={editMode && match.is_winner_modified === true}
                  scaleFactor={scaleFactor}
                />
              </View>
              );
            })}
          </View>
        </View>
      );
    };

    // Function to render all bracket columns
    const renderBracketColumns = () => {
      if (!organizedBracket) return null;

      return (
        <>
          {renderColumn('Round of 32 (Left)', organizedBracket.round32_left, false, 0)}
          {renderColumn('Round of 16 (Left)', organizedBracket.round16_left, false, 1)}
          {renderColumn('Quarter (Left)', organizedBracket.quarter_left, false, 2)}
          {renderColumn('Semi 101', organizedBracket.semi.filter(match => match.id === 101), false, 3)}
          {renderColumn('Final', organizedBracket.final, true, 4)}
          {renderColumn('Semi 102', organizedBracket.semi.filter(match => match.id === 102), false, 5)}
          {renderColumn('Quarter (Right)', organizedBracket.quarter_right, false, 6)}
          {renderColumn('Round of 16 (Right)', organizedBracket.round16_right, false, 7)}
          {renderColumn('Round of 32 (Right)', organizedBracket.round32_right, false, 8)}
        </>
      );
    };


    if (loading) {
      return (
        <View style={[styles.loadingContainer, { direction: 'ltr' }]}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading bracket...</Text>
          <ErrorModal
            visible={!!errorModal}
            title={errorModal?.title ?? 'Error'}
            message={errorModal?.message ?? ''}
            onClose={() => setErrorModal(null)}
            {...(errorModal?.goBack && {
              onGoBack: () => { setErrorModal(null); navigation.goBack(); },
              goBackLabel: 'Go Back',
            })}
          />
        </View>
      );
    }

    if (!organizedBracket) {
      return (
        <>
          <View style={[styles.errorContainer, { direction: 'ltr' }]}>
            <Ionicons name="cloud-offline-outline" size={56} color="#f87171" />
            <Text style={styles.emptyTitle}>Could not load bracket</Text>
            <Text style={styles.emptySubtitle}>Please check your connection and try again</Text>
          </View>
          <ErrorModal
            visible={!!errorModal}
            title={errorModal?.title ?? 'Error'}
            message={errorModal?.message ?? ''}
            onClose={() => setErrorModal(null)}
            {...(errorModal?.goBack && {
              onGoBack: () => { setErrorModal(null); navigation.goBack(); },
              goBackLabel: 'Go Back',
            })}
          />
        </>
      );
    }

    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={[styles.container, { pointerEvents: 'box-none', direction: 'ltr' }]}>
        {/* Subtle dot-grid background */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          {Array.from({ length: Math.ceil(screenHeight / 28) }).map((_, row) =>
            Array.from({ length: Math.ceil(screenWidth / 28) }).map((_, col) => (
              <View
                key={`${row}-${col}`}
                style={{
                  position: 'absolute',
                  top: row * 28 + (col % 2 === 0 ? 0 : 14),
                  left: col * 28,
                  width: 2,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                }}
              />
            ))
          )}
        </View>
        {/* Buttons Container - chip left, buttons right */}
        <View style={styles.buttonsContainer}>
          {editMode ? (() => {
            const cc = fineInfo?.changes_count ?? 0;
            const penaltyPer = fineInfo?.penalty_per_change ?? 0;
            const freeAvailable = freeChanges;
            const isAllFree = hasUsedBracketReset && currentStage === 'PRE_ROUND32';
            const freeRemaining = isAllFree ? freeAvailable : Math.max(0, freeAvailable - cc);
            const paidChanges = isAllFree ? 0 : Math.max(0, cc - freeAvailable);
            const actualPenalty = paidChanges * penaltyPer;
            const freeUsed = isAllFree ? 0 : Math.min(cc, freeAvailable);
            return (
              <View style={[styles.fineChip, { maxWidth: 160 }]}>
                <View style={styles.fineStat}>
                  <Text style={styles.fineStatLabel}>Changes</Text>
                  <Text style={styles.fineStatValue}>{cc}</Text>
                </View>
                {freeAvailable > 0 && !isPreTournament && (
                  <>
                    <View style={styles.fineDivider} />
                    <View style={styles.fineStat}>
                      <Text style={styles.fineStatLabel}>Free</Text>
                      <Text style={[styles.fineStatValue, { color: '#4ade80' }]}>{freeRemaining}</Text>
                    </View>
                  </>
                )}
                <View style={styles.fineDivider} />
                <View style={styles.fineStat}>
                  <Text style={styles.fineStatLabel}>Fine</Text>
                  {isAllFree ? (
                    <Text style={styles.fineStatFree}>FREE</Text>
                  ) : isPreTournament && actualPenalty === 0 ? (
                    <Text style={styles.fineStatFree}>Free!</Text>
                  ) : actualPenalty === 0 ? (
                    <Text style={styles.fineStatValue}>0</Text>
                  ) : (
                    <Text style={[styles.fineStatValue, { color: '#f87171' }]}>
                      -{actualPenalty}
                    </Text>
                  )}
                </View>
              </View>
            );
          })() : knockoutScore !== null ? (
            <View style={[styles.knockoutScoreChip, { maxWidth: 110 }]}>
              <Text style={styles.knockoutScoreValue}>{knockoutScore}</Text>
              <Text style={styles.knockoutScoreLabel}>points</Text>
            </View>
          ) : (
            <View style={styles.buttonsSpacer} />
          )}

          <View style={styles.buttonsRow}>
            {!isPreTournament && (
              <TouchableOpacity
                style={[
                  styles.editButton,
                  editMode && styles.editButtonActive,
                  (!editMode && !canEditDrafts) && { opacity: 0.4 },
                ]}
                onPress={handleEditModeToggle}
                disabled={loading || (!editMode && !canEditDrafts)}
              >
                <Ionicons name={editMode ? 'log-out-outline' : 'create-outline'} size={18} color="#fff" />
              </TouchableOpacity>
            )}

            {editMode && (
              <>
                <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.resetButton} onPress={handleResetDrafts}>
                  <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.actionButtonText}>Reset</Text>
                </TouchableOpacity>
              </>
            )}

            {currentStage === 'PRE_ROUND32' && !editMode && !hasUsedBracketReset && (
              <TouchableOpacity
                style={styles.bracketResetButton}
                onPress={handleBracketResetPress}
                disabled={isLoadingResetPreview}
              >
                {isLoadingResetPreview
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="refresh-circle-outline" size={20} color="#fff" />
                }
              </TouchableOpacity>
            )}

            {!editMode && (
              <>
                {Platform.OS !== 'android' && (
                  <TouchableOpacity style={styles.screenshotButton} onPress={captureBracket} disabled={isCapturing}>
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.shareButton} onPress={shareBracket} disabled={isCapturing}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={[styles.scrollContent, { paddingLeft: BRACKET_PADDING_LEFT }]}
          style={[styles.scrollView, { marginTop: 44 }]}
          onScroll={() => {
            if (showScrollHint) {
              Animated.timing(scrollHintOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(() => setShowScrollHint(false));
            }
          }}
          scrollEventThrottle={16}
        >
          {renderBracketColumns()}
          <Svg
            style={[styles.bracketLines, { height: totalBracketHeight + Y_OFFSET + 60, zIndex: 0 }]}
            width={screenWidth * 3}
            height={totalBracketHeight + Y_OFFSET + 60}
            pointerEvents="none"
          >
            {drawBracketLines(BRACKET_PADDING_LEFT)}
          </Svg>

          {/* hidden view removed - rendered outside ScrollView below */}
        </ScrollView>

        {/* hidden bracket moved outside main container */}

        {/* Inline Toast */}
        {toastMsg && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        {/* Info Modal */}
        <Modal visible={showInfo} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowInfo(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: '#1e293b', direction: IS_RTL ? 'rtl' : 'ltr' }]} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
                <Text style={[styles.modalTitle, { color: '#f1f5f9', textAlign: 'left' }]}>
                  {t('bracket.legendTitle')}
                </Text>
                <TouchableOpacity onPress={() => setShowInfo(false)}>
                  <Ionicons name="close" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {(() => {
                const isPostGroupStage = currentStage != null &&
                  currentStage !== 'PRE_GROUP_STAGE' &&
                  !['GROUP_CYCLE_1', 'GROUP_CYCLE_2', 'GROUP_CYCLE_3'].includes(currentStage);

                const colorLegendRows: { borderColor: string; prefix: string; prefixColor: string; suffix: string }[] = [
                  { borderColor: '#cbd5e1', prefix: t('bracket.validLabel'), prefixColor: '#cbd5e1', suffix: t('bracket.validDesc') },
                  { borderColor: '#ef4444', prefix: t('bracket.invalidLabel'), prefixColor: '#ef4444', suffix: t('bracket.invalidDesc') },
                ];
                if (isPostGroupStage) {
                  colorLegendRows.push({
                    borderColor: '#fb923c',
                    prefix: t('bracket.unreachableLabel'),
                    prefixColor: '#fb923c',
                    suffix: t('bracket.unreachableDesc'),
                  });
                }

                const buttonRows: { icon: string; color: string; label: string }[] = [];
                if (!editMode) {
                  buttonRows.push({ icon: 'camera-outline', color: '#1e3a8a', label: t('bracket.btnCamera') });
                  buttonRows.push({ icon: 'share-outline', color: '#0369a1', label: t('bracket.btnShare') });
                }
                if (!isPreTournament && !editMode && canEditDrafts) {
                  buttonRows.push({ icon: 'create-outline', color: '#0f766e', label: t('bracket.btnEdit') });
                }
                if (currentStage === 'PRE_ROUND32' && !editMode && !hasUsedBracketReset) {
                  buttonRows.push({ icon: 'refresh-circle-outline', color: '#7c3aed', label: t('bracket.btnBracketReset') });
                }
                if (editMode) {
                  buttonRows.push({ icon: 'checkmark-circle-outline', color: '#15803d', label: t('bracket.btnSave') });
                  buttonRows.push({ icon: 'refresh-outline', color: '#475569', label: t('bracket.btnReset') });
                  buttonRows.push({ icon: 'log-out-outline', color: '#9a3412', label: t('bracket.btnExit') });
                }
                const sectionHeaderBase = { marginBottom: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'center' as const };
                const sectionHeaderText = { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1, color: '#94a3b8' };
                return (
                  <>
                    <View style={[sectionHeaderBase, { backgroundColor: 'rgba(45, 74, 110, 0.6)' }]}>
                      <Text style={sectionHeaderText}>{t('bracket.sectionCardColors')}</Text>
                    </View>
                    {colorLegendRows.map((row, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 }}>
                        <View style={{
                          width: 28, height: 20, borderRadius: 6,
                          borderWidth: 2, borderColor: row.borderColor,
                          backgroundColor: '#0f2744',
                          flexShrink: 0,
                          marginTop: 2,
                        }} />
                        <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: '#cbd5e1', textAlign: 'left' }}>
                          <Text style={{ color: row.prefixColor, fontWeight: '700' }}>{row.prefix}</Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 13 }}>{row.suffix}</Text>
                        </Text>
                      </View>
                    ))}
                    {buttonRows.length > 0 && (
                      <>
                        <View style={{ height: 1, backgroundColor: '#2d4a6e', marginVertical: 12, width: '100%' }} />
                        <View style={[sectionHeaderBase, { backgroundColor: 'rgba(71, 85, 105, 0.5)' }]}>
                          <Text style={sectionHeaderText}>{t('bracket.sectionButtons')}</Text>
                        </View>
                        {buttonRows.map((row, i) => (
                          <View key={`btn-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                            <Ionicons name={row.icon as any} size={20} color={row.color} />
                            <Text style={{ flex: 1, fontSize: 13, color: '#cbd5e1', lineHeight: 18, textAlign: 'left' }}>{row.label}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Enter Edit Mode Modal */}
        <EnterEditModeModal
          visible={isEnterEditModeModalVisible}
          onClose={() => setIsEnterEditModeModalVisible(false)}
          onEnterEditMode={handleEnterEditMode}
        />

        {/* Confirm Save Modal */}
        <ConfirmSaveModal
          visible={isConfirmSaveModalVisible}
          changesCount={fineInfo?.changes_count ?? 0}
          finePoints={0}
          finePerChange={fineInfo?.penalty_per_change ?? 0}
          onClose={() => setIsConfirmSaveModalVisible(false)}
          onConfirm={handleConfirmSave}
          freeChangesInfo={(() => {
            const cc = fineInfo?.changes_count ?? 0;
            const penaltyPer = fineInfo?.penalty_per_change ?? 0;
            const freeAvailable = freeChanges;
            const isAllFree = hasUsedBracketReset && currentStage === 'PRE_ROUND32';
            const freeRemaining = isAllFree ? freeAvailable : Math.max(0, freeAvailable - cc);
            const paidChanges = isAllFree ? 0 : Math.max(0, cc - freeAvailable);
            const actualPenalty = paidChanges * penaltyPer;
            const freeUsed = isAllFree ? 0 : Math.min(cc, freeAvailable);
            return {
              changesCount: cc,
              freeAvailable,
              freeRemaining,
              paidChanges,
              freeUsed,
              actualPenalty,
            };
          })()}
        />

        {/* Confirm Reset Modal */}
        <ConfirmResetModal
          visible={showResetModal}
          changesCount={fineInfo?.changes_count ?? 0}
          onClose={() => setShowResetModal(false)}
          onConfirm={async () => {
            setShowResetModal(false);
            await executeReset();
          }}
        />

        {/* Confirm Exit Modal */}
        <ConfirmExitModal
          visible={showExitModal}
          changesCount={fineInfo?.changes_count ?? 0}
          onClose={() => {
            setShowExitModal(false);
            pendingNavActionRef.current = null;
          }}
          onConfirm={async () => {
            setShowExitModal(false);
            await executeExit(pendingNavActionRef.current);
            pendingNavActionRef.current = null;
          }}
        />

        {/* Not Editable Modal */}
        <Modal visible={showNotEditableModal} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowNotEditableModal(false)}
          >
            <View style={styles.modalCard}>
              <Ionicons name="lock-closed" size={48} color="#64748b" />
              <Text style={styles.modalTitle}>Not Editable</Text>
              <Text style={styles.modalSubtitle}>
                This prediction is locked and cannot be edited at this stage.
              </Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowNotEditableModal(false)}>
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Bracket Reset Modal */}
        <Modal visible={showBracketResetModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowBracketResetModal(false)}>
            <Pressable style={styles.bracketResetModalCard} onPress={e => e.stopPropagation()}>

              <ScrollView
                showsVerticalScrollIndicator={false}
                centerContent={false}
                style={styles.bracketResetScroll}
                contentContainerStyle={styles.bracketResetScrollContent}
              >
                <View style={styles.bracketResetIconCircle}>
                  <Ionicons name="refresh-circle" size={34} color="#7c3aed" />
                </View>

                <Text style={styles.bracketResetModalTitle} maxFontSizeMultiplier={1}>Reset Bracket</Text>

                <Text style={styles.bracketResetModalSubtitle} maxFontSizeMultiplier={1.2}>
                  Resets ALL knockout predictions using the actual Round of 32 teams. Winners will be cleared so you can start fresh.{'\n'}
                  <Text style={{ color: '#dc2626', fontWeight: '700' }} maxFontSizeMultiplier={1.2}>This can only be done once.</Text>
                  {'\n\n'}
                  <Text style={{ color: '#16a34a', fontWeight: '600' }} maxFontSizeMultiplier={1.1}>✓ All edits after the reset are free — no fines.</Text>
                </Text>

                <View style={styles.bracketResetDivider} />

                <Text style={styles.bracketResetCostTitle} maxFontSizeMultiplier={1}>RESET COST</Text>

                <View style={styles.bracketResetPenaltyHero}>
                  <Text style={styles.bracketResetPenaltyNum} maxFontSizeMultiplier={1}>
                    -{bracketResetPreview?.penalty ?? 0}
                  </Text>
                  <Text style={styles.bracketResetPenaltyLabel} maxFontSizeMultiplier={1}>points deducted</Text>
                </View>

                <View style={styles.bracketResetBreakdownRow}>
                  <View style={styles.bracketResetBreakdownBox}>
                    <Text style={styles.bracketResetBreakdownNum_red} maxFontSizeMultiplier={1}>{bracketResetPreview?.invalid_count ?? 0}</Text>
                    <Text style={styles.bracketResetBreakdownLabel} maxFontSizeMultiplier={1}>Invalid</Text>
                    <Text style={styles.bracketResetBreakdownMult} maxFontSizeMultiplier={1}>× 1 pt each</Text>
                  </View>
                  <View style={styles.bracketResetBreakdownDivider} />
                  <View style={styles.bracketResetBreakdownBox}>
                    <Text style={styles.bracketResetBreakdownNum_yellow} maxFontSizeMultiplier={1}>{bracketResetPreview?.unreachable_count ?? 0}</Text>
                    <Text style={styles.bracketResetBreakdownLabel} maxFontSizeMultiplier={1}>Unreachable</Text>
                    <Text style={styles.bracketResetBreakdownMult} maxFontSizeMultiplier={1}>× 0.5 pt each</Text>
                  </View>
                </View>

              </ScrollView>

              <View style={styles.bracketResetButtonsRow}>
                <TouchableOpacity style={styles.bracketResetCancelBtn} onPress={() => setShowBracketResetModal(false)}>
                  <Text style={styles.bracketResetCancelText} maxFontSizeMultiplier={1}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bracketResetConfirmBtn} onPress={handleConfirmBracketReset}>
                  <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.bracketResetConfirmText} maxFontSizeMultiplier={1}>Confirm Reset</Text>
                </TouchableOpacity>
              </View>

            </Pressable>
          </Pressable>
        </Modal>

        {/* Save Success Modal */}
        <Modal visible={saveSuccessInfo !== null} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSaveSuccessInfo(null)}
          >
            <View style={styles.modalCard}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#86efac',
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Ionicons name="checkmark-circle" size={36} color="#16a34a" />
              </View>
              <Text style={styles.modalTitle}>Saved Successfully</Text>
              
              <View style={{
                flexDirection: 'row', gap: 16, marginTop: 4, marginBottom: 20,
              }}>
                <View style={{
                  backgroundColor: '#f1f5f9', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#1e293b' }}>
                    {saveSuccessInfo?.changes_count ?? 0}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 }}>
                    Changes
                  </Text>
                </View>
                <View style={{
                  backgroundColor: (saveSuccessInfo?.penalty_applied ?? 0) > 0 ? '#fef2f2' : '#f1f5f9',
                  borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
                  borderWidth: (saveSuccessInfo?.penalty_applied ?? 0) > 0 ? 1.5 : 0,
                  borderColor: '#fca5a5',
                }}>
                  <Text style={{
                    fontSize: 22, fontWeight: '800',
                    color: (saveSuccessInfo?.penalty_applied ?? 0) > 0 ? '#dc2626' : '#1e293b',
                  }}>
                    -{saveSuccessInfo?.penalty_applied ?? 0}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 }}>
                    Fine pts
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setSaveSuccessInfo(null)}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Duplicate Winners Modal */}
        <Modal visible={duplicateWinnersModal !== null} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setDuplicateWinnersModal(null)}>
            <View style={styles.modalCard}>
              <Ionicons name="warning-outline" size={48} color="#f59e0b" />
              <Text style={styles.modalTitle}>Duplicate Winners</Text>
              <Text style={styles.modalSubtitle}>
                The following teams are selected as winners more than once in the same stage. Please fix before saving:
              </Text>
              <View style={{ alignSelf: 'flex-start', width: '100%', marginBottom: 8 }}>
                {duplicateWinnersModal?.map((name, i) => (
                  <Text key={i} style={{ fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                    • {name}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#f59e0b' }]}
                onPress={() => setDuplicateWinnersModal(null)}
              >
                <Text style={styles.modalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Match Edit Modal - OUTSIDE ScrollView */}
        <MatchEditModal
          visible={isModalVisible}
          match={selectedMatch}
          onClose={() => { setIsModalVisible(false); setDuplicateWinnersModal(null); }}
          onSave={async (matchId, winnerId) => {
            console.log(`💾 Saving match ${matchId} with winner ${winnerId}`);
            try {
              const prediction = predictions.find(p => p.template_match_id === matchId);
              if (!prediction) {
                console.error('Prediction not found for match', matchId);
                setIsModalVisible(false);
                return;
              }

              const winnerTeamNumber = winnerId === prediction.team1_id ? 1 : 2;
              const winnerTeamName = winnerId === prediction.team1_id ? (prediction.team1_name || '') : (prediction.team2_name || '');

              await apiService.updateKnockoutPrediction(
                prediction.id,
                winnerTeamNumber,
                winnerTeamName,
                editMode
              );

              // Success — close modal immediately
              setIsModalVisible(false);

              setTimeout(async () => {
                try {
                  const userId = getCurrentUserId();
                  if (!userId) return;
                  const freshPredictions = await apiService.getKnockoutPredictions(userId, undefined, editMode);
                  setPredictions(freshPredictions.predictions);
                  const { organized, calculateCardCoordinates } = organizeBracketMatches(freshPredictions.predictions);
                  const cardHeight = Math.round(60 * scaleFactor);
                  calculateCardCoordinates(spacing, cardHeight);
                  setOrganizedBracket(organized);
                  await refreshFineCount();
                } catch (error) {
                  console.error('❌ Error updating bracket with fresh data:', error);
                }
              }, 500);

              const updatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
              const updatedMatches = JSON.parse(updatedMatchesStr);
              updatedMatches.push({ matchId, timestamp: Date.now() });
              await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(updatedMatches));

              console.log('✅ Match updated successfully');

            } catch (error: any) {
              console.error('❌ Error updating match:', error);
              setIsModalVisible(false);
              setErrorModal({ title: 'Error', message: 'Could not update match. Please try again.' });
              throw error; // re-throw so MatchEditModal can revert selectedWinner
            }
          }}
        />
        </View>
        <ErrorModal
          visible={!!errorModal}
          title={errorModal?.title ?? 'Error'}
          message={errorModal?.message ?? ''}
          onClose={() => setErrorModal(null)}
          {...(errorModal?.goBack && {
            onGoBack: () => { setErrorModal(null); navigation.goBack(); },
            goBackLabel: 'Go Back',
          })}
        />
        {showScrollHint && (
          <Animated.View
            style={[styles.scrollHint, { opacity: scrollHintOpacity }]}
            pointerEvents="none"
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Animated.View>
        )}

        {/* Hidden bracket for screenshot - standalone view outside all containers */}
        {organizedBracket && (() => {
          const screenshotPaddingTop = 120;
          return (
          <View
            ref={bracketRef}
            collapsable={false}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: screenHeight * 2,
              left: 0,
              width: TOTAL_BRACKET_WIDTH,
              height: totalBracketHeight + Y_OFFSET + 60 + screenshotPaddingTop,
              backgroundColor: '#0d1b2e',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: screenshotPaddingTop,
                backgroundColor: '#0d1b2e',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 14,
                zIndex: 10,
              }}
            >
              <Text
                style={{
                  color: '#f59e0b',
                  fontSize: 17,
                  letterSpacing: 11,
                  opacity: 0.6,
                }}
              >
                ✦  ✦  ✦  ✦  ✦
              </Text>
              <Text
                style={{
                  color: '#f59e0b',
                  fontSize: 44,
                  fontWeight: '900',
                  letterSpacing: 12,
                  marginTop: 4,
                }}
              >
                PREDICTO
              </Text>
              <View
                style={{
                  width: '45%',
                  height: 1.5,
                  backgroundColor: '#f59e0b',
                  opacity: 0.5,
                  marginTop: 8,
                }}
              />
            </View>
            <Svg
              style={[styles.bracketLines, {
                height: totalBracketHeight + Y_OFFSET + 60 + screenshotPaddingTop,
                top: screenshotPaddingTop,
                zIndex: 0,
              }]}
              width={TOTAL_BRACKET_WIDTH}
              height={totalBracketHeight + Y_OFFSET + 60 + screenshotPaddingTop}
              pointerEvents="none"
            >
              {drawBracketLines(60)}
            </Svg>
            <View style={{ flexDirection: 'row', paddingLeft: 60, paddingTop: 20 + screenshotPaddingTop }}>
              {renderColumn('Round of 32 (Left)', organizedBracket.round32_left, false, 0)}
              {renderColumn('Round of 16 (Left)', organizedBracket.round16_left, false, 1)}
              {renderColumn('Quarter (Left)', organizedBracket.quarter_left, false, 2)}
              {renderColumn('Semi 101', organizedBracket.semi.filter(m => m.id === 101), false, 3)}
              {renderColumn('Final', organizedBracket.final, true, 4)}
              {renderColumn('Semi 102', organizedBracket.semi.filter(m => m.id === 102), false, 5)}
              {renderColumn('Quarter (Right)', organizedBracket.quarter_right, false, 6)}
              {renderColumn('Round of 16 (Right)', organizedBracket.round16_right, false, 7)}
              {renderColumn('Round of 32 (Right)', organizedBracket.round32_right, false, 8)}
            </View>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 32,
                backgroundColor: '#0f172a',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <Text
                style={{
                  color: '#475569',
                  fontSize: 11,
                  letterSpacing: 2,
                }}
              >
                predicto.app
              </Text>
            </View>
          </View>
          );
        })()}
      </>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1e293b',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingRight: 20,
      paddingTop: 20,
      paddingBottom: 60,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e293b',
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: '#94a3b8',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e293b',
    },
    errorText: {
      fontSize: 16,
      color: '#e53e3e',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#e2e8f0',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: '#94a3b8',
      textAlign: 'center',
    },
    column: {
      marginRight: 20,
      alignItems: 'center',
      pointerEvents: 'box-none',
      zIndex: 2,
      overflow: 'visible',
    },
    finalColumn: {
      zIndex: 10,
      elevation: 10,
    },
    // Removed column titles to save space
    matchesContainer: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      flex: 1,
      paddingBottom: 40, // Extra padding to prevent cutoff (increased from 20)
      pointerEvents: 'box-none',
    },
    matchWrapper: {
      alignItems: 'center',
      position: 'absolute',
      width: '100%',
      zIndex: 2,
    },
    semiFinalsContainer: {
      marginBottom: 16,
    },
    finalContainer: {
      borderTopWidth: 2,
      borderTopColor: '#667eea',
      paddingTop: 16,
    },
    bracketLines: {
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 0,
      pointerEvents: 'none',
    },
    buttonsContainer: {
      position: 'absolute',
      top: 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 1000,
      paddingLeft: 12,
      paddingRight: 12,
      gap: 8,
      minWidth: 0,
    },
    buttonsSpacer: {},
    buttonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      flexWrap: 'nowrap',
    },
    editButton: {
      backgroundColor: '#0f766e',
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    editButtonActive: {
      backgroundColor: '#9a3412',
    },
    editButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    resetButton: {
      backgroundColor: '#475569',
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexShrink: 1,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    saveButton: {
      backgroundColor: '#15803d',
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    screenshotButton: {
      backgroundColor: '#1e3a8a',
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    shareButton: {
      backgroundColor: '#0369a1',
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    scrollHint: {
      position: 'absolute',
      right: 12,
      top: '50%',
      marginTop: -18,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    screenshotButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    bracketResetModalCard: {
      backgroundColor: '#ffffff',
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      width: '100%',
      maxHeight: '92%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 12,
    },
    bracketResetScroll: {
      width: '100%',
      flexShrink: 1,
    },
    bracketResetScrollContent: {
      flexGrow: 0,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingBottom: 8,
    },
    bracketResetIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#f3f0ff',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      borderWidth: 2,
      borderColor: '#ddd6fe',
    },
    bracketResetModalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#1e293b',
      marginBottom: 8,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    bracketResetModalSubtitle: {
      fontSize: 13,
      color: '#64748b',
      textAlign: 'center',
      width: '100%',
      marginBottom: 0,
    },
    bracketResetDivider: {
      width: '100%',
      height: 1,
      backgroundColor: '#f1f5f9',
      marginTop: 10,
      marginBottom: 10,
    },
    bracketResetCostTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: '#94a3b8',
      letterSpacing: 1.5,
      marginBottom: 8,
      textAlign: 'center',
    },
    bracketResetPenaltyHero: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fef2f2',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 32,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: '#fca5a5',
      width: '100%',
    },
    bracketResetPenaltyNum: {
      fontSize: 40,
      fontWeight: '900',
      color: '#dc2626',
      letterSpacing: -1,
    },
    bracketResetPenaltyLabel: {
      fontSize: 12,
      color: '#ef4444',
      fontWeight: '600',
      marginTop: 2,
    },
    bracketResetBreakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      backgroundColor: '#f8fafc',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    bracketResetBreakdownBox: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    bracketResetBreakdownNum_red: {
      fontSize: 24,
      fontWeight: '800',
      color: '#dc2626',
    },
    bracketResetBreakdownNum_yellow: {
      fontSize: 24,
      fontWeight: '800',
      color: '#b45309',
    },
    bracketResetBreakdownLabel: {
      fontSize: 11,
      color: '#475569',
      fontWeight: '600',
    },
    bracketResetBreakdownMult: {
      fontSize: 10,
      color: '#94a3b8',
      fontWeight: '500',
    },
    bracketResetBreakdownDivider: {
      width: 1,
      height: 44,
      backgroundColor: '#e2e8f0',
    },
    bracketResetButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      paddingTop: 16,
      flexShrink: 0,
    },
    bracketResetCancelBtn: {
      flex: 1,
      backgroundColor: '#f1f5f9',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bracketResetCancelText: {
      color: '#64748b',
      fontWeight: '700',
      fontSize: 15,
    },
    bracketResetConfirmBtn: {
      flex: 2,
      backgroundColor: '#7c3aed',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    bracketResetConfirmText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
    },
    bracketResetButton: {
      backgroundColor: '#7c3aed',
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    fineChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexShrink: 1,
      minWidth: 0,
      backgroundColor: 'rgba(30,30,30,0.55)',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      gap: 6,
      marginLeft: 4,
    },
    knockoutScoreChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexShrink: 1,
      backgroundColor: '#152a45',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
      marginLeft: 4,
      borderWidth: 1.5,
      borderColor: '#2d4a6e',
    },
    knockoutScoreLabel: {
      fontSize: 11,
      color: '#94a3b8',
      fontWeight: '500',
    },
    knockoutScoreValue: {
      fontSize: 16,
      color: '#e2e8f0',
      fontWeight: '700',
    },
    fineStat: {
      alignItems: 'center',
    },
    fineStatLabel: {
      fontSize: 8,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    fineStatValue: {
      fontSize: 11,
      color: '#ffffff',
      fontWeight: '700',
    },
    fineStatFree: {
      fontSize: 10,
      fontWeight: '800',
      color: '#4ade80',
    },
    fineDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    toast: {
      position: 'absolute',
      bottom: 40,
      left: 24,
      right: 24,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    toastText: {
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      fontSize: 14,
      fontWeight: '500',
      overflow: 'hidden',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1e293b',
      marginTop: 12,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    modalButton: {
      backgroundColor: '#16a34a',
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
