import { FC } from 'react';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useNavigationQuickPicks();

  return null;
};

export const CommandPaletteInPersonRegistrations: FC = () => {
  useGlobalQuickPicks();

  return null;
};
