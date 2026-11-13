import { defineStory } from '../../harness/story';
import { LabsTableHost, makeLabOrder } from './_labs';

export default defineStory({
  title: 'Manually submit lab order after electronic submit failed',
  source: 'apps/ehr/src/features/external-labs/components/labs-orders/LabsTableContainer.tsx',
  base: 'CustomDialog',
  kind: 'confirm',
  where: 'In-person visit → External labs → "Submit & Print Order(s)" when the lab rejects the electronic order',
  mocks: [
    {
      url: 'submit-lab-order',
      response: {
        status: 200,
        output: { orderPdfUrls: [], failedOrdersByOrderNumber: { 'ORD-10472': 'Lab interface is unavailable' } },
      },
    },
  ],
  render: () => <LabsTableHost labOrders={[makeLabOrder({})]} />,
  play: async ({ user, screen }) => {
    // The zambda client is created in an effect once the (mock) auth token resolves.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await user.click(await screen.findByRole('button', { name: 'Submit & Print Order(s)' }));
    await screen.findByText('Manually submitting lab order');
  },
  notes: 'submit-lab-order is mocked to report one failed order number, which is what opens this dialog.',
});
