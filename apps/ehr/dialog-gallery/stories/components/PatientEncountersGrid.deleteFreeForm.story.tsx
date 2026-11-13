import { PatientEncountersGrid } from 'src/components/PatientEncountersGrid';
import { defineStory } from '../../harness/story';
import { patientA } from './_shared';

export default defineStory({
  title: 'Delete free-form note',
  source: 'apps/ehr/src/components/PatientEncountersGrid.tsx',
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'Patient record → Visits grid → free-form note row → delete icon',
  route: `/patient/${patientA.id}`,
  routePath: '/patient/:id',
  mocks: [
    {
      url: 'get-patient-visit-history',
      response: {
        status: 200,
        output: {
          visits: [],
          freeFormEncounters: [
            {
              encounterId: 'enc-free-1',
              dateTime: '2026-10-28T15:20:00.000Z',
              note: 'Parent called to ask about refill timing; advised to follow up at next visit.',
              lastUpdated: '2026-10-28T15:21:00.000Z',
            },
          ],
          metadata: { totalCount: 1, sortDirection: 'desc' },
        },
      },
    },
  ],
  render: () => <PatientEncountersGrid patient={patientA} totalCount={1} latestVisitDate="2026-10-28T15:20:00.000Z" />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'delete free form note' }, { timeout: 10000 }));
  },
});
