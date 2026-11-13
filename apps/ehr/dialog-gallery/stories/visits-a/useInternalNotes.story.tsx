import { ReactElement } from 'react';
import { useInternalNotesModal } from 'src/features/visits/in-person/hooks/useInternalNotes';
import { defineStory } from '../../harness/story';
import { notesMock, visitMocks, visitRoute } from './_fixtures';

// The dialog component is only reachable through this hook.
function Host(): ReactElement {
  const { InternalNotesModal } = useInternalNotesModal();
  return <InternalNotesModal open onClose={() => undefined} />;
}

export default defineStory({
  title: 'Internal notes',
  source: 'apps/ehr/src/features/visits/in-person/hooks/useInternalNotes.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person visit header → "Internal notes" button',
  ...visitRoute,
  mocks: [...visitMocks(), notesMock('internal')],
  render: () => <Host />,
  play: async ({ screen, waitFor }) => {
    await waitFor(() => screen.getByText(/sore throat/), { timeout: 10000 });
  },
  notes: 'Notes list is the real GenericNoteList fed by a mocked get-chart-section response (two notes).',
});
