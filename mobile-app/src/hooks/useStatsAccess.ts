import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { STATS_CONFIG } from '../config/statsConfig';

const FREE_VIEWS_KEY = 'stats_free_views_used';
const UNLOCKED_UNTIL_KEY = 'stats_unlocked_until';

let _freeViewsUsed = 0;
let _unlockedUntil = 0;
let _adsEnabled = false;
let _loaded = false;
const _listeners = new Set<() => void>();

const notifyAll = () => _listeners.forEach((fn) => fn());

export const useStatsAccess = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (_loaded) return;
    _loaded = true;

    const load = async () => {
      try {
        const config = await apiService.getAppConfig();
        _adsEnabled = !!(config as { stats_ads_enabled?: boolean }).stats_ads_enabled;
      } catch (err) {
        console.error('Failed to fetch stats ads config:', err);
        _adsEnabled = false;
      }

      const [viewsRaw, untilRaw] = await Promise.all([
        AsyncStorage.getItem(FREE_VIEWS_KEY),
        AsyncStorage.getItem(UNLOCKED_UNTIL_KEY),
      ]);
      const parsed = viewsRaw ? parseInt(viewsRaw, 10) : 0;
      _freeViewsUsed = isNaN(parsed) ? 0 : parsed;
      _unlockedUntil = untilRaw ? parseInt(untilRaw, 10) : 0;
      notifyAll();
    };
    load();
  }, []);

  useEffect(() => {
    if (_unlockedUntil <= Date.now()) return;
    const interval = setInterval(() => notifyAll(), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const isUnlocked = Date.now() < _unlockedUntil;

  const canViewStats = useCallback((): boolean => {
    if (!_adsEnabled) return true;
    if (_freeViewsUsed < STATS_CONFIG.FREE_VIEWS) return true;
    if (Date.now() < _unlockedUntil) return true;
    return false;
  }, []);

  const consumeFreeView = useCallback(() => {
    if (!_adsEnabled || _freeViewsUsed >= STATS_CONFIG.FREE_VIEWS) return;
    _freeViewsUsed += 1;
    AsyncStorage.setItem(FREE_VIEWS_KEY, String(_freeViewsUsed)).catch(console.error);
    notifyAll();
  }, []);

  const onAdCompleted = useCallback(() => {
    _unlockedUntil = Date.now() + STATS_CONFIG.UNLOCK_DURATION_MS;
    AsyncStorage.setItem(UNLOCKED_UNTIL_KEY, String(_unlockedUntil)).catch(console.error);
    notifyAll();
  }, []);

  return {
    adsEnabled: _adsEnabled,
    freeViewsUsed: _freeViewsUsed,
    canViewStats,
    consumeFreeView,
    onAdCompleted,
    isUnlocked,
  };
};
