import ReportBuilderPage from 'src/features/report-builder/page/ReportBuilderPage';
import { ADHOC_RUNTIME_VERSION, SavedAdHocReport } from 'utils/lib/types/adhoc/saved/saved.types';
import { defineStory } from '../../harness/story';
import { userMocks } from './shared-mocks';

const savedReport: SavedAdHocReport = {
  id: 'rep-1',
  name: 'New patients by city',
  description: 'Count of patients seen in the last 30 days, grouped by home city.',
  datasetId: 'patients',
  criteria: { dateRange: 'last-30-days', options: {} },
  request: 'Show how many patients we saw per city',
  code: 'return <Section title="Patients by city"><Note>Mock report</Note></Section>;',
  title: 'Patients by city',
  runtimeVersion: ADHOC_RUNTIME_VERSION,
};

const patientRow = {
  patientId: 'patient-1',
  firstName: 'Jordan',
  lastName: 'Alvarez',
  patientName: 'Jordan Alvarez',
  dateOfBirth: '2015-04-12',
  age: 11,
  sex: 'Male',
  city: 'Springfield',
  state: 'NY',
  zip: '12345',
  phone: '+12025550143',
  email: 'jordan.family@example.com',
  source: 'Google',
  active: true,
  mergedIntoPatientId: null,
  totalVisits: 2,
  firstVisitDate: '2026-10-20T15:00:00.000Z',
  lastVisitDate: '2026-11-10T15:00:00.000Z',
  lastVisitStatus: 'completed',
  visitTypes: ['In-Person'],
};

export default defineStory({
  title: 'Save ad-hoc report',
  source: 'apps/ehr/src/features/report-builder/page/ReportBuilderPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Reports → Ad-Hoc Report → generated report header → "Save" / "Save report" (Administrator only)',
  notes:
    'Captured for a report opened from Saved reports (?saved=…), so the dialog shows "Save as new" + "Update". For a freshly generated, never-saved report the same dialog has an empty-or-suggested name and a single "Save" button — that variant needs the AI generation flow and was not captured. Saved report, dataset rows and user role are mocked; the sandboxed report frame behind the dialog does not render in the harness.',
  route: '/reports/ad-hoc?saved=rep-1',
  mocks: [
    ...userMocks,
    { url: 'list-adhoc-reports', response: { status: 200, output: { reports: [savedReport] } } },
    {
      url: /\/adhoc-report\/execute/,
      response: ({ body }: { body: any }) => ({
        status: 200,
        output: body?.taskId
          ? { status: 'completed', downloadUrl: 'https://mock.invalid/z3/adhoc/patients.json' }
          : { taskId: 'adhoc-task-1' },
      }),
    },
    { url: 'adhoc/patients.json', response: { patients: [patientRow] } },
  ],
  render: () => <ReportBuilderPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Save' }, { timeout: 20000 }));
    await screen.findByText('Save report');
  },
});
