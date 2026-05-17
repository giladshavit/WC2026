import { I18nManager } from 'react-native';

/** Mirrors the native layout engine; matches `forceRTL` only after it has taken effect (may require restart). */
export const IS_RTL: boolean = I18nManager.isRTL;
