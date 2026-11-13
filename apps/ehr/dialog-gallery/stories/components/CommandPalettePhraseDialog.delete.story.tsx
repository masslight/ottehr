import { defineStory } from '../../harness/story';
import { captureQueryClient, openCommandPalette, renderCommandPalette } from './_commandPalette';
import { userMocks } from './_shared';

export default defineStory({
  title: 'Delete phrase?',
  source: 'apps/ehr/src/components/CommandPalettePhraseDialog.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'Command palette → phrase row → delete icon',
  mocks: userMocks,
  notes:
    'Phrases come from a mock Practitioner profile; the profile query is re-run once from the story because, mounted in isolation, it first runs before the mock user has loaded.',
  setup: captureQueryClient,
  render: renderCommandPalette,
  play: async (ctx) => {
    await openCommandPalette(ctx);
    const { user, screen } = ctx;
    await user.click(screen.getAllByRole('button', { name: 'Delete phrase' })[0]);
  },
});
