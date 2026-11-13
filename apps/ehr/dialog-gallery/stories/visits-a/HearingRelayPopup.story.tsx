import HearingRelayPopup from 'src/features/visits/shared/components/HearingRelayPopup';
import { defineStory } from '../../harness/story';
import { appointmentMock, visitRoute } from './_fixtures';

export default defineStory({
  title: 'Patient requires a Hearing Impaired Relay Service (711)',
  source: 'apps/ehr/src/features/visits/shared/components/HearingRelayPopup.tsx',
  base: 'MUI Dialog',
  kind: 'info',
  where: 'Visit header / telemed appointment → relay-service indicator next to the patient',
  ...visitRoute,
  mocks: [appointmentMock()],
  render: () => <HearingRelayPopup isOpen onClose={() => undefined} />,
  play: async ({ screen, waitFor }) => {
    // The phone number comes from the paperwork loaded with the appointment.
    await waitFor(() => screen.getByText(/\(212\) 555-0147/), { timeout: 10000 });
  },
  notes: 'Patient phone number comes from a mocked intake QuestionnaireResponse.',
});
