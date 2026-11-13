import { defineStory } from '../../harness/story';
import { LabsTableHost, makeLabOrder } from './_labs';

export default defineStory({
  title: 'Mark lab test as Rejected ABN',
  source: 'apps/ehr/src/features/external-labs/components/labs-orders/LabsTableRow.tsx',
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'In-person visit → External labs → sent order with an ABN → row action (⊗ icon)',
  render: () => (
    <LabsTableHost
      labOrders={[
        makeLabOrder({
          orderStatus: 'sent',
          abnPdfUrl: 'https://mock.invalid/abn.pdf',
          orderSubmittedDate: '2026-11-12T15:45:00.000Z',
        }),
      ]}
    />
  ),
  play: async ({ user, waitFor, screen }) => {
    const icon = await waitFor(() => {
      const el = document.querySelector('[data-testid="CancelOutlinedIcon"]');
      if (!el) throw new Error('reject ABN button not rendered yet');
      return el;
    });
    await user.click(icon.closest('button') as HTMLButtonElement);
    await screen.findByRole('dialog');
  },
  notes: 'Rendered through the real LabsTableContainer / LabsTable.',
});
