import { FC } from 'react';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useGlobalQuickPicks();
  useNavigationQuickPicks();

  return null;
};
