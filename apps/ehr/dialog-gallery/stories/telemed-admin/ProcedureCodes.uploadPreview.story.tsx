import ProcedureCodes from 'src/features/visits/telemed/components/admin/charge-items/ProcedureCodes';
import { defineStory } from '../../harness/story';
import { feeSchedule, zambda } from './_mocks';

export default defineStory({
  title: 'Procedure codes CSV upload preview',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/ProcedureCodes.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where:
    'Admin → Billing → Fee Schedules / Charge Masters → an entry → Procedure Codes tab → Upload CSV → choose a file',
  notes:
    'Opened by feeding a small CSV (1 changed, 1 added, 1 unchanged row vs. the 5 mocked codes) to the real hidden file input.',
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
    await screen.findByRole('button', { name: 'Upload CSV' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = 'Procedure Code,Modifier,Amount\n99203,,150.00\n99213,,98.00\n99215,,210.00\n';
    await user.upload(input, new File([csv], 'procedure-codes.csv', { type: 'text/csv' }));
    await screen.findByText('Upload Preview');
  },
});
