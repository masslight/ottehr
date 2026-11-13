import ProcedureCodes from 'src/features/visits/telemed/components/admin/charge-items/ProcedureCodes';
import { defineStory } from '../../harness/story';
import { feeSchedule, zambda } from './_mocks';

export default defineStory({
  title: 'Add procedure code',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/ProcedureCodes.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Billing → Fee Schedules / Charge Masters → an entry → Procedure Codes tab → Add procedure code',
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
    await user.click(await screen.findByRole('button', { name: 'Add procedure code' }));
    await screen.findByRole('dialog');
  },
});
