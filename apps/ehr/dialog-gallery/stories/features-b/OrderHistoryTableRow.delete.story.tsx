import { Table, TableBody } from '@mui/material';
import { OrderHistoryTableRow } from 'src/features/immunization/components/OrderHistoryTableRow';
import { defineStory } from '../../harness/story';
import { mockImmunizationOrder } from './immunization-mocks';

export default defineStory({
  title: 'Delete immunization order (order history row)',
  source: 'apps/ehr/src/features/immunization/components/OrderHistoryTableRow.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'In-person chart → Immunization → MAR table → trash icon on an order row',
  notes: 'A single real row is rendered inside a bare table; the order is mock data.',
  route: '/in-person/appt-1/immunization/mar',
  routePath: '/in-person/:id/immunization/mar',
  render: () => (
    <Table>
      <TableBody>
        <OrderHistoryTableRow order={mockImmunizationOrder} showActions />
      </TableBody>
    </Table>
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'delete' }));
    await screen.findByText('Delete immunization order');
  },
});
