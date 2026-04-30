import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const KEY = 'pending_invite_code';

/** Parse predicto:// or https://getpredicto.com join URLs */
export function extractJoinInviteCodeFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const pathFirst = (parsed.path ?? '')
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)[0]?.toLowerCase();
    if (pathFirst !== 'join') return null;

    const host = (parsed.hostname ?? '').toLowerCase();
    const scheme = (parsed.scheme ?? '').toLowerCase();
    if (scheme === 'https' && host && host !== 'getpredicto.com' && host !== 'www.getpredicto.com') {
      return null;
    }

    const raw = parsed.queryParams?.code;
    const str =
      typeof raw === 'string' ? raw : Array.isArray(raw) && raw[0] != null ? String(raw[0]) : '';
    if (!str) return null;
    return str.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  } catch {
    return null;
  }
}

export const usePendingInviteCode = () => {
  const saveInviteCode = useCallback(async (code: string) => {
    await AsyncStorage.setItem(KEY, code.toUpperCase());
  }, []);
  const getPendingInviteCode = useCallback(async (): Promise<string | null> => {
    return await AsyncStorage.getItem(KEY);
  }, []);
  const clearInviteCode = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
  }, []);
  return { saveInviteCode, getPendingInviteCode, clearInviteCode };
};
