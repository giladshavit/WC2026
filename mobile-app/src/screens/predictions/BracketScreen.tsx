import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { apiService, KnockoutPrediction } from '../../services/api';
import BracketMatchCard from '../../components/BracketMatchCard';
import MatchEditModal from '../../components/MatchEditModal';
import EnterEditModeModal from '../../components/EnterEditModeModal';
import ConfirmSaveModal from '../../components/ConfirmSaveModal';
import ConfirmResetModal from '../../components/ConfirmResetModal';
import ConfirmExitModal from '../../components/ConfirmExitModal';
import { organizeBracketMatches, BracketMatch, OrganizedBracket } from '../../utils/bracketCalculator';
import { useTournament } from '../../contexts/TournamentContext';
import { useToast } from '../../components/Toast';
import { ErrorModal } from '../../components/CustomModals';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import Ionicons from '@expo/vector-icons/Ionicons';

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
  const Y_OFFSET = 20;
  const COLUMN_WIDTH = 110;
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [organizedBracket, setOrganizedBracket] = useState<OrganizedBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [canEditDrafts, setCanEditDrafts] = useState<boolean>(true);
  const [fineInfo, setFineInfo] = useState<{changes_count: number, penalty_per_change: number, total_penalty: number} | null>(null);
  const [knockoutScore, setKnockoutScore] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isEnterEditModeModalVisible, setIsEnterEditModeModalVisible] = useState(false);
  const [isConfirmSaveModalVisible, setIsConfirmSaveModalVisible] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showNotEditableModal, setShowNotEditableModal] = useState(false);
  const [saveSuccessInfo, setSaveSuccessInfo] = useState<{ changes_count: number; penalty_applied: number } | null>(null);
  
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

  // Get tournament context data
  const { currentStage, finePerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  const isPreTournament = currentStage === 'PRE_GROUP_STAGE' || !currentStage;

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Intercept back button/gesture when in edit mode
  useEffect(() => {
    if (!editMode) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      const checkChanges = async () => {
        const userId = getCurrentUserId();
        if (!userId) return;
        const countResult = await apiService.getDraftChangesCount(userId);
        setFineInfo(countResult);
        setShowExitModal(true);
        pendingNavActionRef.current = e.data.action;
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
      
      // Organize into bracket structure
      const { organized, calculateCardCoordinates } = organizeBracketMatches(allPredictions.predictions);
      
      // Calculate card coordinates with current spacing
      const spacing = (AVAILABLE_HEIGHT - 40) / 8;
      calculateCardCoordinates(spacing);
      
      setOrganizedBracket(organized);
      
    } catch (error) {
      console.error('Error fetching bracket predictions:', error);
      setErrorModal({ title: 'Error', message: 'Could not load bracket. Please try again.', goBack: true });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const drawBracketLines = () => {
    if (!organizedBracket) return [];
    const PADDING = 60; // must match scrollContent paddingLeft
    const SCROLL_PADDING_TOP = 21; // matches scrollContent paddingTop style
    const COL_WIDTH = COLUMN_WIDTH + 20; // column width + marginRight gap
    const CARD_W = 100; // must match BracketMatchCard container width
    const CARD_H = 68;  // must match BracketMatchCard container height
    const spacing = (AVAILABLE_HEIGHT - 40) / 8;
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
      lines.push(
        <Line key={lineKey++}
          x1={s.rightX} y1={s.centerY}
          x2={fCardLeftX} y2={s.centerY}
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
      lines.push(
        <Line key={lineKey++}
          x1={s.leftX} y1={s.centerY}
          x2={fCardRightX} y2={s.centerY}
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
    await executeCommit(userId);
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
    if (!bracketRef.current) {
      setErrorModal({ title: 'Error', message: 'Cannot capture bracket at this time.' });
      return;
    }

    try {
      setIsCapturing(true);

      // Request permission to save to photos
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setErrorModal({ title: 'Permission Required', message: 'Photo library access is required to save bracket images.' });
        return;
      }

      // Capture the entire bracket view (including off-screen parts)
      const uri = await captureRef(bracketRef.current, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile'
      });

      // Save to device photos
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


  const renderColumn = (title: string, matches: BracketMatch[], isFinal = false, columnIndex = 0) => {
    if (matches.length === 0) return null;

    // Calculate spacing based on available height
    // Reserve some space for margins, divide remaining by 8 matches
    const spacing = (AVAILABLE_HEIGHT - 40) / 8; // 40px for margins

    return (
      <View style={[styles.column, isFinal && styles.finalColumn, { width: COLUMN_WIDTH }]}>
        {/* Remove column titles to save space */}
        <View style={[styles.matchesContainer, { minHeight: AVAILABLE_HEIGHT + Y_OFFSET + 40 }]}>
          {matches.map((match, index) => {
            // For final cards, shift the wrapper UP so the card itself sits at the correct Y
            // winnerBanner(80) + marginBottom(2) + trophyWrapper(96) + marginBottom(6) = 184
            const FINAL_WRAPPER_ABOVE_CARD = 184;
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
                { marginTop: calculatedMarginTop }
              ]}
            >
              <BracketMatchCard
                match={match}
                onPress={handleMatchPress}
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
      <View style={styles.loadingContainer}>
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
        <View style={styles.errorContainer}>
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
      <View style={[styles.container, { pointerEvents: 'box-none' }]}>
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
                backgroundColor: 'rgba(148, 163, 184, 0.25)',
              }}
            />
          ))
        )}
      </View>
      {/* Buttons Container - chip left, buttons right */}
      <View style={styles.buttonsContainer}>
        {editMode ? (
          <View style={styles.fineChip}>
            <View style={styles.fineStat}>
              <Text style={styles.fineStatLabel}>Changes</Text>
              <Text style={styles.fineStatValue}>{fineInfo?.changes_count ?? 0}</Text>
            </View>
            <View style={styles.fineDivider} />
            <View style={styles.fineStat}>
              <Text style={styles.fineStatLabel}>Fine</Text>
              <Text style={[
                styles.fineStatValue,
                (fineInfo?.total_penalty ?? 0) > 0 && { color: '#f87171' },
              ]}>
                {fineInfo?.total_penalty ?? 0}
              </Text>
            </View>
          </View>
        ) : knockoutScore !== null ? (
          <View style={styles.knockoutScoreChip}>
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
              <Ionicons name={editMode ? 'log-out-outline' : 'create-outline'} size={16} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.editButtonText}>{editMode ? 'Exit' : 'Edit Mode'}</Text>
            </TouchableOpacity>
          )}

          {editMode && (
            <>
              <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}>
                <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.actionButtonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetButton} onPress={handleResetDrafts}>
                <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.actionButtonText}>Reset</Text>
              </TouchableOpacity>
            </>
          )}

          {!editMode && (
            <TouchableOpacity style={styles.screenshotButton} onPress={captureBracket} disabled={isCapturing}>
              <Ionicons name="camera-outline" size={16} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.screenshotButtonText}>{isCapturing ? '...' : 'Capture'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        style={[styles.scrollView, { pointerEvents: 'box-none', marginTop: 50 }]}
      >
        {/* SVG overlay for bracket lines - AFTER the cards */}
        <Svg 
          style={[styles.bracketLines, { height: AVAILABLE_HEIGHT + Y_OFFSET }]}
          width={screenWidth * 3}
          height={AVAILABLE_HEIGHT + Y_OFFSET}
          pointerEvents="none"
        >
          {drawBracketLines()}
        </Svg>
        
        {/* All bracket columns */}
        {renderBracketColumns()}
      </ScrollView>

      {/* Bracket Container for Screenshot */}
      <View ref={bracketRef} style={[styles.bracketContainer, { width: screenWidth * 3.25, height: AVAILABLE_HEIGHT + Y_OFFSET + 60 }]} collapsable={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.hiddenScrollView}
        >
          {/* SVG overlay for bracket lines */}
          <Svg 
            style={[styles.bracketLines, { height: AVAILABLE_HEIGHT + Y_OFFSET + 60 }]}
            width={screenWidth * 3}
            height={AVAILABLE_HEIGHT + Y_OFFSET + 60}
            pointerEvents="none"
          >
            {drawBracketLines()}
          </Svg>
          
          {/* All columns for screenshot */}
          {renderColumn('Round of 32 (Left)', organizedBracket.round32_left, false, 0)}
          {renderColumn('Round of 16 (Left)', organizedBracket.round16_left, false, 1)}
          {renderColumn('Quarter (Left)', organizedBracket.quarter_left, false, 2)}
          {renderColumn('Semi 101', organizedBracket.semi.filter(match => match.id === 101), false, 3)}
          {renderColumn('Final', organizedBracket.final, true, 4)}
          {renderColumn('Semi 102', organizedBracket.semi.filter(match => match.id === 102), false, 5)}
          {renderColumn('Quarter (Right)', organizedBracket.quarter_right, false, 6)}
          {renderColumn('Round of 16 (Right)', organizedBracket.round16_right, false, 7)}
          {renderColumn('Round of 32 (Right)', organizedBracket.round32_right, false, 8)}
        </ScrollView>
      </View>
      
      {/* Inline Toast */}
      {toastMsg && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

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
        finePoints={fineInfo?.total_penalty ?? 0}
        finePerChange={fineInfo?.penalty_per_change ?? 0}
        onClose={() => setIsConfirmSaveModalVisible(false)}
        onConfirm={handleConfirmSave}
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

      {/* Match Edit Modal - OUTSIDE ScrollView */}
      <MatchEditModal
        visible={isModalVisible}
        match={selectedMatch}
        onClose={() => setIsModalVisible(false)}
        onSave={async (matchId, winnerId) => {
          console.log(`💾 Saving match ${matchId} with winner ${winnerId}`);
          try {
            // Find the prediction for this match
            const prediction = predictions.find(p => p.template_match_id === matchId);
            if (!prediction) {
              console.error('Prediction not found for match', matchId);
              return;
            }

            // Determine winner_team_number (1 or 2)
            const winnerTeamNumber = winnerId === prediction.team1_id ? 1 : 2;
            const winnerTeamName = winnerId === prediction.team1_id ? (prediction.team1_name || '') : (prediction.team2_name || '');

            // Update the prediction using the single prediction API (use draft if in edit mode)
            await apiService.updateKnockoutPrediction(
              prediction.id,
              winnerTeamNumber,
              winnerTeamName,
              editMode
            );

            // Get fresh data from server to ensure all stages are updated correctly
            // Wait a bit for server to process the update
            setTimeout(async () => {
              try {
                const userId = getCurrentUserId();
                if (!userId) return;

                const freshPredictions = await apiService.getKnockoutPredictions(userId, undefined, editMode);
                setPredictions(freshPredictions.predictions);

                // Organize into bracket structure with fresh data
                const { organized, calculateCardCoordinates } = organizeBracketMatches(freshPredictions.predictions);
                const spacing = (AVAILABLE_HEIGHT - 40) / 8;
                calculateCardCoordinates(spacing);
                setOrganizedBracket(organized);

                await refreshFineCount();
                console.log('✅ Updated bracket with fresh data from server');
              } catch (error) {
                console.error('❌ Error updating bracket with fresh data:', error);
              }
            }, 500); // Wait 500ms for server to process

            // Store the updated match ID in AsyncStorage to signal knockout screen
            const updatedMatchesStr = await AsyncStorage.getItem('bracketUpdatedMatches') || '[]';
            const updatedMatches = JSON.parse(updatedMatchesStr);
            updatedMatches.push({
              matchId: matchId,
              timestamp: Date.now()
            });
            await AsyncStorage.setItem('bracketUpdatedMatches', JSON.stringify(updatedMatches));

            console.log('✅ Match updated successfully');
          } catch (error) {
            console.error('❌ Error updating match:', error);
            setErrorModal({ title: 'Error', message: 'Could not update match. Please try again.' });
          } finally {
            // Close the modal only after the save operation completes (success or error)
            setIsModalVisible(false);
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingLeft: 60,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#86efac',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  column: {
    marginRight: 20,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 2,
  },
  finalColumn: {
    // No special styling - just like regular column
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
    zIndex: 1,
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
    paddingHorizontal: 12,
  },
  buttonsSpacer: {},
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  screenshotButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  fineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30,30,30,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 8,
    marginLeft: 4,
  },
  knockoutScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginLeft: 4,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  knockoutScoreLabel: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '500',
  },
  knockoutScoreValue: {
    fontSize: 16,
    color: '#166534',
    fontWeight: '700',
  },
  fineStat: {
    alignItems: 'center',
  },
  fineStatLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fineStatValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
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
  bracketContainer: {
    position: 'absolute',
    top: -10000, // Hide off-screen
    left: -10000,
    backgroundColor: '#f1f5f9',
  },
  hiddenScrollView: {
    flex: 1,
    opacity: 1,
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
