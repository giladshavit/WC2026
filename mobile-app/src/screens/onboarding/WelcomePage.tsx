import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function WelcomePage() {
  const { t } = useTranslation();
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.root, styles.pageInner, { opacity: fade }]}>
      <Text style={styles.trophy} allowFontScaling={false}>
        🏆
      </Text>
      <Text style={styles.welcomeTitle}>{t('onboarding.welcome_title')}</Text>
      <Text style={styles.welcomeGrayLine}>{t('onboarding.welcome_subtitle')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    direction: 'ltr',
  },
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
