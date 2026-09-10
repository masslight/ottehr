import { FC } from 'react';
import { useActionQuickPicks } from '../hooks/useActionQuickPicks';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useNavigationQuickPicks();
  useActionQuickPicks();

  return null;
};

export const CommandPaletteInPersonRegistrations: FC = () => {
  useGlobalQuickPicks();

  return null;
};
