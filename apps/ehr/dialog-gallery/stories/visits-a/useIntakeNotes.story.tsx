import { ReactElement } from 'react';
import { useIntakeNotesModal } from 'src/features/visits/in-person/hooks/useIntakeNotes';
import { defineStory } from '../../harness/story';
import { notesMock, visitMocks, visitRoute } from './_fixtures';

// The dialog component is only reachable through this hook.
function Host(): ReactElement {
  const { IntakeNotesModal } = useIntakeNotesModal();
  return <IntakeNotesModal open onClose={() => undefined} />;
}

export default defineStory({
  title: 'Intake notes',
  source: 'apps/ehr/src/features/visits/in-person/hooks/useIntakeNotes.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person visit header → "Intake notes" button',
  ...visitRoute,
  mocks: [...visitMocks(), notesMock('intake')],
  render: () => <Host />,
  play: async ({ screen, waitFor }) => {
    await waitFor(() => screen.getByText(/sore throat/), { timeout: 10000 });
  },
  notes: 'Notes list is the real GenericNoteList fed by a mocked get-chart-section response (two notes).',
});
