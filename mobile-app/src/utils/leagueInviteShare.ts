import type { TFunction } from 'i18next';

export const DEEP_LINK_BASE = 'https://getpredicto.com/join';

export const buildShareMessage = (leagueName: string, code: string, t: TFunction): string => {
  const url = `${DEEP_LINK_BASE}?code=${code}`;
  return t('leagues.shareMessage', { name: leagueName, code, url });
};
