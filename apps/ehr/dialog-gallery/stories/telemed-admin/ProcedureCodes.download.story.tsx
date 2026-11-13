import ProcedureCodes from 'src/features/visits/telemed/components/admin/charge-items/ProcedureCodes';
import { defineStory } from '../../harness/story';
import { feeSchedule, zambda } from './_mocks';

export default defineStory({
  title: 'Download procedure codes CSV',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/ProcedureCodes.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Admin → Billing → Fee Schedules / Charge Masters → an entry → Procedure Codes tab → Download CSV',
  notes:
    'Version history is mocked with two prior versions, so the "delta" option is enabled; default "latest" option is selected.',
  mocks: [
    zambda('get-version-history', {
      versions: [
        { versionId: 'v3', timestamp: '2026-03-02T15:04:00.000Z' },
        { versionId: 'v2', timestamp: '2026-02-01T14:30:00.000Z' },
        { versionId: 'v1', timestamp: '2026-01-01T09:00:00.000Z' },
      ],
    }),
  ],
  render: () => <ProcedureCodes feeSchedule={feeSchedule} isFetching={false} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));
    await screen.findByLabelText('Delta since a previous version');
  },
});
