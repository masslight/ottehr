import { VisitType } from 'config-types/config/booking';
import { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AddPatient from 'src/pages/AddPatient';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { SCHEDULED_FOLLOWUP_REASONS } from 'utils/lib/fhir/encounter';
import { defineStory } from '../../harness/story';

const location = {
  resourceType: 'Location',
  id: 'loc-1',
  status: 'active',
  name: 'Downtown Clinic',
  address: { state: 'NY', city: 'New York' },
  identifier: [{ system: SLUG_SYSTEM, value: 'downtown-clinic' }],
};
const schedule = {
  resourceType: 'Schedule',
  id: 'sched-1',
  active: true,
  actor: [{ reference: 'Location/loc-1' }],
};

/**
 * The form is entered the way "Schedule follow-up" on a visit enters it: with the patient, parent
 * location, visit type and service handed over in router state. The harness route is a plain
 * string, so the state is attached with a redirect before the page mounts.
 */
function AddVisitAsScheduledFollowUp(): ReactElement {
  const { state } = useLocation();
  if (!state) {
    return (
      <Navigate
        to="/visits/add"
        replace
        state={{
          followUpOptions: { parentEncounterId: 'enc-parent-1' },
          parentLocation: { ...location, walkinSchedule: schedule },
          patientId: 'patient-1',
          patientInfo: {
            id: 'patient-1',
            newPatient: false,
            firstName: 'Morgan',
            lastName: 'Lee',
            dateOfBirth: '1990-06-15',
            sex: 'female',
            phoneNumber: '2025550143',
          },
          prefill: { visitType: VisitType.InPersonPreBook, serviceCategoryCode: 'urgent-care' },
        }}
      />
    );
  }
  return <AddPatient />;
}

export default defineStory({
  title: 'Add visit — no time slot selected',
  source: 'apps/ehr/src/pages/AddPatient.tsx',
  base: 'CustomDialog',
  kind: 'info',
  where: 'Visits → Add Visit (pre-booked / scheduled visit type) → submit without picking a time slot',
  route: '/visits/add',
  mocks: [
    {
      url: /\/fhir\/Location\b/,
      response: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{ resource: location }, { resource: schedule }],
      },
    },
  ],
  render: () => <AddVisitAsScheduledFollowUp />,
  play: async ({ user, screen, waitFor }) => {
    const reason = await screen.findByTestId('reason-for-visit-dropdown', {}, { timeout: 10000 });
    await user.click(reason.querySelector('[role="combobox"]') as HTMLElement);
    await user.click(await screen.findByRole('option', { name: SCHEDULED_FOLLOWUP_REASONS[0] }));
    // Let the location picker finish loading so the prefilled location is settled before submitting.
    await new Promise((r) => setTimeout(r, 1500));
    await user.click(screen.getByTestId('add-button'));
    await waitFor(() => screen.getByText('Please select a date and time'), { timeout: 5000 });
  },
  notes:
    'Reached through the scheduled follow-up entry (patient, location, visit type and service prefilled via router state; one mocked Location); a reason is picked and the form submitted with no slot chosen, which is what opens this dialog.',
});
