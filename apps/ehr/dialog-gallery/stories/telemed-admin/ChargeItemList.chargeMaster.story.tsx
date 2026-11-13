import { ReactElement, useState } from 'react';
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
import ChargeItemList from 'src/features/visits/telemed/components/admin/ChargeItemList';
import { defineStory } from '../../harness/story';
import { chargeMaster, zambda } from './_mocks';

// The page portals its "Add new" button into the shared admin header; give it a header slot to render into.
function WithHeaderSlot(): ReactElement {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <AdminHeaderSlotProvider value={slot}>
      <div ref={setSlot} />
      <ChargeItemList mode="charge-master" />
    </AdminHeaderSlotProvider>
  );
}

export default defineStory({
  title: 'Create charge master',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/ChargeItemList.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Billing → Charge Masters → Add new',
  notes: 'One dialog serves both fee schedules and charge masters; only the title differs. Opens empty, as in the app.',
  mocks: [zambda('list-charge-masters', [chargeMaster])],
  render: () => <WithHeaderSlot />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    await screen.findByRole('dialog');
  },
});
