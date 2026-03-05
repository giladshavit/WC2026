import * as React from 'react';
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const letterOPosition = useRef(new Animated.Value(-150)).current; // starts from top
  const letterOOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Text animation
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(scale, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Letter O drop animation
    Animated.parallel([
      Animated.timing(letterOPosition, {
        toValue: 0, // lands on final position
        duration: 1400,
        easing: Easing.bounce, // bounce effect
        useNativeDriver: true,
      }),
      Animated.timing(letterOOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After animation ends, wait a bit then call callback
      setTimeout(() => {
        onAnimationComplete();
      }, 1000);
    });
  }, []);

  const letterOTranslateY = letterOPosition.interpolate({
    inputRange: [-150, 0],
    outputRange: [-150, 0],
  });

  return (
    <LinearGradient
      colors={['#166534', '#16a34a', '#22c55e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />

      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: textOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.textContainer}>
          <Text style={styles.text}>PREDICTO</Text>
          <Animated.View
            style={{
              transform: [{ translateY: letterOTranslateY }],
              opacity: letterOOpacity,
            }}
          >
            <Text style={styles.footballEmoji}>⚽</Text>
          </Animated.View>
        </View>
        <Text style={styles.tagline}>World Cup 2026 Predictions</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    right: -50,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: 100,
    left: -30,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    top: 150,
    right: 50,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 60,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  text: {
    fontSize: 52,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 62,
  },
  footballEmoji: {
    fontSize: 46,
    lineHeight: 62,
    marginLeft: -46,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

