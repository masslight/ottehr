import { ReactElement } from 'react';
import { useDeleteCommonLabOrderDialog } from 'src/features/common/useDeleteCommonLabOrderDialog';
import { defineStory } from '../../harness/story';

// The dialog only exists as the return value of this hook; the host just calls the hook the way
// usePatientLabOrders / useInHouseLabOrders do and exposes its `show` function.
const Host = (): ReactElement => {
  const { showDeleteLabOrderDialog, DeleteOrderDialog } = useDeleteCommonLabOrderDialog({
    deleteOrder: async () => ({ success: true }),
  });
  return (
    <>
      <button
        onClick={() =>
          showDeleteLabOrderDialog({
            serviceRequestId: 'service-request-1',
            testItemName: 'CBC With Differential/Platelet',
          })
        }
      >
        open
      </button>
      {DeleteOrderDialog}
    </>
  );
};

export default defineStory({
  title: 'Delete lab order',
  source: 'apps/ehr/src/features/common/useDeleteCommonLabOrderDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'External labs / in-house labs order tables → delete (trash) icon on an order row',
  render: () => <Host />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'open' }));
    await screen.findByRole('dialog');
  },
  notes:
    'The hook is called from a minimal host (its real callers are the lab-order list hooks); the dialog JSX is the hook’s own. Default locale strings, order in a not-yet-sent state (no extra "already sent" warning).',
});
