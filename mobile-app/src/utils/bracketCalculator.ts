/**
 * Utility functions for calculating bracket sides and organizing matches
 */

// Constants for bracket layout
const COLUMN_WIDTH = 120;
const CARD_WIDTH = 90;
const CARD_HEIGHT = 60;

/**
 * Calculate actual card coordinates for a match based on its column and position
 */
function getCardCoordinates(
  columnIndex: number, 
  verticalPosition: number, 
  spacing: number
): { topLeftX: number; topLeftY: number; bottomRightX: number; bottomRightY: number } {
  
  // Calculate column position
  const columnX = columnIndex * (COLUMN_WIDTH + 20);
  const columnCenterX = columnX + (COLUMN_WIDTH / 2);
  
  // Calculate card position within column (centered)
  const cardX = columnCenterX - (CARD_WIDTH / 2);
  const cardY = (verticalPosition * spacing);
  
  return {
    topLeftX: cardX,
    topLeftY: cardY,
    bottomRightX: cardX + CARD_WIDTH,
    bottomRightY: cardY + CARD_HEIGHT
  };
}

export interface BracketMatch {
  id: number;
  stage: string;
  team1_id?: number;
  team2_id?: number;
  team1_name?: string;
  team2_name?: string;
  team1_flag?: string;
  team2_flag?: string;
  winner_team_id?: number;
  side: 'left' | 'right';
  verticalPosition?: number;
  // Card coordinates - top-left and bottom-right corners
  topLeftX?: number;
  topLeftY?: number;
  bottomRightX?: number;
  bottomRightY?: number;
}

export interface OrganizedBracket {
  round32_left: BracketMatch[];
  round32_right: BracketMatch[];
  round16_left: BracketMatch[];
  round16_right: BracketMatch[];
  quarter_left: BracketMatch[];
  quarter_right: BracketMatch[];
  semi: BracketMatch[];
  final: BracketMatch[];
}

/**
 * Get the next match ID for a given match based on the bracket structure
 */
function getNextMatchId(matchId: number): number {
  // Based on the match template structure
  const nextMatches: { [key: number]: number } = {
    // Round32 to Round16
    73: 90, 74: 89, 75: 90, 76: 91, 77: 89, 78: 91, 79: 92, 80: 92,
    81: 94, 82: 94, 83: 93, 84: 93, 85: 96, 86: 95, 87: 96, 88: 95,
    
    // Round16 to Quarter
    89: 97, 90: 97, 91: 99, 92: 99, 93: 98, 94: 98, 95: 100, 96: 100,
    
    // Quarter to Semi
    97: 101, 98: 101, 99: 102, 100: 102,
    
    // Semi to Final
    101: 104, 102: 104
  };
  
  return nextMatches[matchId] || 0;
}

/**
 * Calculate which side of the bracket a match belongs to
 * by tracing the winner_next_knockout_match path up to semi-finals
 */
export function calculateMatchSide(matchId: number): 'left' | 'right' {
  // Semi-final matches
  if (matchId === 101) return 'left';   // Semi 1 (leads to final position 1)
  if (matchId === 102) return 'right';  // Semi 2 (leads to final position 2)
  
  // Quarter-final matches
  if (matchId === 97 || matchId === 98) return 'left';   // Lead to semi 101
  if (matchId === 99 || matchId === 100) return 'right'; // Lead to semi 102
  
  // Round of 16 matches
  if (matchId === 89 || matchId === 90 || matchId === 93 || matchId === 94) return 'left';   // Lead to quarter 97/98
  if (matchId === 91 || matchId === 92 || matchId === 95 || matchId === 96) return 'right'; // Lead to quarter 99/100
  
  // Round of 32 matches
  // Left side matches (lead to round16 left side)
  if (matchId === 74 || matchId === 77 || matchId === 73 || matchId === 75 || 
      matchId === 83 || matchId === 84 || matchId === 81 || matchId === 82) {
    return 'left';
  }
  
  // Right side matches (lead to round16 right side)
  if (matchId === 76 || matchId === 78 || matchId === 79 || matchId === 80 || 
      matchId === 86 || matchId === 88 || matchId === 85 || matchId === 87) {
    return 'right';
  }
  
  // Default fallback
  return 'left';
}

