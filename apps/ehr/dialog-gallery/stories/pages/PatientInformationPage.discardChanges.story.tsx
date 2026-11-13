import PatientInformationPage from 'src/pages/PatientInformationPage';
import { defineStory } from '../../harness/story';
import { adminUserMock, zambdaOutput } from './_mocks';
import { mockPatient } from './_patient';

export default defineStory({
  title: 'Patient profile — discard unsaved changes',
  source: 'apps/ehr/src/pages/PatientInformationPage.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'Patient → Patient Profile → edit any field → Back / close (X) without saving',
  route: '/patient/patient-1/info',
  routePath: '/patient/:id/info',
  mocks: [
    adminUserMock,
    {
      url: 'get-patient-account',
      response: zambdaOutput({
        patient: mockPatient,
        coverages: {},
        insuranceOrgs: [],
        coverageChecks: [],
      }),
    },
    {
      url: /\/fhir\/Patient\b/,
      response: { resourceType: 'Bundle', type: 'searchset', total: 1, entry: [{ resource: mockPatient }] },
    },
  ],
  render: () => <PatientInformationPage />,
  play: async ({ user, screen }) => {
    const close = await screen.findByTestId('header-patient-close-button', {}, { timeout: 15000 });
    // Make the form dirty — the dialog only appears when there is something to lose.
    const firstName = document.querySelector<HTMLInputElement>('input[name="patient-first-name"]');
    if (!firstName) throw new Error('first name field not found');
    await user.type(firstName, 'n');
    await user.click(close);
    await screen.findByText('Discard Changes?');
  },
  notes:
    'Patient account mocked (one patient, no coverages). One character is typed into the first-name field to make the form dirty, then the header close button is clicked.',
});
