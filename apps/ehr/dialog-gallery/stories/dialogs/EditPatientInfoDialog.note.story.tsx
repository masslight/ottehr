import AppointmentNotesHistory from 'src/components/AppointmentNotesHistory';
import { defineStory } from '../../harness/story';
import { appointment } from './_fixtures';

const comment = 'Patient is waiting in the car; call when the room is ready.';

export default defineStory({
  title: 'Update current tracking board note',
  source: 'apps/ehr/src/components/dialogs/EditPatientInfoDialog.tsx',
  base: 'EditPatientInfoDialog',
  kind: 'form',
  where: 'Visit details page → "Current tracking board note" card → pencil icon',
  notes:
    'EditPatientInfoDialog as a real caller uses it (AppointmentNotesHistory passes the title, a multiline Note field and the "Update note" label). The note is mock data.',
  render: () => (
    <AppointmentNotesHistory
      appointment={{ ...appointment, comment }}
      curNoteAndHistory={[{ note: comment, noteAddedByAndWhen: '11/13/2026 10:20 AM EST By Marcus Chen' }]}
      timezone="America/New_York"
      user={undefined}
      oystehr={undefined}
      getAndSetHistoricResources={async () => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    const buttons = await screen.findAllByRole('button');
    await user.click(buttons[0]);
    await screen.findByRole('dialog');
  },
});
