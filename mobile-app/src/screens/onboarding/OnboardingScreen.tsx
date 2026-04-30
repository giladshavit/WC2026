import React from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { IS_RTL } from '../../utils/rtl';
import WelcomePage from './WelcomePage';
import MatchesPage from './MatchesPage';
import BonusPage from './BonusPage';
import { ClassicLeaguePage, MultiLeaguePage } from './LeaguePage';
import GroupsPage from './GroupsPage';
import ThirdPlacePage from './ThirdPlacePage';
import KnockoutPage from './KnockoutPage';

const BG = '#0f172a';
const SCREEN_WIDTH = Dimensions.get('window').width;

type OnboardingScreenProps = {
  onDone?: () => void;
};

type OnboardingSlide = {
  key: string;
  render: (isActive: boolean) => React.ReactNode;
};

export default function OnboardingScreen({ onDone: onDoneProp }: OnboardingScreenProps) {
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Onboarding'>>();
  const mode = route.params?.mode ?? 'replay';
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const layoutDirection = IS_RTL ? 'rtl' : 'ltr';
  const [page, setPage] = React.useState(0);
  const listRef = React.useRef<FlatList>(null);

  const onDone = React.useCallback(() => {
    if (onDoneProp) {
      onDoneProp();
    } else if (mode === 'first-session') {
      navigation.replace('QuickPicks');
    } else {
      navigation.goBack();
    }
  }, [navigation, onDoneProp, mode]);

  const pages = React.useMemo<OnboardingSlide[]>(
    () => [
      { key: 'welcome', render: (_isActive: boolean) => <WelcomePage /> },
      { key: 'classic', render: (_isActive: boolean) => <MatchesPage /> },
      { key: 'bonus', render: (active: boolean) => <BonusPage isActive={active} /> },
      { key: 'league-classic', render: (active: boolean) => <ClassicLeaguePage isActive={active} /> },
      { key: 'groups', render: (active: boolean) => <GroupsPage isActive={active} /> },
      { key: 'thirdplace', render: (active: boolean) => <ThirdPlacePage isActive={active} /> },
      { key: 'knockout', render: (active: boolean) => <KnockoutPage isActive={active} /> },
      { key: 'league-multi', render: (active: boolean) => <MultiLeaguePage isActive={active} /> },
    ],
    []
  );

  const displayPages = pages; // no reversal needed — I18nManager handles horizontal mirroring

  const onMomentumScrollEnd = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const rawIndex = Math.round(x / SCREEN_WIDTH);
      // RTL: horizontal FlatList still reports offset along the LTR axis; map to logical slide index.
      const logicalIndex = IS_RTL ? pages.length - 1 - rawIndex : rawIndex;
      setPage(Math.min(Math.max(logicalIndex, 0), pages.length - 1));
    },
    [pages.length]
  );

  const goNext = React.useCallback(() => {
    if (page < pages.length - 1) {
      const nextPage = page + 1;
      const displayIndex = nextPage; // I18nManager mirrors scroll; no RTL index flip
      listRef.current?.scrollToIndex({ index: displayIndex, animated: true });
      setPage(nextPage);
    } else {
      onDone();
    }
  }, [page, pages.length, onDone]);

  return (
    <View style={[styles.root, { direction: layoutDirection }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <TouchableOpacity
        style={[styles.skipButton, { top: insets.top + 8 }]}
        onPress={onDone}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <View style={[styles.mainColumn, { paddingTop: insets.top + 40, direction: layoutDirection }]}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={displayPages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <View style={[styles.page, { width: SCREEN_WIDTH }]}>
              {item.render(index === page)}
            </View>
          )}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 100);
          }}
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.dots}>
            {pages.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>
              {page < pages.length - 1 ? t('onboarding.next') : t('onboarding.getStarted')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  mainColumn: {
    flex: 1,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  dotActive: {
    backgroundColor: '#38bdf8',
    width: 22,
  },
  nextBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
