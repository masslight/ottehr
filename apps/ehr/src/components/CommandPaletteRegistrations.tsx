import { FC } from 'react';
import { useActionQuickPicks } from '../hooks/useActionQuickPicks';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';
import { usePhraseQuickPicks } from '../hooks/usePhraseQuickPicks';
import { useRecentQuickPicks } from '../hooks/useRecentQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useNavigationQuickPicks();
  useActionQuickPicks();
  useRecentQuickPicks();
  usePhraseQuickPicks();

  return null;
};

export const CommandPaletteInPersonRegistrations: FC = () => {
  useGlobalQuickPicks();

  return null;
};
