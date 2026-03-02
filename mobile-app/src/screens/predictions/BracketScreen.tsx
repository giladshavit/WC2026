import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  TouchableOpacity,
  Platform
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, KnockoutPrediction } from '../../services/api';
import BracketMatchCard from '../../components/BracketMatchCard';
import MatchEditModal from '../../components/MatchEditModal';
import { organizeBracketMatches, BracketMatch, OrganizedBracket } from '../../utils/bracketCalculator';
import { useTournament } from '../../contexts/TournamentContext';
import { usePenaltyConfirmation } from '../../hooks/usePenaltyConfirmation';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import Ionicons from '@expo/vector-icons/Ionicons';

interface BracketScreenProps {}

export default function BracketScreen({}: BracketScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Derived constants - recalculate when dimensions change
  const STATUS_BAR_HEIGHT = 44;
  const TAB_BAR_HEIGHT = 60;
  const NAV_HEADER_HEIGHT = 60;
  const BOTTOM_TABS_HEIGHT = 80;
  const AVAILABLE_HEIGHT = screenHeight - STATUS_BAR_HEIGHT - TAB_BAR_HEIGHT - NAV_HEADER_HEIGHT - BOTTOM_TABS_HEIGHT;
  const Y_OFFSET = 60;
  const COLUMN_WIDTH = 110;
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [organizedBracket, setOrganizedBracket] = useState<OrganizedBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [canEditDrafts, setCanEditDrafts] = useState<boolean>(true);
  const [penaltyInfo, setPenaltyInfo] = useState<{changes_count: number, penalty_per_change: number, total_penalty: number} | null>(null);
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Ref for capturing the bracket view
  const bracketRef = useRef<View>(null);

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();

  const refreshPenaltyCount = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId || !editMode) return;
      const result = await apiService.getDraftChangesCount(userId);
      setPenaltyInfo(result);
    } catch (error) {
      console.error('Error refreshing penalty count:', error);
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
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      // Fetch all knockout predictions (use draft if in edit mode)
      const allPredictions = await apiService.getKnockoutPredictions(userId, undefined, editMode);
      setPredictions(allPredictions.predictions);
      setCanEditDrafts(allPredictions.can_edit_drafts ?? true);
      
      // Organize into bracket structure
      const { organized, calculateCardCoordinates } = organizeBracketMatches(allPredictions.predictions);
      
      // Calculate card coordinates with current spacing
      const spacing = (AVAILABLE_HEIGHT - 40) / 8;
      calculateCardCoordinates(spacing);
      
      setOrganizedBracket(organized);
      
    } catch (error) {
      console.error('Error fetching bracket predictions:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת הבראקט');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const drawBracketLines = () => {
    if (!organizedBracket) return [];
    const PADDING = 20; // scrollContent paddingHorizontal
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
          refreshPenaltyCount();
        }
      });
    }, [editMode])
  );

  const handleEditModeToggle = async () => {
    if (!editMode) {
      if (!canEditDrafts) {
        Alert.alert('לא ניתן לערוך', 'לא ניתן לערוך ניחושים בזמן שלב נוקאאוט פעיל');
        return;
      }
      // Entering edit mode - create all drafts
      try {
        const userId = getCurrentUserId();
        if (!userId) {
          Alert.alert('Error', 'User not authenticated');
          return;
        }
        
        setLoading(true);
        await apiService.createAllDrafts(userId);
        setEditMode(true);
        // fetchPredictions and refreshPenaltyCount will be called by useFocusEffect when editMode changes
      } catch (error) {
        console.error('Error creating drafts:', error);
        Alert.alert('שגיאה', 'לא ניתן להיכנס למצב עריכה. נסה שוב.');
      } finally {
        setLoading(false);
      }
    } else {
      // Exiting edit mode - delete all drafts and switch back to regular predictions
      try {
        const userId = getCurrentUserId();
        if (!userId) {
          Alert.alert('Error', 'User not authenticated');
          return;
        }
        
        setLoading(true);
        await apiService.deleteAllDrafts(userId);
        setEditMode(false);
        setPenaltyInfo(null);
        // fetchPredictions will be called automatically by useFocusEffect when editMode changes
      } catch (error) {
        console.error('Error deleting drafts:', error);
        Alert.alert('שגיאה', 'לא ניתן לצאת ממצב עריכה. נסה שוב.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetDrafts = async () => {
    Alert.alert(
      'איפוס ניחושים',
      'האם לאפס את כל השינויים ולחזור למצב המקורי?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = getCurrentUserId();
              if (!userId) return;
              setLoading(true);
              await apiService.resetDrafts(userId);
              await fetchPredictions();
              setPenaltyInfo({ changes_count: 0, penalty_per_change: 0, total_penalty: 0 });
            } catch (error) {
              console.error('Error resetting drafts:', error);
              Alert.alert('שגיאה', 'לא ניתן לאפס. נסה שוב.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const executeCommit = async (userId: number) => {
    try {
      setLoading(true);
      const result = await apiService.commitDrafts(userId);

      setEditMode(false);
      setPenaltyInfo(null);

      // Show success
      let message = `${result.changes_count} שינויים נשמרו בהצלחה.`;
      if (result.penalty_applied > 0) {
        message += `\nהופחתו ${result.penalty_applied} נקודות עונש.`;
      }
      Alert.alert('נשמר', message);
    } catch (error) {
      console.error('Error committing drafts:', error);
      Alert.alert('שגיאה', 'השמירה נכשלה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePress = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;

      // Get fresh count before confirming
      const countResult = await apiService.getDraftChangesCount(userId);

      if (countResult.changes_count === 0) {
        Alert.alert('אין שינויים', 'לא בוצעו שינויים בניחושים.');
        return;
      }

      // Show confirmation with penalty info
      Alert.alert(
        'שמירת שינויים',
        `האם לשמור ${countResult.changes_count} שינויים?\n\nעונש: ${countResult.total_penalty} נקודות\n(${countResult.changes_count} שינויים × ${countResult.penalty_per_change} נקודות לשינוי)`,
        [
          {
            text: 'ביטול',
            style: 'cancel',
          },
          {
            text: 'שמור',
            style: 'destructive',
            onPress: () => executeCommit(userId),
          },
        ]
      );
    } catch (error) {
      console.error('Error in save press:', error);
      Alert.alert('שגיאה', 'לא ניתן לבצע שמירה. נסה שוב.');
    }
  };

  const handleMatchPress = (match: BracketMatch) => {
    console.log(`🎯 CLICKED: Match ${match.id} - ${match.team1_name} vs ${match.team2_name}`);
    setSelectedMatch(match);
    setIsModalVisible(true);
  };

  const captureBracket = async () => {
    if (!bracketRef.current) {
      Alert.alert('שגיאה', 'לא ניתן לצלם את הבראקט');
      return;
    }

    try {
      setIsCapturing(true);

      // Request permission to save to photos
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('שגיאה', 'נדרש אישור לשמירת תמונות');
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

      Alert.alert('הצלחה', 'הבראקט נשמר בתמונות בהצלחה!');
    } catch (error) {
      console.error('Error capturing bracket:', error);
      Alert.alert('שגיאה', 'שגיאה בשמירת הבראקט');
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
        {renderColumn('32 אחרונות (שמאל)', organizedBracket.round32_left, false, 0)}
        {renderColumn('16 אחרונות (שמאל)', organizedBracket.round16_left, false, 1)}
        {renderColumn('רבע (שמאל)', organizedBracket.quarter_left, false, 2)}
        {renderColumn('חצי גמר 101', organizedBracket.semi.filter(match => match.id === 101), false, 3)}
        {renderColumn('גמר', organizedBracket.final, true, 4)}
        {renderColumn('חצי גמר 102', organizedBracket.semi.filter(match => match.id === 102), false, 5)}
        {renderColumn('רבע (ימין)', organizedBracket.quarter_right, false, 6)}
        {renderColumn('16 אחרונות (ימין)', organizedBracket.round16_right, false, 7)}
        {renderColumn('32 אחרונות (ימין)', organizedBracket.round32_right, false, 8)}
      </>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>טוען בראקט...</Text>
      </View>
    );
  }

  if (!organizedBracket) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>שגיאה בטעינת הבראקט</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { pointerEvents: 'box-none' }]}>
      {/* Soccer field subtle pattern */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: i * (screenHeight / 20),
              left: 0,
              right: 0,
              height: screenHeight / 20,
              backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
          />
        ))}
      </View>
      {/* Buttons Container - Penalty left, buttons right */}
      <View style={styles.buttonsContainer}>
        {editMode ? (
          <View style={styles.penaltyChip}>
            <Text style={styles.penaltyChipText}>
              <Text style={styles.penaltyChipLabel}>Changes: </Text>
              <Text style={styles.penaltyChipNum}>{penaltyInfo?.changes_count ?? 0}</Text>
              <Text style={styles.penaltyChipLabel}>  Penalty: </Text>
              <Text style={[
                styles.penaltyChipNum,
                (penaltyInfo?.total_penalty ?? 0) > 0 && { color: '#f87171' },
              ]}>
                {penaltyInfo?.total_penalty ?? 0}
              </Text>
            </Text>
          </View>
        ) : (
          <View style={styles.buttonsSpacer} />
        )}

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              styles.editButton,
              editMode && styles.editButtonActive,
              (!editMode && !canEditDrafts) && { opacity: 0.4 },
            ]}
            onPress={handleEditModeToggle}
            disabled={loading || (!editMode && !canEditDrafts)}
          >
            <Ionicons name={editMode ? 'close-circle' : 'create-outline'} size={16} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.editButtonText}>{editMode ? 'Exit' : 'Edit'}</Text>
          </TouchableOpacity>

          {editMode && (
            <>
              <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
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
          {renderColumn('32 אחרונות (שמאל)', organizedBracket.round32_left, false, 0)}
          {renderColumn('16 אחרונות (שמאל)', organizedBracket.round16_left, false, 1)}
          {renderColumn('רבע (שמאל)', organizedBracket.quarter_left, false, 2)}
          {renderColumn('חצי גמר 101', organizedBracket.semi.filter(match => match.id === 101), false, 3)}
          {renderColumn('גמר', organizedBracket.final, true, 4)}
          {renderColumn('חצי גמר 102', organizedBracket.semi.filter(match => match.id === 102), false, 5)}
          {renderColumn('רבע (ימין)', organizedBracket.quarter_right, false, 6)}
          {renderColumn('16 אחרונות (ימין)', organizedBracket.round16_right, false, 7)}
          {renderColumn('32 אחרונות (ימין)', organizedBracket.round32_right, false, 8)}
        </ScrollView>
      </View>
      
      {/* Match Edit Modal - OUTSIDE ScrollView */}
      <MatchEditModal
        visible={isModalVisible}
        match={selectedMatch}
        onClose={() => setIsModalVisible(false)}
        onSave={async (matchId, winnerId) => {
          console.log(`💾 Saving match ${matchId} with winner ${winnerId}`);
          
          // Use the generic penalty confirmation hook
          // Each change is 1 change (as requested)
          showPenaltyConfirmation(async () => {
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
                  
                  await refreshPenaltyCount();
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
              Alert.alert('שגיאה', 'לא ניתן לעדכן את המשחק. נסה שוב.');
            } finally {
              // Close the modal only after the save operation completes (success or error)
              setIsModalVisible(false);
            }
          }, 1, () => {
            // This function will be called if user cancels the penalty confirmation
            // We can add any logic here if needed, but for now we just keep the modal open
            console.log('User cancelled penalty confirmation, keeping modal open');
          }); // Each change is 1 change
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60, // Extra padding at bottom to prevent cutoff in screenshot
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
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
  buttonsSpacer: {
    flex: 1,
  },
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
    marginRight: 6,
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
    marginRight: 6,
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
    marginRight: 6,
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
  penaltyChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  penaltyChipText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  penaltyChipLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  penaltyChipNum: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '800',
  },
  bracketContainer: {
    position: 'absolute',
    top: -10000, // Hide off-screen
    left: -10000,
    backgroundColor: '#f8fafc',
  },
  hiddenScrollView: {
    flex: 1,
    opacity: 1,
  },
});
