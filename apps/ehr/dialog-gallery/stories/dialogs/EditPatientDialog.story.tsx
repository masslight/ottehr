import { Button } from '@mui/material';
import { ReactElement, useState } from 'react';
import EditPatientDialog from 'src/components/dialogs/EditPatientDialog';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { defineStory } from '../../harness/story';
import { appointment, encounter, patient } from './_fixtures';

// Stand-in for the patient information card: the dialog is mounted closed and opened by a button
// once the chart's patient has loaded, as in the app.
function Host(): ReactElement {
  const [open, setOpen] = useState(false);
  const { patient: loadedPatient } = useAppointmentData();
  return (
    <>
      {loadedPatient && <Button onClick={() => setOpen(true)}>edit patient</Button>}
      <EditPatientDialog modalOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default defineStory({
  title: 'Edit patient information',
  source: 'apps/ehr/src/components/dialogs/EditPatientDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person / telemed chart → patient information card → edit (pencil)',
  // The dialog reads the patient from the appointment query, keyed by :id in the URL.
  route: '/in-person/appt-1/progress-note',
  routePath: '/in-person/:id/*',
  mocks: [
    {
      url: /\/fhir\/.*Appointment/,
      response: {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [appointment, patient, encounter].map((resource) => ({
          fullUrl: `https://mock.invalid/fhir/${resource.resourceType}/${resource.id}`,
          resource,
        })),
      },
    },
  ],
  notes:
    'Patient comes from a mocked FHIR appointment search; opened via a stand-in button after the patient loads (the real trigger lives in the patient info card). Dialog has a fixed 800px height and scrolls internally; the capture shows the top of the form.',
  render: () => <Host />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'edit patient' }, { timeout: 8000 }));
    await screen.findByDisplayValue('Rivera');
  },
});
