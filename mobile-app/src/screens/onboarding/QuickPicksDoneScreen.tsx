import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = StackNavigationProp<MainStackParamList>;
const BG = '#0f172a';

export default function QuickPicksDoneScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  const goToMatches = React.useCallback(() => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'MatchPredictions' },
      ],
    });
  }, [navigation]);

  const goHome = React.useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={44} color="#16a34a" />
        </View>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={1.2}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {t('onboarding.quickpicks_done_title')}
        </Text>
        <Text
          style={styles.subtitle}
          maxFontSizeMultiplier={1.2}
        >
          {t('onboarding.quickpicks_done_subtitle')}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goToMatches} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.2}>
            {t('onboarding.quickpicks_done_goMatches')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={goHome} activeOpacity={0.85}>
          <Text style={styles.ghostBtnText} maxFontSizeMultiplier={1.2}>
            {t('onboarding.quickpicks_done_goHome')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, direction: 'ltr' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
    paddingVertical: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(22,163,74,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
    backgroundColor: BG,
  },
  primaryBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  ghostBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  ghostBtnText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
});
