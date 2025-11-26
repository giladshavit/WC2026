import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions,
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const COLUMN_WIDTH = 120;
const Y_OFFSET = 80; // Offset to move bracket down (positive = move down on screen)

// Calculate available height for bracket display
// Subtract: status bar (~44px), tab bar (~60px), navigation header (~60px), bottom tabs (~80px)
const STATUS_BAR_HEIGHT = 44;
const TAB_BAR_HEIGHT = 60;
const NAV_HEADER_HEIGHT = 60;
const BOTTOM_TABS_HEIGHT = 80;
const AVAILABLE_HEIGHT = screenHeight - STATUS_BAR_HEIGHT - TAB_BAR_HEIGHT - NAV_HEADER_HEIGHT - BOTTOM_TABS_HEIGHT;

interface BracketScreenProps {}

export default function BracketScreen({}: BracketScreenProps) {
  const [predictions, setPredictions] = useState<KnockoutPrediction[]>([]);
  const [organizedBracket, setOrganizedBracket] = useState<OrganizedBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Get current user ID
  const { getCurrentUserId } = useAuth();
  const [matchLayouts, setMatchLayouts] = useState<{[key: number]: { x: number; y: number; width: number; height: number }}>({});
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Ref for capturing the bracket view
  const bracketRef = useRef<View>(null);

  // Get tournament context data
  const { currentStage, penaltyPerChange, isLoading: tournamentLoading, error: tournamentError } = useTournament();
  
  // Get penalty confirmation hook
  const { showPenaltyConfirmation } = usePenaltyConfirmation();

  // Function to handle match layout updates
  const handleMatchLayout = (matchId: number, layout: { x: number; y: number; width: number; height: number }) => {
    // The layout from onLayout is relative to the column container
    // We need to calculate the absolute position based on which column the match is in
    
    let absoluteLayout = layout;
    
    if (organizedBracket) {
      // Calculate column offset based on match position
      let columnOffset = 0;
      
      // Find which column this match is in and calculate offset
      if (organizedBracket.round32_left.some(m => m.id === matchId)) {
        columnOffset = 0 * (COLUMN_WIDTH + 20); // Column 0
      } else if (organizedBracket.round16_left.some(m => m.id === matchId)) {
        columnOffset = 1 * (COLUMN_WIDTH + 20); // Column 1
      } else if (organizedBracket.quarter_left.some(m => m.id === matchId)) {
        columnOffset = 2 * (COLUMN_WIDTH + 20); // Column 2
      } else if (organizedBracket.semi.filter(m => m.id === 101).some(m => m.id === matchId)) {
        columnOffset = 3 * (COLUMN_WIDTH + 20); // Column 3
      } else if (organizedBracket.final.some(m => m.id === matchId)) {
        columnOffset = 4 * (COLUMN_WIDTH + 20); // Column 4
      } else if (organizedBracket.semi.filter(m => m.id === 102).some(m => m.id === matchId)) {
        columnOffset = 5 * (COLUMN_WIDTH + 20); // Column 5
      } else if (organizedBracket.quarter_right.some(m => m.id === matchId)) {
        columnOffset = 6 * (COLUMN_WIDTH + 20); // Column 6
      } else if (organizedBracket.round16_right.some(m => m.id === matchId)) {
        columnOffset = 7 * (COLUMN_WIDTH + 20); // Column 7
      } else if (organizedBracket.round32_right.some(m => m.id === matchId)) {
        columnOffset = 8 * (COLUMN_WIDTH + 20); // Column 8
      }
      
      // Calculate absolute position - we need to add the marginTop for Y coordinate!
      // The marginTop is calculated as: (match.verticalPosition || index) * spacing
      let marginTop = 0;
      
      // Find the match to get its verticalPosition
      const match = organizedBracket.round32_left.find(m => m.id === matchId) ||
                   organizedBracket.round16_left.find(m => m.id === matchId) ||
                   organizedBracket.quarter_left.find(m => m.id === matchId) ||
                   organizedBracket.semi.find(m => m.id === matchId) ||
                   organizedBracket.final.find(m => m.id === matchId) ||
                   organizedBracket.quarter_right.find(m => m.id === matchId) ||
                   organizedBracket.round16_right.find(m => m.id === matchId) ||
                   organizedBracket.round32_right.find(m => m.id === matchId);
      
      if (match) {
        const spacing = (AVAILABLE_HEIGHT - 40) / 8;
        marginTop = (match.verticalPosition || 0) * spacing + Y_OFFSET; // Add Y_OFFSET to match bracket offset
      }
      
      absoluteLayout = {
        x: layout.x + columnOffset + 20, // Add paddingHorizontal from scrollContent
        y: layout.y + marginTop,  // Add marginTop to get the REAL Y position!
        width: layout.width,
        height: layout.height
      };
      
    }
    
    setMatchLayouts(prev => ({
      ...prev,
      [matchId]: absoluteLayout
    }));
  };

  // Function to draw diagonal lines within each quarter match card (top-left to bottom-right)
  const createQuarterDiagonalLine = (quarterMatch: BracketMatch, color: string = "#667eea") => {
    const absoluteLayout = matchLayouts[quarterMatch.id];
    
    if (!absoluteLayout) {
      return null;
    }
    
    // Line from top-left to bottom-right of the same card using ABSOLUTE coordinates
    const x1 = absoluteLayout.x;  // Top-left (absolute position)
    const y1 = absoluteLayout.y;  // Top-left (absolute position)
    const x2 = absoluteLayout.x + absoluteLayout.width;   // Bottom-right (absolute position)
    const y2 = absoluteLayout.y + absoluteLayout.height;  // Bottom-right (absolute position)
    
    return (
      <Line
        key={`quarter-diagonal-${quarterMatch.id}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#ff0000"  // Bright red for visibility
        strokeWidth="3"   // Thicker line
      />
    );
  };

  // Function to create connecting lines between matches using the precise algorithm
  const createPreciseBracketLines = (quarterMatch1: BracketMatch, quarterMatch2: BracketMatch, semiMatch: BracketMatch) => {
    // Use ABSOLUTE layout coordinates from matchLayouts
    const absoluteLayout1 = matchLayouts[quarterMatch1.id];
    const absoluteLayout2 = matchLayouts[quarterMatch2.id];
    const absoluteLayout3 = matchLayouts[semiMatch.id];
    
    let x1, y1, x2, y2, x3, y3;
    
    // Only draw lines if we have all the ABSOLUTE layout data
    if (!absoluteLayout1 || !absoluteLayout2 || !absoluteLayout3) {
      return [];
    }
    
    // Use the EDGE coordinates from the cards with OFFSET to fix deviation
    const xOffset = 0; // Add offset to extend lines beyond card edges
    const yOffset = 20; // Add offset to extend lines beyond card edges
    
    // Check if this is left side (going right) or right side (going left)
    // We can determine this by checking the relative position of source vs target
    // If target is to the right of source, it's left side (going right)
    // If target is to the left of source, it's right side (going left)
    const isLeftSide = absoluteLayout3.x > absoluteLayout1.x; // If target is to the right of source
    
    
    
    if (isLeftSide) {
      // Left side: going right (quarter -> semi, round32 -> round16)
      x1 = absoluteLayout1.x + absoluteLayout1.width + xOffset;  // Right edge + offset
      y1 = absoluteLayout1.y + (absoluteLayout1.height / 2) + yOffset;  // Vertical center + offset
      
      x2 = absoluteLayout2.x + absoluteLayout2.width + xOffset;  // Right edge + offset
      y2 = absoluteLayout2.y + (absoluteLayout2.height / 2) + yOffset;  // Vertical center + offset
      
      x3 = absoluteLayout3.x + xOffset;  // Left edge + offset (your fix!)
      y3 = absoluteLayout3.y + (absoluteLayout3.height / 2) + yOffset;  // Vertical center + offset
    } else {
      // Right side: going left (round32 -> round16, quarter -> semi)
      x1 = absoluteLayout1.x + xOffset;  // Left edge - offset
      y1 = absoluteLayout1.y + (absoluteLayout1.height / 2) + yOffset;  // Vertical center + offset
      
      x2 = absoluteLayout2.x + xOffset;  // Left edge - offset
      y2 = absoluteLayout2.y + (absoluteLayout2.height / 2) + yOffset;  // Vertical center + offset
      
      x3 = absoluteLayout3.x + absoluteLayout3.width + xOffset;  // Right edge - offset
      y3 = absoluteLayout3.y + (absoluteLayout3.height / 2) + yOffset;  // Vertical center + offset
    }
    
    
    // Calculate intermediate points - simple and clean
    const x4 = (x1 + x3) / 2;  // Middle point between quarter 1 and semi
    const y4 = y1;
    const x5 = x4;  // Same X as x4 for vertical connection
    const y5 = y2;
    const x6 = x4;  // Same X as x4 for final connection
    const y6 = (y4 + y5) / 2;  // Vertical middle between the two horizontal lines
    
    
    const lines = [];

    // Horizontal line from x1,y1 to x4,y4
    lines.push(
      <Line
        key={`line-${quarterMatch1.id}-horizontal-1`}
        x1={x1}
        y1={y1}
        x2={x4}
        y2={y4}
        stroke="#667eea"
        strokeWidth="2"
      />
    );

    // Horizontal line from x2,y2 to x5,y5
    lines.push(
      <Line
        key={`line-${quarterMatch2.id}-horizontal-2`}
        x1={x2}
        y1={y2}
        x2={x5}
        y2={y5}
        stroke="#667eea"
        strokeWidth="2"
      />
    );

    // Vertical line from x4,y4 to x5,y5 (should pass through x6,y6)
    lines.push(
      <Line
        key={`line-${semiMatch.id}-vertical`}
        x1={x4}
        y1={y4}
        x2={x5}
        y2={y5}
        stroke="#667eea"
        strokeWidth="2"
      />
    );

    // Final line from x6,y6 to x3,y3
    lines.push(
      <Line
        key={`line-${semiMatch.id}-final`}
        x1={x6}
        y1={y6}
        x2={x3}
        y2={y3}
        stroke="#667eea"
        strokeWidth="2"
      />
    );


    return lines;
  };

  // Create horizontal lines from semi-finals to final
  const createSemiToFinalLines = (semiMatch: BracketMatch, finalMatch: BracketMatch) => {
    const absoluteLayout1 = matchLayouts[semiMatch.id];
    const absoluteLayout2 = matchLayouts[finalMatch.id];
    
    if (!absoluteLayout1 || !absoluteLayout2) {
      return [];
    }
    
    const xOffset = 0;
    const yOffset = 20;
    
    // Check if this is left semi (101) or right semi (102)
    const isLeftSemi = semiMatch.id === 101;
    
    let x1, y1, x2, y2;
    
    if (isLeftSemi) {
      // Left semi: from right edge to final left edge
      x1 = absoluteLayout1.x + absoluteLayout1.width + xOffset; // Right edge of left semi
      y1 = absoluteLayout1.y + (absoluteLayout1.height / 2) + yOffset; // Vertical center
      x2 = absoluteLayout2.x - xOffset; // Left edge of final
      y2 = y1; // Use same Y as semi-final for horizontal line
    } else {
      // Right semi: from left edge to final right edge
      x1 = absoluteLayout1.x - xOffset; // Left edge of right semi
      y1 = absoluteLayout1.y + (absoluteLayout1.height / 2) + yOffset; // Vertical center
      x2 = absoluteLayout2.x + absoluteLayout2.width + xOffset; // Right edge of final
      y2 = y1; // Use same Y as semi-final for horizontal line
    }
    
    
    return [
      <Line 
        key={`semi-to-final-${semiMatch.id}`} 
        x1={x1} 
        y1={y1} 
        x2={x2} 
        y2={y2} 
        stroke="#667eea" 
        strokeWidth="2" 
      />
    ];
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

  // Fetch data when component mounts or comes into focus, or when edit mode changes
  useFocusEffect(
    React.useCallback(() => {
      fetchPredictions();
    }, [editMode])
  );

  const handleEditModeToggle = async () => {
    if (!editMode) {
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
        // fetchPredictions will be called automatically by useFocusEffect when editMode changes
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
        // fetchPredictions will be called automatically by useFocusEffect when editMode changes
      } catch (error) {
        console.error('Error deleting drafts:', error);
        Alert.alert('שגיאה', 'לא ניתן לצאת ממצב עריכה. נסה שוב.');
      } finally {
        setLoading(false);
      }
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
        <View style={styles.matchesContainer}>
          {matches.map((match, index) => {
            const calculatedMarginTop = (match.verticalPosition || index) * spacing + Y_OFFSET;
            
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
                onLayout={handleMatchLayout}
              />
            </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Function to render all bracket lines
  const renderBracketLines = () => {
    if (!organizedBracket) return null;

    return (
      <>
        {/* Lines from Round 32 Left to Round 16 Left (Left side) */}
        {organizedBracket.round32_left.length >= 8 && organizedBracket.round16_left.length >= 4 && 
          (() => {
            // Find matches by ID, not by array index!
            const round32Match74 = organizedBracket.round32_left.find(m => m.id === 74);
            const round32Match77 = organizedBracket.round32_left.find(m => m.id === 77);
            const round16Match89 = organizedBracket.round16_left.find(m => m.id === 89);
            
            const round32Match73 = organizedBracket.round32_left.find(m => m.id === 73);
            const round32Match75 = organizedBracket.round32_left.find(m => m.id === 75);
            const round16Match90 = organizedBracket.round16_left.find(m => m.id === 90);
            
            const round32Match83 = organizedBracket.round32_left.find(m => m.id === 83);
            const round32Match84 = organizedBracket.round32_left.find(m => m.id === 84);
            const round16Match93 = organizedBracket.round16_left.find(m => m.id === 93);
            
            const round32Match81 = organizedBracket.round32_left.find(m => m.id === 81);
            const round32Match82 = organizedBracket.round32_left.find(m => m.id === 82);
            const round16Match94 = organizedBracket.round16_left.find(m => m.id === 94);
            
            const lines = [];
            
            // Only draw lines if all matches exist
            if (round32Match74 && round32Match77 && round16Match89) {
              lines.push(...createPreciseBracketLines(round32Match74, round32Match77, round16Match89));
            }
            if (round32Match73 && round32Match75 && round16Match90) {
              lines.push(...createPreciseBracketLines(round32Match73, round32Match75, round16Match90));
            }
            if (round32Match83 && round32Match84 && round16Match93) {
              lines.push(...createPreciseBracketLines(round32Match83, round32Match84, round16Match93));
            }
            if (round32Match81 && round32Match82 && round16Match94) {
              lines.push(...createPreciseBracketLines(round32Match81, round32Match82, round16Match94));
            }
            
            return lines;
          })()
        }
        
        {/* Lines from Round 16 Left to Quarter Left (Left side) */}
        {organizedBracket.round16_left.length >= 4 && organizedBracket.quarter_left.length >= 2 && 
          (() => {
            // Find matches by ID, not by array index!
            const round16Match89 = organizedBracket.round16_left.find(m => m.id === 89);
            const round16Match90 = organizedBracket.round16_left.find(m => m.id === 90);
            const quarterMatch97 = organizedBracket.quarter_left.find(m => m.id === 97);
            
            const round16Match93 = organizedBracket.round16_left.find(m => m.id === 93);
            const round16Match94 = organizedBracket.round16_left.find(m => m.id === 94);
            const quarterMatch98 = organizedBracket.quarter_left.find(m => m.id === 98);
            
            const lines = [];
            
            // Only draw lines if all matches exist
            if (round16Match89 && round16Match90 && quarterMatch97) {
              lines.push(...createPreciseBracketLines(round16Match89, round16Match90, quarterMatch97));
            }
            if (round16Match93 && round16Match94 && quarterMatch98) {
              lines.push(...createPreciseBracketLines(round16Match93, round16Match94, quarterMatch98));
            }
            
            return lines;
          })()
        }
        
        {/* Lines from Quarter Left to Semi Final 101 (Left side) */}
        {organizedBracket.quarter_left.length === 2 && organizedBracket.semi.find(s => s.id === 101) && 
          (() => {
            return createPreciseBracketLines(
              organizedBracket.quarter_left[0], 
              organizedBracket.quarter_left[1], 
              organizedBracket.semi.find(s => s.id === 101)!
            );
          })()
        }
        
        {/* Lines from Round 32 Right to Round 16 Right (Right side) */}
        {organizedBracket.round32_right.length >= 8 && organizedBracket.round16_right.length >= 4 && 
          (() => {
            // Find matches by ID for right side
            const round32Match76 = organizedBracket.round32_right.find(m => m.id === 76);
            const round32Match78 = organizedBracket.round32_right.find(m => m.id === 78);
            const round16Match91 = organizedBracket.round16_right.find(m => m.id === 91);
            
            const round32Match79 = organizedBracket.round32_right.find(m => m.id === 79);
            const round32Match80 = organizedBracket.round32_right.find(m => m.id === 80);
            const round16Match92 = organizedBracket.round16_right.find(m => m.id === 92);
            
            const round32Match86 = organizedBracket.round32_right.find(m => m.id === 86);
            const round32Match88 = organizedBracket.round32_right.find(m => m.id === 88);
            const round16Match95 = organizedBracket.round16_right.find(m => m.id === 95);
            
            const round32Match85 = organizedBracket.round32_right.find(m => m.id === 85);
            const round32Match87 = organizedBracket.round32_right.find(m => m.id === 87);
            const round16Match96 = organizedBracket.round16_right.find(m => m.id === 96);
            
            const lines = [];
            
            // Only draw lines if all matches exist
            if (round32Match76 && round32Match78 && round16Match91) {
              lines.push(...createPreciseBracketLines(round32Match76, round32Match78, round16Match91));
            }
            if (round32Match79 && round32Match80 && round16Match92) {
              lines.push(...createPreciseBracketLines(round32Match79, round32Match80, round16Match92));
            }
            if (round32Match86 && round32Match88 && round16Match95) {
              lines.push(...createPreciseBracketLines(round32Match86, round32Match88, round16Match95));
            }
            if (round32Match85 && round32Match87 && round16Match96) {
              lines.push(...createPreciseBracketLines(round32Match85, round32Match87, round16Match96));
            }
            
            return lines;
          })()
        }
        
        {/* Lines from Round 16 Right to Quarter Right (Right side) */}
        {organizedBracket.round16_right.length >= 4 && organizedBracket.quarter_right.length >= 2 && 
          (() => {
            // Find matches by ID for right side
            const round16Match91 = organizedBracket.round16_right.find(m => m.id === 91);
            const round16Match92 = organizedBracket.round16_right.find(m => m.id === 92);
            const quarterMatch99 = organizedBracket.quarter_right.find(m => m.id === 99);
            
            const round16Match95 = organizedBracket.round16_right.find(m => m.id === 95);
            const round16Match96 = organizedBracket.round16_right.find(m => m.id === 96);
            const quarterMatch100 = organizedBracket.quarter_right.find(m => m.id === 100);
            
            const lines = [];
            
            // Only draw lines if all matches exist
            if (round16Match91 && round16Match92 && quarterMatch99) {
              lines.push(...createPreciseBracketLines(round16Match91, round16Match92, quarterMatch99));
            }
            if (round16Match95 && round16Match96 && quarterMatch100) {
              lines.push(...createPreciseBracketLines(round16Match95, round16Match96, quarterMatch100));
            }
            
            return lines;
          })()
        }
        
        {/* Lines from Quarter Right to Semi Final 102 (Right side) */}
        {organizedBracket.quarter_right.length === 2 && organizedBracket.semi.find(s => s.id === 102) && 
          (() => {
            return createPreciseBracketLines(
              organizedBracket.quarter_right[0], 
              organizedBracket.quarter_right[1], 
              organizedBracket.semi.find(s => s.id === 102)!
            );
          })()
        }
        
        {/* Lines from Semi Finals to Final */}
        {organizedBracket.semi.length === 2 && organizedBracket.final.length === 1 && 
          (() => {
            const semi101 = organizedBracket.semi.find(s => s.id === 101);
            const semi102 = organizedBracket.semi.find(s => s.id === 102);
            const final = organizedBracket.final[0];
            
            if (semi101 && semi102 && final) {
              return [
                ...createSemiToFinalLines(semi101, final),
                ...createSemiToFinalLines(semi102, final)
              ];
            }
            
            return [];
          })()
        }
      </>
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
      {/* Buttons Container - Centered */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.editButton, editMode && styles.editButtonActive]}
          onPress={handleEditModeToggle}
          disabled={loading}
        >
          <Text style={styles.editButtonText}>
            {editMode ? '✏️ יציאה מעריכה' : '✏️ עריכה'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.screenshotButton}
          onPress={captureBracket}
          disabled={isCapturing}
        >
          <Text style={styles.screenshotButtonText}>
            {isCapturing ? 'צולם...' : '📸 שמור בראקט'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        style={[styles.scrollView, { pointerEvents: 'box-none' }]}
      >
        {/* SVG overlay for bracket lines - AFTER the cards */}
        <Svg 
          style={[styles.bracketLines, { height: AVAILABLE_HEIGHT + Y_OFFSET }]}
          width={screenWidth * 3} // Wide enough for all columns (including right side at x=1155)
          height={AVAILABLE_HEIGHT + Y_OFFSET}
          pointerEvents="none"
        >
          {renderBracketLines()}
        </Svg>
        
        {/* All bracket columns */}
        {renderBracketColumns()}
      </ScrollView>

      {/* Bracket Container for Screenshot */}
      <View ref={bracketRef} style={styles.bracketContainer} collapsable={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.hiddenScrollView}
        >
          {/* SVG overlay for bracket lines */}
          <Svg 
            style={[styles.bracketLines, { height: AVAILABLE_HEIGHT + Y_OFFSET + 60 }]}
            width={screenWidth * 3.25}
            height={AVAILABLE_HEIGHT + Y_OFFSET + 60}
            pointerEvents="none"
          >
            {/* All the same SVG lines as above */}
            {/* Quarter diagonal lines removed - no longer needed */}
            
            {/* Lines from Round 32 Left to Round 16 Left (Left side) */}
            {organizedBracket && organizedBracket.round32_left.length >= 8 && organizedBracket.round16_left.length >= 4 && 
              (() => {
                // Find matches by ID, not by array index!
                const round32Match74 = organizedBracket.round32_left.find(m => m.id === 74);
                const round32Match77 = organizedBracket.round32_left.find(m => m.id === 77);
                const round16Match89 = organizedBracket.round16_left.find(m => m.id === 89);
                
                const round32Match73 = organizedBracket.round32_left.find(m => m.id === 73);
                const round32Match75 = organizedBracket.round32_left.find(m => m.id === 75);
                const round16Match90 = organizedBracket.round16_left.find(m => m.id === 90);
                
                const round32Match83 = organizedBracket.round32_left.find(m => m.id === 83);
                const round32Match84 = organizedBracket.round32_left.find(m => m.id === 84);
                const round16Match93 = organizedBracket.round16_left.find(m => m.id === 93);
                
                const round32Match81 = organizedBracket.round32_left.find(m => m.id === 81);
                const round32Match82 = organizedBracket.round32_left.find(m => m.id === 82);
                const round16Match94 = organizedBracket.round16_left.find(m => m.id === 94);
                
                const lines = [];
                
                // Only draw lines if all matches exist
                if (round32Match74 && round32Match77 && round16Match89) {
                  lines.push(...createPreciseBracketLines(round32Match74, round32Match77, round16Match89));
                }
                if (round32Match73 && round32Match75 && round16Match90) {
                  lines.push(...createPreciseBracketLines(round32Match73, round32Match75, round16Match90));
                }
                if (round32Match83 && round32Match84 && round16Match93) {
                  lines.push(...createPreciseBracketLines(round32Match83, round32Match84, round16Match93));
                }
                if (round32Match81 && round32Match82 && round16Match94) {
                  lines.push(...createPreciseBracketLines(round32Match81, round32Match82, round16Match94));
                }
                
                return lines;
              })()
            }
            
            {/* Lines from Round 16 Left to Quarter Left (Left side) */}
            {organizedBracket && organizedBracket.round16_left.length >= 4 && organizedBracket.quarter_left.length >= 2 && 
              (() => {
                // Find matches by ID, not by array index!
                const round16Match89 = organizedBracket.round16_left.find(m => m.id === 89);
                const round16Match90 = organizedBracket.round16_left.find(m => m.id === 90);
                const quarterMatch97 = organizedBracket.quarter_left.find(m => m.id === 97);
                
                const round16Match93 = organizedBracket.round16_left.find(m => m.id === 93);
                const round16Match94 = organizedBracket.round16_left.find(m => m.id === 94);
                const quarterMatch98 = organizedBracket.quarter_left.find(m => m.id === 98);
                
                const lines = [];
                
                // Only draw lines if all matches exist
                if (round16Match89 && round16Match90 && quarterMatch97) {
                  lines.push(...createPreciseBracketLines(round16Match89, round16Match90, quarterMatch97));
                }
                if (round16Match93 && round16Match94 && quarterMatch98) {
                  lines.push(...createPreciseBracketLines(round16Match93, round16Match94, quarterMatch98));
                }
                
                return lines;
              })()
            }
            
            {/* Lines from Quarter Left to Semi Final 101 (Left side) */}
            {organizedBracket && organizedBracket.quarter_left.length === 2 && organizedBracket.semi.find(s => s.id === 101) && 
              (() => {
                return createPreciseBracketLines(
                  organizedBracket.quarter_left[0], 
                  organizedBracket.quarter_left[1], 
                  organizedBracket.semi.find(s => s.id === 101)!
                );
              })()
            }
            
            {/* Lines from Round 32 Right to Round 16 Right (Right side) */}
            {organizedBracket && organizedBracket.round32_right.length >= 8 && organizedBracket.round16_right.length >= 4 && 
              (() => {
                // Find matches by ID for right side
                const round32Match76 = organizedBracket.round32_right.find(m => m.id === 76);
                const round32Match78 = organizedBracket.round32_right.find(m => m.id === 78);
                const round16Match91 = organizedBracket.round16_right.find(m => m.id === 91);
                
                const round32Match79 = organizedBracket.round32_right.find(m => m.id === 79);
                const round32Match80 = organizedBracket.round32_right.find(m => m.id === 80);
                const round16Match92 = organizedBracket.round16_right.find(m => m.id === 92);
                
                const round32Match86 = organizedBracket.round32_right.find(m => m.id === 86);
                const round32Match88 = organizedBracket.round32_right.find(m => m.id === 88);
                const round16Match95 = organizedBracket.round16_right.find(m => m.id === 95);
                
                const round32Match85 = organizedBracket.round32_right.find(m => m.id === 85);
                const round32Match87 = organizedBracket.round32_right.find(m => m.id === 87);
                const round16Match96 = organizedBracket.round16_right.find(m => m.id === 96);
                
                const lines = [];
                
                // Only draw lines if all matches exist
                if (round32Match76 && round32Match78 && round16Match91) {
                  lines.push(...createPreciseBracketLines(round32Match76, round32Match78, round16Match91));
                }
                if (round32Match79 && round32Match80 && round16Match92) {
                  lines.push(...createPreciseBracketLines(round32Match79, round32Match80, round16Match92));
                }
                if (round32Match86 && round32Match88 && round16Match95) {
                  lines.push(...createPreciseBracketLines(round32Match86, round32Match88, round16Match95));
                }
                if (round32Match85 && round32Match87 && round16Match96) {
                  lines.push(...createPreciseBracketLines(round32Match85, round32Match87, round16Match96));
                }
                
                return lines;
              })()
            }
            
            {/* Lines from Round 16 Right to Quarter Right (Right side) */}
            {organizedBracket && organizedBracket.round16_right.length >= 4 && organizedBracket.quarter_right.length >= 2 && 
              (() => {
                // Find matches by ID for right side
                const round16Match91 = organizedBracket.round16_right.find(m => m.id === 91);
                const round16Match92 = organizedBracket.round16_right.find(m => m.id === 92);
                const quarterMatch99 = organizedBracket.quarter_right.find(m => m.id === 99);
                
                const round16Match95 = organizedBracket.round16_right.find(m => m.id === 95);
                const round16Match96 = organizedBracket.round16_right.find(m => m.id === 96);
                const quarterMatch100 = organizedBracket.quarter_right.find(m => m.id === 100);
                
                const lines = [];
                
                // Only draw lines if all matches exist
                if (round16Match91 && round16Match92 && quarterMatch99) {
                  lines.push(...createPreciseBracketLines(round16Match91, round16Match92, quarterMatch99));
                }
                if (round16Match95 && round16Match96 && quarterMatch100) {
                  lines.push(...createPreciseBracketLines(round16Match95, round16Match96, quarterMatch100));
                }
                
                return lines;
              })()
            }
            
            {/* Lines from Quarter Right to Semi Final 102 (Right side) */}
            {organizedBracket && organizedBracket.quarter_right.length === 2 && organizedBracket.semi.find(s => s.id === 102) && 
              (() => {
                return createPreciseBracketLines(
                  organizedBracket.quarter_right[0], 
                  organizedBracket.quarter_right[1], 
                  organizedBracket.semi.find(s => s.id === 102)!
                );
              })()
            }
            
            {/* Lines from Semi Finals to Final */}
            {organizedBracket && organizedBracket.semi.length === 2 && organizedBracket.final.length === 1 && 
              (() => {
                const semi101 = organizedBracket.semi.find(s => s.id === 101);
                const semi102 = organizedBracket.semi.find(s => s.id === 102);
                const final = organizedBracket.final[0];
                
                if (semi101 && semi102 && final) {
                  return [
                    ...createSemiToFinalLines(semi101, final),
                    ...createSemiToFinalLines(semi102, final)
                  ];
                }
                
                return [];
              })()
            }
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
    color: '#718096',
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
    minHeight: AVAILABLE_HEIGHT + Y_OFFSET + 40, // Add Y_OFFSET and extra padding to prevent cutoff
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
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  editButton: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButtonActive: {
    backgroundColor: '#ed8936',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  screenshotButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  screenshotButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bracketContainer: {
    position: 'absolute',
    top: -10000, // Hide off-screen
    left: -10000,
    width: screenWidth * 3.25, // Optimal width for full bracket capture
    height: AVAILABLE_HEIGHT + Y_OFFSET + 60, // Add Y_OFFSET and extra padding to prevent cutoff
    backgroundColor: '#f8fafc',
  },
  hiddenScrollView: {
    flex: 1,
    opacity: 1,
  },
});