/**
 * Organize matches by stage and side for bracket display
 */
export function organizeBracketMatches(predictions: any[]): { organized: OrganizedBracket; calculateCardCoordinates: (spacing: number) => void } {
  const organized: OrganizedBracket = {
    round32_left: [],
    round32_right: [],
    round16_left: [],
    round16_right: [],
    quarter_left: [],
    quarter_right: [],
    semi: [],
    final: []
  };

  predictions.forEach(prediction => {
    const matchId = prediction.template_match_id;
    const side = calculateMatchSide(matchId);
    
    const bracketMatch: BracketMatch = {
      id: matchId,
      stage: prediction.stage,
      team1_id: prediction.team1_id,
      team2_id: prediction.team2_id,
      team1_name: prediction.team1_name,
      team2_name: prediction.team2_name,
      team1_flag: prediction.team1_flag,
      team2_flag: prediction.team2_flag,
      winner_team_id: prediction.winner_team_id,
      side
    };

    // Organize by stage and side
    switch (prediction.stage) {
      case 'round32':
        if (side === 'left') {
          organized.round32_left.push(bracketMatch);
        } else {
          organized.round32_right.push(bracketMatch);
        }
        break;
      case 'round16':
        if (side === 'left') {
          organized.round16_left.push(bracketMatch);
        } else {
          organized.round16_right.push(bracketMatch);
        }
        break;
      case 'quarter':
        if (side === 'left') {
          organized.quarter_left.push(bracketMatch);
        } else {
          organized.quarter_right.push(bracketMatch);
        }
        break;
      case 'semi':
        organized.semi.push(bracketMatch);
        break;
      case 'final':
        organized.final.push(bracketMatch);
        break;
    }
  });

  // Sort matches within each group by match ID for consistent ordering
  // But for better bracket visualization, group matches that lead to the same next match
  Object.keys(organized).forEach(key => {
    (organized as any)[key].sort((a: BracketMatch, b: BracketMatch) => a.id - b.id);
  });

  // Special sorting for better bracket flow:
  // Group matches that lead to the same next match together
  const sortMatchesByNextMatch = (matches: BracketMatch[]) => {
    return matches.sort((a, b) => {
      // For Round32 matches, group by their next Round16 match
      if (a.stage === 'round32') {
        const aNextMatch = getNextMatchId(a.id);
        const bNextMatch = getNextMatchId(b.id);
        if (aNextMatch !== bNextMatch) {
          return aNextMatch - bNextMatch;
        }
      }
      // For Round16 matches, group by their next Quarter match
      if (a.stage === 'round16') {
        const aNextMatch = getNextMatchId(a.id);
        const bNextMatch = getNextMatchId(b.id);
        if (aNextMatch !== bNextMatch) {
          return aNextMatch - bNextMatch;
        }
      }
      // Default sort by match ID
      return a.id - b.id;
    });
  };

  // Apply special sorting to each group
  organized.round32_left = sortMatchesByNextMatch(organized.round32_left);
  organized.round32_right = sortMatchesByNextMatch(organized.round32_right);
  organized.round16_left = sortMatchesByNextMatch(organized.round16_left);
  organized.round16_right = sortMatchesByNextMatch(organized.round16_right);
  organized.quarter_left = sortMatchesByNextMatch(organized.quarter_left);
  organized.quarter_right = sortMatchesByNextMatch(organized.quarter_right);

  // Calculate proper vertical positioning for bracket flow
  // The goal is to position matches so that the next match is centered between its two source matches
  
  const calculateVerticalPositions = () => {
    // Round32 matches get sequential positions (0, 1, 2, 3...) - compact spacing to fit screen
    organized.round32_left = organized.round32_left.map((match, index) => ({
      ...match,
      verticalPosition: index // Compact spacing for screen fitting
    }));
    
    organized.round32_right = organized.round32_right.map((match, index) => ({
      ...match,
      verticalPosition: index // Compact spacing for screen fitting
    }));

    // Round16 matches are positioned at the center of their two source Round32 matches
    organized.round16_left = organized.round16_left.map((match) => {
      const sourceMatches = organized.round32_left.filter(m => getNextMatchId(m.id) === match.id);
      if (sourceMatches.length === 2) {
        // Calculate the center of each source match (position + half height of card)
        const cardHeight = 60; // Height of the match card (this should match BracketMatchCard height)
        const center1 = sourceMatches[0].verticalPosition! + (cardHeight / 2);
        const center2 = sourceMatches[1].verticalPosition! + (cardHeight / 2);
        const avgCenter = (center1 + center2) / 2;
        // Position the new match so its center is at the average center
        const newPosition = avgCenter - (cardHeight / 2);
        
        console.log(`Round16 LEFT match ${match.id}:`);
        console.log(`  Source match ${sourceMatches[0].id} position: ${sourceMatches[0].verticalPosition}, center: ${center1}`);
        console.log(`  Source match ${sourceMatches[1].id} position: ${sourceMatches[1].verticalPosition}, center: ${center2}`);
        console.log(`  Average center: ${avgCenter}, new position: ${newPosition}, new center: ${newPosition + 40}`);
        
        return { ...match, verticalPosition: newPosition };
      }
      return { ...match, verticalPosition: 0 };
    });

    organized.round16_right = organized.round16_right.map((match) => {
      const sourceMatches = organized.round32_right.filter(m => getNextMatchId(m.id) === match.id);
      if (sourceMatches.length === 2) {
        // Calculate the center of each source match (position + half height of card)
        const cardHeight = 60; // Height of the match card (this should match BracketMatchCard height)
        const center1 = sourceMatches[0].verticalPosition! + (cardHeight / 2);
        const center2 = sourceMatches[1].verticalPosition! + (cardHeight / 2);
        const avgCenter = (center1 + center2) / 2;
        // Position the new match so its center is at the average center
        const newPosition = avgCenter - (cardHeight / 2);
        
        console.log(`Round16 RIGHT match ${match.id}:`);
        console.log(`  Source match ${sourceMatches[0].id} position: ${sourceMatches[0].verticalPosition}, center: ${center1}`);
        console.log(`  Source match ${sourceMatches[1].id} position: ${sourceMatches[1].verticalPosition}, center: ${center2}`);
        console.log(`  Average center: ${avgCenter}, new position: ${newPosition}, new center: ${newPosition + 40}`);
        
        return { ...match, verticalPosition: newPosition };
      }
      return { ...match, verticalPosition: 0 };
    });

    // Quarter matches are positioned at the center of their two source Round16 matches
    organized.quarter_left = organized.quarter_left.map((match) => {
      const sourceMatches = organized.round16_left.filter(m => getNextMatchId(m.id) === match.id);
      if (sourceMatches.length === 2) {
        // Calculate the center of each source match (position + half height of card)
        const cardHeight = 60; // Height of the match card (this should match BracketMatchCard height)
        const center1 = sourceMatches[0].verticalPosition! + (cardHeight / 2);
        const center2 = sourceMatches[1].verticalPosition! + (cardHeight / 2);
        const avgCenter = (center1 + center2) / 2;
        // Position the new match so its center is at the average center
        const newPosition = avgCenter - (cardHeight / 2);
        
        console.log(`Quarter LEFT match ${match.id}:`);
        console.log(`  Source match ${sourceMatches[0].id} position: ${sourceMatches[0].verticalPosition}, center: ${center1}`);
        console.log(`  Source match ${sourceMatches[1].id} position: ${sourceMatches[1].verticalPosition}, center: ${center2}`);
        console.log(`  Average center: ${avgCenter}, new position: ${newPosition}, new center: ${newPosition + 40}`);
        
        return { ...match, verticalPosition: newPosition };
      }
      return { ...match, verticalPosition: 0 };
    });

    organized.quarter_right = organized.quarter_right.map((match) => {
      const sourceMatches = organized.round16_right.filter(m => getNextMatchId(m.id) === match.id);
      if (sourceMatches.length === 2) {
        // Calculate the center of each source match (position + half height of card)
        const cardHeight = 60; // Height of the match card (this should match BracketMatchCard height)
        const center1 = sourceMatches[0].verticalPosition! + (cardHeight / 2);
        const center2 = sourceMatches[1].verticalPosition! + (cardHeight / 2);
        const avgCenter = (center1 + center2) / 2;
        // Position the new match so its center is at the average center
        const newPosition = avgCenter - (cardHeight / 2);
        return { ...match, verticalPosition: newPosition };
      }
      return { ...match, verticalPosition: 0 };
    });

    // Semi matches are positioned at the center of their two source Quarter matches
    organized.semi = organized.semi.map((match) => {
      let sourceMatches: BracketMatch[] = [];
      if (match.id === 101) {
        sourceMatches = organized.quarter_left;
      } else if (match.id === 102) {
        sourceMatches = organized.quarter_right;
      }
      
      if (sourceMatches.length === 2) {
        // Calculate the center of each source match (position + half height of card)
        const cardHeight = 60; // Height of the match card (this should match BracketMatchCard height)
        const center1 = sourceMatches[0].verticalPosition! + (cardHeight / 2);
        const center2 = sourceMatches[1].verticalPosition! + (cardHeight / 2);
        const avgCenter = (center1 + center2) / 2;
        // Position the new match so its center is at the average center
        const newPosition = avgCenter - (cardHeight / 2);
        return { ...match, verticalPosition: newPosition };
      }
      return { ...match, verticalPosition: 0 };
    });

    // Final is positioned at the center of the two Semi matches
    if (organized.final.length > 0 && organized.semi.length === 2) {
      // Calculate the center of each semi match (position + half height of card)
      const cardHeight = 80; // Height of the match card
      const center1 = organized.semi[0].verticalPosition! + (cardHeight / 2);
      const center2 = organized.semi[1].verticalPosition! + (cardHeight / 2);
      const avgCenter = (center1 + center2) / 2;
      // Position the final match so its center is at the average center
      const newPosition = avgCenter - (cardHeight / 2);
      organized.final = organized.final.map(match => ({
        ...match,
        verticalPosition: newPosition
      }));
    }
  };

  calculateVerticalPositions();

  // Calculate actual card coordinates for all matches
  const calculateCardCoordinates = (spacing: number) => {
    // First, determine the visual column index (accounting for empty columns)
    const getVisualColumnIndex = (logicalColumnIndex: number): number => {
      let visualIndex = 0;
      
      // Check each column from left to right
      const columnChecks = [
        { data: organized.round32_left, logical: 0 },
        { data: organized.round16_left, logical: 1 },
        { data: organized.quarter_left, logical: 2 },
        { data: organized.semi.filter(m => m.id === 101), logical: 3 },
        { data: organized.final, logical: 4 },
        { data: organized.semi.filter(m => m.id === 102), logical: 5 },
        { data: organized.quarter_right, logical: 6 },
        { data: organized.round16_right, logical: 7 },
        { data: organized.round32_right, logical: 8 }
      ];
      
      for (const check of columnChecks) {
        if (check.data.length > 0) {
          if (check.logical === logicalColumnIndex) {
            return visualIndex;
          }
          visualIndex++;
        }
      }
      
      return logicalColumnIndex; // Fallback
    };
    // Round32 Left (Column 0)
    organized.round32_left = organized.round32_left.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(0), match.verticalPosition || 0, spacing)
    }));
    
    // Round32 Right (Column 8)
    organized.round32_right = organized.round32_right.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(8), match.verticalPosition || 0, spacing)
    }));
    
    // Round16 Left (Column 1)
    organized.round16_left = organized.round16_left.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(1), match.verticalPosition || 0, spacing)
    }));
    
    // Round16 Right (Column 7)
    organized.round16_right = organized.round16_right.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(7), match.verticalPosition || 0, spacing)
    }));
    
    // Quarter Left (Column 2)
    organized.quarter_left = organized.quarter_left.map(match => {
      const visualCol = getVisualColumnIndex(2);
      const coords = getCardCoordinates(visualCol, match.verticalPosition || 0, spacing);
      console.log(`Quarter match ${match.id}: visual column ${visualCol}, coords:`, coords);
      return {
        ...match,
        ...coords
      };
    });
    
    // Quarter Right (Column 6)
    organized.quarter_right = organized.quarter_right.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(6), match.verticalPosition || 0, spacing)
    }));
    
    // Semi matches (Columns 3 and 5)
    organized.semi = organized.semi.map(match => {
      const logicalColumnIndex = match.id === 101 ? 3 : 5; // Semi 101 is left, Semi 102 is right
      const visualCol = getVisualColumnIndex(logicalColumnIndex);
      const coords = getCardCoordinates(visualCol, match.verticalPosition || 0, spacing);
      console.log(`Semi match ${match.id}: logical column ${logicalColumnIndex}, visual column ${visualCol}, coords:`, coords);
      return {
        ...match,
        ...coords
      };
    });
    
    // Final (Column 4)
    organized.final = organized.final.map(match => ({
      ...match,
      ...getCardCoordinates(getVisualColumnIndex(4), match.verticalPosition || 0, spacing)
    }));
  };

  return { organized, calculateCardCoordinates };
}

