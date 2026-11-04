import { FC } from 'react';
import { useActionQuickPicks } from '../hooks/useActionQuickPicks';
import { useAssignToMeQuickPick } from '../hooks/useAssignToMeQuickPick';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';
import { usePhraseQuickPicks } from '../hooks/usePhraseQuickPicks';
import { useRecentQuickPicks } from '../hooks/useRecentQuickPicks';

export const CommandPaletteRegistrations: FC = () => {
  useNavigationQuickPicks();
  useActionQuickPicks();
  useAssignToMeQuickPick();
  usePhraseQuickPicks();
  useRecentQuickPicks();

  return null;
};

export const CommandPaletteInPersonRegistrations: FC = () => {
  useGlobalQuickPicks();

  return null;
};
