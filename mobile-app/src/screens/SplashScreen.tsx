import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const letterOPosition = useRef(new Animated.Value(-150)).current; // מתחיל מלמעלה
  const letterOOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // אנימציה של הטקסט
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

    // אנימציה של האות O שנופלת
    Animated.parallel([
      Animated.timing(letterOPosition, {
        toValue: 0, // נוחת על המיקום הסופי
        duration: 1400,
        easing: Easing.bounce, // אפקט קפיצה
        useNativeDriver: true,
      }),
      Animated.timing(letterOOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // אחרי שהאנימציה מסתיימת, מחכים עוד קצת ואז קוראים ל-callback
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
    <View style={styles.container}>
      {/* רקע גרדיאנט מדומה עם View */}
      <View style={styles.gradientOverlay1} />
      <View style={styles.gradientOverlay2} />
      
      {/* אלמנטים דקורטיביים */}
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
          <Text style={styles.text}>Predict</Text>
          <Animated.Text
            style={[
              styles.text,
              styles.letterO,
              {
                transform: [{ translateY: letterOTranslateY }],
                opacity: letterOOpacity,
              },
            ]}
          >
            O
          </Animated.Text>
        </View>
        <Text style={styles.tagline}>World Cup 2026 Predictions</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#22c55e', // ירוק בהיר
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#16a34a',
    opacity: 0.6,
  },
  gradientOverlay2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#4ade80',
    opacity: 0.4,
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
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  text: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  letterO: {
    marginHorizontal: 4,
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