/**
 * Get team abbreviation (3 letters) from full team name
 */
export function getTeamAbbreviation(teamName?: string): string {
  if (!teamName || teamName === 'TBD') return 'TBD';
  
  // Common team abbreviations
  const abbreviations: { [key: string]: string } = {
    'Brazil': 'BRA',
    'Argentina': 'ARG', 
    'France': 'FRA',
    'Germany': 'GER',
    'Spain': 'ESP',
    'England': 'ENG',
    'Portugal': 'POR',
    'Netherlands': 'NED',
    'Belgium': 'BEL',
    'Italy': 'ITA',
    'Croatia': 'CRO',
    'Uruguay': 'URU',
    'Colombia': 'COL',
    'Mexico': 'MEX',
    'United States': 'USA',
    'Canada': 'CAN',
    'Morocco': 'MAR',
    'Senegal': 'SEN',
    'Nigeria': 'NGA',
    'Egypt': 'EGY',
    'Japan': 'JPN',
    'South Korea': 'KOR',
    'Australia': 'AUS',
    'Saudi Arabia': 'KSA',
    'Iran': 'IRN',
    'Qatar': 'QAT',
    'Ecuador': 'ECU',
    'Peru': 'PER',
    'Chile': 'CHI',
    'Paraguay': 'PAR',
    'Bolivia': 'BOL',
    'Venezuela': 'VEN',
    'Panama': 'PAN',
    'Costa Rica': 'CRC',
    'Jamaica': 'JAM',
    'Honduras': 'HON',
    'El Salvador': 'SLV',
    'Guatemala': 'GUA',
    'Trinidad and Tobago': 'TRI',
    'Haiti': 'HAI',
    'Curaçao': 'CUW',
    'Suriname': 'SUR',
    'Dominican Republic': 'DOM',
    'Nicaragua': 'NCA',
    'Guyana': 'GUY',
    'Antigua and Barbuda': 'ATG',
    'Saint Kitts and Nevis': 'SKN',
    'Barbados': 'BRB',
    'Bermuda': 'BER',
    'Cayman Islands': 'CAY',
    'Turks and Caicos Islands': 'TCA',
    'British Virgin Islands': 'VGB',
    'U.S. Virgin Islands': 'VIR',
    'Anguilla': 'AIA',
    'Montserrat': 'MSR',
    'Saint Lucia': 'LCA',
    'Saint Vincent and the Grenadines': 'VIN',
    'Grenada': 'GRN',
    'Dominica': 'DMA',
    'Aruba': 'ARU',
    'Sint Maarten': 'SXM',
    'Bonaire': 'BON',
    'Sint Eustatius': 'EUS',
    'Saba': 'SAB'
  };

  return abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
}
