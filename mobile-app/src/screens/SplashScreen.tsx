import * as React from 'react';
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TROPHY_IMAGE = require('../../assets/trophy.png');

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const letterOPosition = useRef(new Animated.Value(-500)).current; // starts from top of screen
  const letterOOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.85)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // 1. t=0: Trophy pops in (scale 0.6→1, opacity 0→1, 700ms)
    Animated.parallel([
      Animated.timing(trophyOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(trophyScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. t=300ms: Title + tagline fade in (opacity 0→1, scale 0.85→1, 600ms)
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textScale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. t=0: Football O drop (translateY -150→0, 1400ms, Easing.bounce)
    Animated.parallel([
      Animated.timing(letterOPosition, {
        toValue: 0,
        duration: 2000,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
      Animated.timing(letterOOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After all animations complete: wait 1000ms then call onAnimationComplete
      setTimeout(() => {
        onAnimationComplete();
      }, 1000);
    });
  }, []);

  const letterOTranslateY = letterOPosition.interpolate({
    inputRange: [-500, 0],
    outputRange: [-500, 0],
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

      <View style={styles.contentContainer}>
        {/* Trophy with glow and pop-in animation */}
        <View style={styles.trophyWrapper}>
          <View style={styles.trophyGlow} />
          <Animated.View
            style={[
              styles.trophyImageWrapper,
              {
                opacity: trophyOpacity,
                transform: [{ scale: trophyScale }],
              },
            ]}
          >
            <Image
              source={TROPHY_IMAGE}
              style={[styles.trophyImage, { opacity: 0.82 }]}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Title + football emoji + tagline */}
        <Animated.View
          style={[
            styles.titleTaglineWrapper,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }],
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
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
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
    gap: 16,
    overflow: 'visible',
  },
  trophyWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trophyGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  trophyImageWrapper: {
    width: 120,
    height: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  trophyImage: {
    width: 120,
    height: 120,
  },
  titleTaglineWrapper: {
    alignItems: 'center',
    overflow: 'visible',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
