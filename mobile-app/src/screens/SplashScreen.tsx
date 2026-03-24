import * as React from 'react';
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TROPHY_IMAGE = require('../../assets/trophy.png');
const FOOTBALL_IMAGE = require('../../assets/football_2026.png');

function RadialGlowLayer() {
  const layers = [
    { size: 260, opacity: 0.001 },
    { size: 255, opacity: 0.001 },
    { size: 250, opacity: 0.001 },
    { size: 245, opacity: 0.002 },
    { size: 240, opacity: 0.002 },
    { size: 235, opacity: 0.003 },
    { size: 230, opacity: 0.003 },
    { size: 225, opacity: 0.004 },
    { size: 220, opacity: 0.004 },
    { size: 215, opacity: 0.005 },
    { size: 210, opacity: 0.005 },
    { size: 205, opacity: 0.005 },
    { size: 200, opacity: 0.006 },
    { size: 195, opacity: 0.006 },
    { size: 190, opacity: 0.006 },
    { size: 185, opacity: 0.007 },
    { size: 180, opacity: 0.007 },
    { size: 175, opacity: 0.007 },
    { size: 170, opacity: 0.008 },
    { size: 165, opacity: 0.008 },
    { size: 160, opacity: 0.008 },
    { size: 155, opacity: 0.008 },
    { size: 150, opacity: 0.009 },
    { size: 145, opacity: 0.009 },
    { size: 140, opacity: 0.009 },
    { size: 135, opacity: 0.009 },
    { size: 130, opacity: 0.009 },
    { size: 125, opacity: 0.010 },
    { size: 120, opacity: 0.010 },
    { size: 115, opacity: 0.010 },
    { size: 110, opacity: 0.010 },
    { size: 105, opacity: 0.010 },
    { size: 100, opacity: 0.010 },
    { size: 96, opacity: 0.010 },
    { size: 92, opacity: 0.010 },
  ];

  return (
    <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
      {layers.map((layer, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: layer.size,
            height: layer.size,
            borderRadius: layer.size / 2,
            backgroundColor: `rgba(212, 175, 55, ${layer.opacity})`,
          }}
        />
      ))}
    </View>
  );
}

function StarField() {
  const stars = [
    { top: '4%', left: '8%', size: 2.0, opacity: 0.55 },
    { top: '7%', left: '55%', size: 1.2, opacity: 0.35 },
    { top: '5%', left: '82%', size: 4.5, opacity: 0.65 },
    { top: '11%', left: '30%', size: 1.0, opacity: 0.3 },
    { top: '13%', left: '70%', size: 1.8, opacity: 0.45 },
    { top: '18%', left: '15%', size: 3.5, opacity: 0.55 },
    { top: '20%', left: '90%', size: 1.2, opacity: 0.3 },
    { top: '25%', left: '48%', size: 1.0, opacity: 0.25 },
    { top: '28%', left: '5%', size: 2.2, opacity: 0.45 },
    { top: '32%', left: '78%', size: 4.0, opacity: 0.6 },
    { top: '36%', left: '22%', size: 1.5, opacity: 0.3 },
    { top: '39%', left: '65%', size: 1.0, opacity: 0.25 },
    { top: '42%', left: '92%', size: 2.5, opacity: 0.4 },
    { top: '58%', left: '3%', size: 1.8, opacity: 0.35 },
    { top: '60%', left: '72%', size: 1.0, opacity: 0.25 },
    { top: '62%', left: '88%', size: 3.5, opacity: 0.55 },
    { top: '65%', left: '10%', size: 1.2, opacity: 0.3 },
    { top: '70%', left: '60%', size: 1.8, opacity: 0.35 },
    { top: '73%', left: '25%', size: 1.0, opacity: 0.25 },
    { top: '75%', left: '45%', size: 4.5, opacity: 0.6 },
    { top: '78%', left: '75%', size: 2.5, opacity: 0.5 },
    { top: '80%', left: '42%', size: 1.2, opacity: 0.3 },
    { top: '83%', left: '18%', size: 3.0, opacity: 0.5 },
    { top: '85%', left: '5%', size: 1.8, opacity: 0.4 },
    { top: '87%', left: '88%', size: 1.0, opacity: 0.25 },
    { top: '89%', left: '55%', size: 2.0, opacity: 0.4 },
    { top: '91%', left: '32%', size: 4.0, opacity: 0.6 },
    { top: '93%', left: '78%', size: 1.5, opacity: 0.35 },
    { top: '94%', left: '65%', size: 1.5, opacity: 0.35 },
    { top: '96%', left: '18%', size: 1.2, opacity: 0.3 },
    { top: '97%', left: '42%', size: 2.5, opacity: 0.45 },
    { top: '98%', left: '85%', size: 3.5, opacity: 0.5 },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {stars.map((star, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: star.top as any,
            left: star.left as any,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#ffffff',
            opacity: star.opacity,
          }}
        />
      ))}
    </View>
  );
}

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
      colors={['#0d1f3c', '#0f2744', '#060d1a']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StarField />
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />

      <View style={styles.contentContainer}>
        {/* Trophy with glow and pop-in animation */}
        <View style={styles.trophyWrapper}>
          <RadialGlowLayer />
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
                marginLeft: Platform.OS === 'android' ? -46 : -50,
                marginTop: Platform.OS === 'ios' ? 0 : 0,
              }}
            >
              <Image
                source={FOOTBALL_IMAGE}
                style={styles.footballImage}
                resizeMode="contain"
              />
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    top: -40,
    right: -40,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
    bottom: 100,
    left: -25,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
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
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trophyImageWrapper: {
    width: 150,
    height: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  trophyImage: {
    width: 150,
    height: 150,
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
  footballImage: {
    width: 57,
    height: 57,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(148, 163, 184, 0.9)',
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
