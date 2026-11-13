import { DischargeDialog } from 'src/features/visits/shared/components/review-tab/DischargeDialog';
import { defineStory } from '../../harness/story';
import { APPOINTMENT_ID, baseVisitNote, ENCOUNTER_ID, PATIENT_ID, visitMocks, visitRoute } from './_visit';

const plan = {
  ...baseVisitNote().plan,
  schoolWorkNotes: [
    {
      id: 'note-school',
      published: true,
      name: 'School excuse',
      type: 'school',
      url: 'https://mock.invalid/z3/school-note.pdf',
    },
    {
      id: 'note-work',
      published: true,
      name: 'Work excuse',
      type: 'work',
      url: 'https://mock.invalid/z3/work-note.pdf',
    },
  ],
};

export default defineStory({
  title: 'Discharge patient (print + sign options)',
  source: 'apps/ehr/src/features/visits/shared/components/review-tab/DischargeDialog.tsx',
  base: 'CustomDialog',
  kind: 'form',
  where: 'In-person visit → "Discharge" button in the visit header / Review & Sign',
  ...visitRoute,
  mocks: visitMocks({
    note: { plan },
    extra: [{ url: '/z3/', response: { signedUrl: 'https://mock.invalid/signed/excuse.pdf' } }],
  }),
  notes:
    'Mock visit with a school note, a work note and patient instructions so every checkbox is enabled; chart is complete, so "Sign the Progress Note" is available.',
  render: () => (
    <DischargeDialog
      onClose={() => undefined}
      encounterId={ENCOUNTER_ID}
      appointmentId={APPOINTMENT_ID}
      patientId={PATIENT_ID}
    />
  ),
  play: async ({ screen, waitFor }) => {
    // Wait for the visit note + presigned excuse URLs so no checkbox is in its "Preparing…" state.
    await waitFor(
      () => {
        const signBox = screen.getByRole('checkbox', { name: /Sign the Progress Note/ }) as HTMLInputElement;
        const workBox = screen.getByRole('checkbox', { name: /^Work Note$/ }) as HTMLInputElement;
        if (signBox.disabled || workBox.disabled || !workBox.checked) throw new Error('visit data not loaded yet');
        if (screen.queryByText(/Preparing/)) throw new Error('still presigning');
      },
      { timeout: 10000 }
    );
  },
});
