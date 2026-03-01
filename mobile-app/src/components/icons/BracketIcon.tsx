import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface BracketIconProps {
  size?: number;
  color?: string;
}

export default function BracketIcon({ size = 24, color = '#ffffff' }: BracketIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Round 1 - 4 pairs on left */}
      <Line x1="5" y1="12" x2="22" y2="12" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="5" y1="22" x2="22" y2="22" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="12" x2="22" y2="22" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="17" x2="35" y2="17" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      <Line x1="5" y1="35" x2="22" y2="35" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="5" y1="45" x2="22" y2="45" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="35" x2="22" y2="45" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="40" x2="35" y2="40" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      <Line x1="5" y1="58" x2="22" y2="58" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="5" y1="68" x2="22" y2="68" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="58" x2="22" y2="68" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="63" x2="35" y2="63" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      <Line x1="5" y1="80" x2="22" y2="80" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="5" y1="90" x2="22" y2="90" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="80" x2="22" y2="90" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="22" y1="85" x2="35" y2="85" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      {/* Round 2 - 2 pairs */}
      <Line x1="35" y1="17" x2="35" y2="40" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="35" y1="28" x2="55" y2="28" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      <Line x1="35" y1="63" x2="35" y2="85" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="35" y1="74" x2="55" y2="74" stroke={color} strokeWidth="7" strokeLinecap="round"/>

      {/* Round 3 - final */}
      <Line x1="55" y1="28" x2="55" y2="74" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      <Line x1="55" y1="51" x2="75" y2="51" stroke={color} strokeWidth="7" strokeLinecap="round"/>
    </Svg>
  );
}
