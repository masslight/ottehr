import type { ChargeItemDefinition } from 'fhir/r4b';
import ProcedureCodes from 'src/features/visits/telemed/components/admin/charge-items/ProcedureCodes';
import { defineStory } from '../../harness/story';
import { feeSchedule, zambda } from './_mocks';

// The version being compared against: one code fewer, and one code at an older price.
const previousVersion: ChargeItemDefinition = JSON.parse(JSON.stringify(feeSchedule));
previousVersion.meta = { versionId: 'v2', lastUpdated: '2026-02-01T14:30:00.000Z' };
previousVersion.propertyGroup = previousVersion.propertyGroup?.slice(0, 4);
const firstPrice = previousVersion.propertyGroup?.[0]?.priceComponent?.[0];
if (firstPrice?.amount) firstPrice.amount.value = 130;

export default defineStory({
  title: 'Download procedure codes CSV — delta since a version',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/ProcedureCodes.tsx',
  base: 'AppDialog',
  kind: 'picker',
  where:
    'Admin → Billing → Fee Schedules / Charge Masters → an entry → Procedure Codes tab → Download CSV → "Delta since a previous version" → pick a version',
  notes:
    'Second state of the download dialog: the delta option is selected and a prior version picked, so the change table is shown. The prior version is mocked (one code repriced, one code added since).',
  mocks: [
    zambda('get-version-history', {
      versions: [
        { versionId: 'v3', timestamp: '2026-03-02T15:04:00.000Z' },
        { versionId: 'v2', timestamp: '2026-02-01T14:30:00.000Z' },
        { versionId: 'v1', timestamp: '2026-01-01T09:00:00.000Z' },
      ],
    }),
    zambda('get-charge-item-definition-version', previousVersion),
  ],
  render: () => <ProcedureCodes feeSchedule={feeSchedule} isFetching={false} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));
    await user.click(await screen.findByLabelText('Delta since a previous version'));
    await user.click(await screen.findByLabelText('Compare against version'));
    await user.click((await screen.findAllByRole('option'))[0]);
    await screen.findByText(/\d+ changes?$/);
  },
});
