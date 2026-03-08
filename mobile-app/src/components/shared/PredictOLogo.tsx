import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface PredictOLogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark';
}

export default function PredictOLogo({
  size = 'medium',
  variant = 'light',
}: PredictOLogoProps) {
  const fontSize = { small: 24, medium: 34, large: 52 }[size];
  const color = variant === 'light' ? '#ffffff' : '#16a34a';
  const fontWeight = size === 'small' ? '600' : '800';
  const opacity = size === 'small' ? 0.85 : 1;

  return (
    <Text style={[styles.text, { fontSize, color, fontWeight, opacity }]}>
      PREDICTO
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    letterSpacing: 3,
  },
});
