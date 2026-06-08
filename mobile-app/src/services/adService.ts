import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const USE_TEST_ADS = __DEV__;

const PROD_AD_UNIT_ID = Platform.OS === 'ios'
  ? 'ca-app-pub-6248733928314999/9641735657'
  : 'ca-app-pub-6248733928314999/4825512922';

const AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.REWARDED
  : PROD_AD_UNIT_ID;

export const showRewardedAd = (onRewarded: () => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    let rewardEarned = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const clearAdTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    const unsubscribeLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        clearAdTimeout();
        ad.show();
      }
    );

    const unsubscribeEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardEarned = true;
        onRewarded();
      }
    );

    const unsubscribeClosed = ad.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        clearAdTimeout();
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
        if (rewardEarned) {
          resolve();
        } else {
          reject(new Error('USER_CANCELED'));
        }
      }
    );

    const unsubscribeError = ad.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        clearAdTimeout();
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
        reject(error);
      }
    );

    ad.load();

    timeoutId = setTimeout(() => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      reject(new Error('Ad load timeout'));
    }, 15000);
  });
};
