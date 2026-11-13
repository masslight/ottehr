import { ImmunizationOrderCreateEdit } from 'src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { defineStory } from '../../harness/story';
import { immunizationMocks } from './immunization-mocks';

export default defineStory({
  title: 'Delete immunization order (edit order page)',
  source: 'apps/ehr/src/features/immunization/pages/ImmunizationOrderCreateEdit.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'In-person chart → Immunization → edit a pending order → "Delete Order"',
  notes: 'Edit page rendered with a mocked order (get-immunization-orders); opened via the real Delete Order button.',
  route: '/in-person/appt-1/immunization/order/imm-order-1',
  routePath: '/in-person/:id/immunization/order/:orderId',
  mocks: immunizationMocks,
  render: () => <ImmunizationOrderCreateEdit />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete Order' }, { timeout: 10000 }));
    await screen.findByText('Delete immunization order');
  },
});
