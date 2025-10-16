import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, KnockoutPrediction } from '../../services/api';
import BracketMatchCard from '../../components/BracketMatchCard';
import { organizeBracketMatches, BracketMatch, OrganizedBracket } from '../../utils/bracketCalculator';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const COLUMN_WIDTH = 120;

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
  const [matchLayouts, setMatchLayouts] = useState<{[key: number]: { x: number; y: number; width: number; height: number }}>({});
  const userId = 1; // Hardcoded for now

  // Log available height for debugging
  console.log(`Screen height: ${screenHeight}, Available height: ${AVAILABLE_HEIGHT}, Spacing: ${(AVAILABLE_HEIGHT - 40) / 8}`);

  // Function to handle match layout updates
  const handleMatchLayout = (matchId: number, layout: { x: number; y: number; width: number; height: number }) => {
    // The layout from onLayout is relative to the column container
    // We need to calculate the absolute position based on which column the match is in
    console.log(`=== ONLAYOUT RECEIVED FOR MATCH ${matchId} ===`);
    console.log(`Raw onLayout: x=${layout.x}, y=${layout.y}, width=${layout.width}, height=${layout.height}`);
    console.log(`This is relative to the column container, NOT the screen!`);
    
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
        marginTop = (match.verticalPosition || 0) * spacing;
        console.log(`Match ${matchId} marginTop calculation: verticalPosition=${match.verticalPosition}, spacing=${spacing}, marginTop=${marginTop}`);
      }
      
      absoluteLayout = {
        x: layout.x + columnOffset + 20, // Add paddingHorizontal from scrollContent
        y: layout.y + marginTop,  // Add marginTop to get the REAL Y position!
        width: layout.width,
        height: layout.height
      };
      
      // Debug: Print absolute layout for ALL matches
      console.log(`=== MATCH ${matchId} LAYOUT CALCULATION ===`);
      console.log(`Relative layout: x=${layout.x}, y=${layout.y}, width=${layout.width}, height=${layout.height}`);
      console.log(`Column offset: ${columnOffset} (column calculation)`);
      console.log(`MarginTop: ${marginTop} (vertical positioning)`);
      console.log(`Absolute layout: x=${absoluteLayout.x}, y=${absoluteLayout.y}, width=${absoluteLayout.width}, height=${absoluteLayout.height}`);
      console.log(`FINAL: X=${absoluteLayout.x}, Y=${absoluteLayout.y} (this should match visual position!)`);
      console.log(`---`);
    }
    
    setMatchLayouts(prev => ({
      ...prev,
      [matchId]: absoluteLayout
    }));
  };

  // Function to draw diagonal lines within each quarter match card (top-left to bottom-right)
  const createQuarterDiagonalLine = (quarterMatch: BracketMatch, color: string = "#667eea") => {
    console.log(`=== CREATE QUARTER DIAGONAL LINE CALLED ===`);
    console.log(`Match: ${quarterMatch.id}`);
    console.log(`Total layouts available: ${Object.keys(matchLayouts).length}`);
    console.log(`Available match IDs: ${Object.keys(matchLayouts).join(', ')}`);
    
    const absoluteLayout = matchLayouts[quarterMatch.id];
    
    console.log(`Absolute layout (${quarterMatch.id}): ${absoluteLayout ? 'EXISTS' : 'MISSING'}`);
    
    if (!absoluteLayout) {
      console.log(`Missing absolute layout for quarter diagonal line: ${quarterMatch.id}`);
      return null;
    }
    
    // Line from top-left to bottom-right of the same card using ABSOLUTE coordinates
    const x1 = absoluteLayout.x;  // Top-left (absolute position)
    const y1 = absoluteLayout.y;  // Top-left (absolute position)
    const x2 = absoluteLayout.x + absoluteLayout.width;   // Bottom-right (absolute position)
    const y2 = absoluteLayout.y + absoluteLayout.height;  // Bottom-right (absolute position)
    
    console.log(`=== QUARTER DIAGONAL LINE (USING ABSOLUTE COORDINATES) ===`);
    console.log(`Match ${quarterMatch.id}: USING absoluteLayout x=${absoluteLayout.x}, y=${absoluteLayout.y}, w=${absoluteLayout.width}, h=${absoluteLayout.height}`);
    console.log(`Diagonal line: top-left (${x1},${y1}) -> bottom-right (${x2},${y2})`);
    console.log(`This should be different for each quarter match!`);
    
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
      console.log(`Missing ABSOLUTE layout data: ${quarterMatch1.id}=${!!absoluteLayout1}, ${quarterMatch2.id}=${!!absoluteLayout2}, ${semiMatch.id}=${!!absoluteLayout3}`);
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
    
    console.log(`=== SIDE DETERMINATION FOR LINE: ${quarterMatch1.id}, ${quarterMatch2.id} -> ${semiMatch.id} ===`);
    console.log(`Match 1 (${quarterMatch1.id}) x position: ${absoluteLayout1.x}`);
    console.log(`Match 2 (${quarterMatch2.id}) x position: ${absoluteLayout2.x}`);
    console.log(`Match 3 (${semiMatch.id}) x position: ${absoluteLayout3.x}`);
    console.log(`Target (${semiMatch.id}) is to the ${absoluteLayout3.x > absoluteLayout1.x ? 'RIGHT' : 'LEFT'} of source (${quarterMatch1.id})`);
    console.log(`Is left side: ${isLeftSide} (target x=${absoluteLayout3.x} > source x=${absoluteLayout1.x})`);
    
    // Additional debug: Show which side each match is on
    console.log(`Match ${quarterMatch1.id} side: ${quarterMatch1.side}`);
    console.log(`Match ${quarterMatch2.id} side: ${quarterMatch2.side}`);
    console.log(`Match ${semiMatch.id} side: ${semiMatch.side}`);
    
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
    
    console.log(`=== USING ABSOLUTE COORDINATES FROM matchLayouts ===`);
    console.log(`Quarter match 1 (${quarterMatch1.id}): USING absoluteLayout x=${absoluteLayout1.x}, y=${absoluteLayout1.y}, w=${absoluteLayout1.width}, h=${absoluteLayout1.height}`);
    console.log(`Quarter match 2 (${quarterMatch2.id}): USING absoluteLayout x=${absoluteLayout2.x}, y=${absoluteLayout2.y}, w=${absoluteLayout2.width}, h=${absoluteLayout2.height}`);
    console.log(`Semi match (${semiMatch.id}): USING absoluteLayout x=${absoluteLayout3.x}, y=${absoluteLayout3.y}, w=${absoluteLayout3.width}, h=${absoluteLayout3.height}`);
    console.log(`Calculated line points (USING EDGES + OFFSET):`);
    console.log(`x1=${x1}, y1=${y1} (quarter 1 right edge + ${xOffset}x + ${yOffset}y offset)`);
    console.log(`x2=${x2}, y2=${y2} (quarter 2 right edge + ${xOffset}x + ${yOffset}y offset)`);
    console.log(`x3=${x3}, y3=${y3} (semi left edge - ${xOffset}x + ${yOffset}y offset)`);
    
    // Calculate intermediate points - simple and clean
    const x4 = (x1 + x3) / 2;  // Middle point between quarter 1 and semi
    const y4 = y1;
    const x5 = x4;  // Same X as x4 for vertical connection
    const y5 = y2;
    const x6 = x4;  // Same X as x4 for final connection
    const y6 = (y4 + y5) / 2;  // Vertical middle between the two horizontal lines
    
    // Debug: Show all calculated points
    console.log(`All calculated points:`);
    console.log(`x1=${x1}, y1=${y1} (quarter 1 right edge)`);
    console.log(`x2=${x2}, y2=${y2} (quarter 2 right edge)`);
    console.log(`x3=${x3}, y3=${y3} (semi left edge)`);
    console.log(`x4=${x4}, y4=${y4} (middle upper)`);
    console.log(`x5=${x5}, y5=${y5} (middle lower)`);
    console.log(`x6=${x6}, y6=${y6} (middle of middle)`);
    
    // Debug: Show the actual layout data used
    console.log(`=== ABSOLUTE LAYOUT DATA USED ===`);
    console.log(`Quarter 1 absolute layout: x=${absoluteLayout1.x}, y=${absoluteLayout1.y}, width=${absoluteLayout1.width}, height=${absoluteLayout1.height}`);
    console.log(`Quarter 2 absolute layout: x=${absoluteLayout2.x}, y=${absoluteLayout2.y}, width=${absoluteLayout2.width}, height=${absoluteLayout2.height}`);
    console.log(`Semi absolute layout: x=${absoluteLayout3.x}, y=${absoluteLayout3.y}, width=${absoluteLayout3.width}, height=${absoluteLayout3.height}`);
    console.log(`Quarter 1 edge+offset calculation: ${absoluteLayout1.x} + ${absoluteLayout1.width} + ${xOffset} = ${x1}`);
    console.log(`Quarter 2 edge+offset calculation: ${absoluteLayout2.x} + ${absoluteLayout2.width} + ${xOffset} = ${x2}`);
    console.log(`Semi edge+offset calculation: ${absoluteLayout3.x} - ${xOffset} = ${x3}`);
    
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

        console.log(`=== LINES CREATED FOR: ${quarterMatch1.id}, ${quarterMatch2.id} -> ${semiMatch.id} ===`);
        console.log(`SIDE: ${isLeftSide ? 'LEFT (going right)' : 'RIGHT (going left)'}`);
        console.log(`Line 1: (${x1},${y1}) -> (${x4},${y4}) - horizontal from quarter 1`);
        console.log(`Line 2: (${x2},${y2}) -> (${x5},${y5}) - horizontal from quarter 2`);
        console.log(`Line 3: (${x4},${y4}) -> (${x5},${y5}) - vertical connecting`);
        console.log(`Line 4: (${x6},${y6}) -> (${x3},${y3}) - final to semi`);
        console.log(`---`);
    
    // Debug distances
    const distanceX1toX3 = Math.abs(x3 - x1);
    const distanceX2toX3 = Math.abs(x3 - x2);
    console.log(`=== DISTANCES ===`);
    console.log(`Distance from quarter 1 to semi: ${distanceX1toX3}px`);
    console.log(`Distance from quarter 2 to semi: ${distanceX2toX3}px`);
    console.log(`This explains why the lines are so short!`);

    return lines;
  };

  const fetchPredictions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Fetch all knockout predictions
      const allPredictions = await apiService.getKnockoutPredictions(userId);
      console.log('All predictions:', allPredictions.map(p => ({ 
        id: p.template_match_id, 
        stage: p.stage, 
        name: `${p.team1_name} vs ${p.team2_name}` 
      })));
      setPredictions(allPredictions);
      
      // Organize into bracket structure
      const { organized, calculateCardCoordinates } = organizeBracketMatches(allPredictions);
      
      // Calculate card coordinates with current spacing
      const spacing = (AVAILABLE_HEIGHT - 40) / 8;
      calculateCardCoordinates(spacing);
      
      console.log('Organized bracket structure:', {
        round32_left: organized.round32_left.length,
        round16_left: organized.round16_left.length,
        quarter_left: organized.quarter_left.length,
        semi: organized.semi.length,
        final: organized.final.length
      });
      console.log('Quarter left matches with coordinates:', organized.quarter_left.map((m: any) => ({ 
        id: m.id, 
        stage: m.stage, 
        name: `${m.team1_name} vs ${m.team2_name}`,
        coords: { topLeftX: m.topLeftX, topLeftY: m.topLeftY, bottomRightX: m.bottomRightX, bottomRightY: m.bottomRightY }
      })));
      
      // Debug: Check which columns have content
      console.log('Column content check:', {
        round32_left: organized.round32_left.length,
        round16_left: organized.round16_left.length,
        quarter_left: organized.quarter_left.length,
        semi: organized.semi.length,
        final: organized.final.length
      });
      setOrganizedBracket(organized);
      
    } catch (error) {
      console.error('Error fetching bracket predictions:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת הבראקט');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch data when component mounts or comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchPredictions();
    }, [])
  );

  const handleMatchPress = (match: BracketMatch) => {
    // Future: Navigate to match editing
    console.log('Match pressed:', match);
    Alert.alert('משחק נבחר', `משחק ${match.id} - ${match.team1_name} vs ${match.team2_name}`);
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
            const calculatedMarginTop = (match.verticalPosition || index) * spacing;
            console.log(`=== VISUAL POSITIONING FOR MATCH ${match.id} ===`);
            console.log(`Column index: ${columnIndex}`);
            console.log(`Match verticalPosition: ${match.verticalPosition}`);
            console.log(`Match index: ${index}`);
            console.log(`Spacing: ${spacing}`);
            console.log(`Calculated marginTop: ${calculatedMarginTop}`);
            console.log(`This determines the ACTUAL visual position on screen!`);
            console.log(`---`);
            
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
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* SVG overlay for bracket lines */}
        <Svg 
          style={[styles.bracketLines, { height: AVAILABLE_HEIGHT }]}
          width={screenWidth * 3} // Wide enough for all columns (including right side at x=1155)
          height={AVAILABLE_HEIGHT}
        >
          {/* Quarter diagonal lines - one for each quarter match */}
          {organizedBracket && (() => {
            console.log(`=== QUARTER MATCHES DEBUG ===`);
            console.log(`Quarter left: ${organizedBracket.quarter_left.map(m => `${m.id}(${m.team1_name}vs${m.team2_name})`).join(', ')}`);
            console.log(`Quarter right: ${organizedBracket.quarter_right.map(m => `${m.id}(${m.team1_name}vs${m.team2_name})`).join(', ')}`);
            return null;
          })()}
          
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
              
              console.log(`Drawing lines for Round 32 to Round 16 (Left side):`);
              console.log(`Connection 1: ${round32Match74?.id}, ${round32Match77?.id} -> ${round16Match89?.id}`);
              console.log(`Connection 2: ${round32Match73?.id}, ${round32Match75?.id} -> ${round16Match90?.id}`);
              console.log(`Connection 3: ${round32Match83?.id}, ${round32Match84?.id} -> ${round16Match93?.id}`);
              console.log(`Connection 4: ${round32Match81?.id}, ${round32Match82?.id} -> ${round16Match94?.id}`);
              
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
              
              console.log(`Drawing lines for Round 16 to Quarter (Left side):`);
              console.log(`Connection 1: ${round16Match89?.id}, ${round16Match90?.id} -> ${quarterMatch97?.id}`);
              console.log(`Connection 2: ${round16Match93?.id}, ${round16Match94?.id} -> ${quarterMatch98?.id}`);
              
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
      console.log(`Drawing lines for Quarter to Semi: ${organizedBracket.quarter_left[0].id}, ${organizedBracket.quarter_left[1].id}, ${organizedBracket.semi.find(s => s.id === 101)!.id}`);
      console.log(`Available layouts: ${Object.keys(matchLayouts).length} total`);
      
      // Debug: Show layouts for the specific matches we need
      console.log(`Layout for match 97:`, matchLayouts[97]);
      console.log(`Layout for match 98:`, matchLayouts[98]);
      console.log(`Layout for match 101:`, matchLayouts[101]);
      
      // Debug: Check if matches are overlapping
      if (matchLayouts[97] && matchLayouts[98] && matchLayouts[101]) {
        const samePosition = matchLayouts[97].x === matchLayouts[98].x && 
                           matchLayouts[97].x === matchLayouts[101].x &&
                           matchLayouts[97].y === matchLayouts[98].y && 
                           matchLayouts[97].y === matchLayouts[101].y;
        console.log(`All three matches are at the same position: ${samePosition}`);
        if (samePosition) {
          console.log(`This means the cards are overlapping on screen!`);
        }
        
      // Debug: Show distance between matches
      console.log(`Distance between 97 and 98 (should be different Y): ${Math.abs(matchLayouts[97].y - matchLayouts[98].y)}`);
      console.log(`Distance between 97 and 101 (should be different X): ${Math.abs(matchLayouts[97].x - matchLayouts[101].x)}`);
      console.log(`Distance between 98 and 101 (should be different X): ${Math.abs(matchLayouts[98].x - matchLayouts[101].x)}`);
      
      // Debug: Check expected column positions
      console.log(`=== COLUMN POSITION DEBUG ===`);
      console.log(`Match 97 should be in quarter_left column (logical 2), actual X: ${matchLayouts[97].x}`);
      console.log(`Match 98 should be in quarter_left column (logical 2), actual X: ${matchLayouts[98].x}`);
      console.log(`Match 101 should be in semi column (logical 3), actual X: ${matchLayouts[101].x}`);
      console.log(`Expected column 2 X position: ${2 * (COLUMN_WIDTH + 20)} (${COLUMN_WIDTH + 20} * 2)`);
      console.log(`Expected column 3 X position: ${3 * (COLUMN_WIDTH + 20)} (${COLUMN_WIDTH + 20} * 3)`);
      
      // Debug: Calculate actual column spacing
      const actualColumnSpacing = matchLayouts[101].x - matchLayouts[97].x;
      console.log(`Actual column spacing: ${actualColumnSpacing}px (between quarter and semi)`);
      console.log(`Theoretical column spacing: ${COLUMN_WIDTH + 20}px`);
      console.log(`Difference: ${actualColumnSpacing - (COLUMN_WIDTH + 20)}px`);
    }
              return createPreciseBracketLines(
                organizedBracket.quarter_left[0], 
                organizedBracket.quarter_left[1], 
                organizedBracket.semi.find(s => s.id === 101)!
              );
            })()
          }
          
          {/* Lines from Round 32 Right to Round 16 Right (Right side) */}
          {(() => {
            console.log(`🔍 CHECKING RIGHT SIDE CONDITIONS:`);
            console.log(`organizedBracket exists: ${!!organizedBracket}`);
            if (organizedBracket) {
              console.log(`round32_right.length: ${organizedBracket.round32_right.length} (need >= 8)`);
              console.log(`round16_right.length: ${organizedBracket.round16_right.length} (need >= 4)`);
              console.log(`round32_right matches: ${organizedBracket.round32_right.map(m => m.id).join(', ')}`);
              console.log(`round16_right matches: ${organizedBracket.round16_right.map(m => m.id).join(', ')}`);
            }
            return null;
          })()}
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
              
              console.log(`Drawing lines for Round 32 to Round 16 (Right side):`);
              console.log(`Connection 1: ${round32Match76?.id}, ${round32Match78?.id} -> ${round16Match91?.id}`);
              console.log(`Connection 2: ${round32Match79?.id}, ${round32Match80?.id} -> ${round16Match92?.id}`);
              console.log(`Connection 3: ${round32Match86?.id}, ${round32Match88?.id} -> ${round16Match95?.id}`);
              console.log(`Connection 4: ${round32Match85?.id}, ${round32Match87?.id} -> ${round16Match96?.id}`);
              
              const lines = [];
              
              // Only draw lines if all matches exist
              if (round32Match76 && round32Match78 && round16Match91) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 76, 78 -> 91`);
                lines.push(...createPreciseBracketLines(round32Match76, round32Match78, round16Match91));
              }
              if (round32Match79 && round32Match80 && round16Match92) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 79, 80 -> 92`);
                lines.push(...createPreciseBracketLines(round32Match79, round32Match80, round16Match92));
              }
              if (round32Match86 && round32Match88 && round16Match95) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 86, 88 -> 95`);
                lines.push(...createPreciseBracketLines(round32Match86, round32Match88, round16Match95));
              }
              if (round32Match85 && round32Match87 && round16Match96) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 85, 87 -> 96`);
                lines.push(...createPreciseBracketLines(round32Match85, round32Match87, round16Match96));
              }
              
              return lines;
            })()
          }
          
          {/* Lines from Round 16 Right to Quarter Right (Right side) */}
          {(() => {
            console.log(`🔍 CHECKING RIGHT SIDE Round16->Quarter CONDITIONS:`);
            if (organizedBracket) {
              console.log(`round16_right.length: ${organizedBracket.round16_right.length} (need >= 4)`);
              console.log(`quarter_right.length: ${organizedBracket.quarter_right.length} (need >= 2)`);
            }
            return null;
          })()}
          {organizedBracket && organizedBracket.round16_right.length >= 4 && organizedBracket.quarter_right.length >= 2 && 
            (() => {
              // Find matches by ID for right side
              const round16Match91 = organizedBracket.round16_right.find(m => m.id === 91);
              const round16Match92 = organizedBracket.round16_right.find(m => m.id === 92);
              const quarterMatch99 = organizedBracket.quarter_right.find(m => m.id === 99);
              
              const round16Match95 = organizedBracket.round16_right.find(m => m.id === 95);
              const round16Match96 = organizedBracket.round16_right.find(m => m.id === 96);
              const quarterMatch100 = organizedBracket.quarter_right.find(m => m.id === 100);
              
              console.log(`Drawing lines for Round 16 to Quarter (Right side):`);
              console.log(`Connection 1: ${round16Match91?.id}, ${round16Match92?.id} -> ${quarterMatch99?.id}`);
              console.log(`Connection 2: ${round16Match95?.id}, ${round16Match96?.id} -> ${quarterMatch100?.id}`);
              
              const lines = [];
              
              // Only draw lines if all matches exist
              if (round16Match91 && round16Match92 && quarterMatch99) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 91, 92 -> 99`);
                lines.push(...createPreciseBracketLines(round16Match91, round16Match92, quarterMatch99));
              }
              if (round16Match95 && round16Match96 && quarterMatch100) {
                console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 95, 96 -> 100`);
                lines.push(...createPreciseBracketLines(round16Match95, round16Match96, quarterMatch100));
              }
              
              return lines;
            })()
          }
          
          {/* Lines from Quarter Right to Semi Final 102 (Right side) */}
          {(() => {
            console.log(`🔍 CHECKING RIGHT SIDE Quarter->Semi CONDITIONS:`);
            if (organizedBracket) {
              console.log(`quarter_right.length: ${organizedBracket.quarter_right.length} (need === 2)`);
              console.log(`semi.find(102): ${!!organizedBracket.semi.find(s => s.id === 102)}`);
              console.log(`quarter_right matches: ${organizedBracket.quarter_right.map(m => m.id).join(', ')}`);
              console.log(`semi matches: ${organizedBracket.semi.map(m => m.id).join(', ')}`);
            }
            return null;
          })()}
          {organizedBracket && organizedBracket.quarter_right.length === 2 && organizedBracket.semi.find(s => s.id === 102) && 
            (() => {
              console.log(`🎯 CALLING createPreciseBracketLines for RIGHT SIDE: 99, 100 -> 102`);
              console.log(`Drawing lines for Quarter to Semi (Right side): ${organizedBracket.quarter_right[0].id}, ${organizedBracket.quarter_right[1].id}, ${organizedBracket.semi.find(s => s.id === 102)!.id}`);
              
              return createPreciseBracketLines(
                organizedBracket.quarter_right[0], 
                organizedBracket.quarter_right[1], 
                organizedBracket.semi.find(s => s.id === 102)!
              );
            })()
          }
          
          {/* Lines from Semi Finals to Final - Removed for now, will be added later */}
        </Svg>
        {/* Column 1: Round 32 Left */}
        {renderColumn('32 אחרונות (שמאל)', organizedBracket.round32_left, false, 0)}
        
        {/* Column 2: Round 16 Left */}
        {renderColumn('16 אחרונות (שמאל)', organizedBracket.round16_left, false, 1)}
        
        {/* Column 3: Quarter Left (97, 98) */}
        {renderColumn('רבע (שמאל)', organizedBracket.quarter_left, false, 2)}
        
        {/* Column 4: Semi Final 101 (Left side) */}
        {renderColumn('חצי גמר 101', organizedBracket.semi.filter(match => match.id === 101), false, 3)}
        
        {/* Column 5: Final (104) - Center */}
        {renderColumn('גמר', organizedBracket.final, true, 4)}
        
        {/* Column 6: Semi Final 102 (Right side) */}
        {renderColumn('חצי גמר 102', organizedBracket.semi.filter(match => match.id === 102), false, 5)}
        
        {/* Column 7: Quarter Right (99, 100) */}
        {renderColumn('רבע (ימין)', organizedBracket.quarter_right, false, 6)}
        
        {/* Column 8: Round 16 Right */}
        {renderColumn('16 אחרונות (ימין)', organizedBracket.round16_right, false, 7)}
        
        {/* Column 9: Round 32 Right */}
        {renderColumn('32 אחרונות (ימין)', organizedBracket.round32_right, false, 8)}
      </ScrollView>
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
    paddingVertical: 20,
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
  },
  finalColumn: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 3,
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  // Removed column titles to save space
  matchesContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    minHeight: AVAILABLE_HEIGHT, // Use calculated available height
    paddingBottom: 20, // Extra padding to prevent cutoff
  },
  matchWrapper: {
    alignItems: 'center',
    position: 'absolute',
    width: '100%',
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
});
