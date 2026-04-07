import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function WelcomePage() {
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.pageInner, { opacity: fade }]}>
      <Text style={styles.trophy} allowFontScaling={false}>
        🏆
      </Text>
      <Text style={styles.welcomeTitle}>Welcome to Predicto</Text>
      <Text style={styles.welcomeGrayLine}>Your ultimate football prediction game</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pageInner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophy: {
    fontSize: 72,
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 14,
  },
  welcomeGrayLine: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
