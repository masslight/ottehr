// Shared setup for the command-palette stories (not a story itself).
// Mirrors how App.tsx mounts the palette: registrations + palette + phrase dialog, opened by the
// real navbar search button.
import type { QueryClient } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { CommandPalette } from 'src/components/CommandPalette';
import { CommandPalettePhraseDialog } from 'src/components/CommandPalettePhraseDialog';
import { CommandPaletteRegistrations } from 'src/components/CommandPaletteRegistrations';
import { CommandPaletteSearchButton } from 'src/components/CommandPaletteSearchButton';
import type { PlayContext } from '../../harness/story';

let storyQueryClient: QueryClient | undefined;
export const captureQueryClient = ({ queryClient }: { queryClient: QueryClient }): void => {
  storyQueryClient = queryClient;
};

export const renderCommandPalette = (): ReactElement => (
  <>
    <CommandPaletteSearchButton />
    <CommandPaletteRegistrations />
    <CommandPalette />
    <CommandPalettePhraseDialog />
  </>
);

/** Opens the palette once the signed-in user's phrases have been registered. */
export const openCommandPalette = async ({ user, screen }: PlayContext): Promise<void> => {
  // useEvolveUser's profile query runs once, as soon as the FHIR client exists. In this isolated mount
  // that is before /user/me has answered, so it resolves to "no profile"; re-run it the same way the
  // app does after a phrase mutation (refetch of 'get-practitioner-profile').
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await storyQueryClient?.refetchQueries({ queryKey: ['get-practitioner-profile'] });
  await user.click(screen.getByRole('button', { name: 'Open search bar' }));
  await screen.findByText('normal-exam', { exact: false }, { timeout: 15000 });
};
