import { FC } from 'react';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';
import { useRecentQuickPicks } from '../hooks/useRecentQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useNavigationQuickPicks();
  useRecentQuickPicks();

  return null;
};

export const CommandPaletteInPersonRegistrations: FC = () => {
  useGlobalQuickPicks();

  return null;
};
