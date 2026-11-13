import { defineStory } from '../../harness/story';
import { captureQueryClient, openCommandPalette, renderCommandPalette } from './_commandPalette';
import { userMocks } from './_shared';

export default defineStory({
  title: 'Command palette (search)',
  source: 'apps/ehr/src/components/CommandPalette.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Global — navbar search icon or Cmd/Ctrl+K',
  mocks: userMocks,
  notes:
    'Items come from the real CommandPaletteRegistrations hooks for a mock Administrator outside of a visit, so visit-specific quick picks are absent.',
  setup: captureQueryClient,
  render: renderCommandPalette,
  play: openCommandPalette,
});
