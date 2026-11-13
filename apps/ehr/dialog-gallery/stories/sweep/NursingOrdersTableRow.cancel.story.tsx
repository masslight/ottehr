import { Table, TableBody } from '@mui/material';
import { NursingOrdersTableRow } from 'src/features/nursing-orders/components/orders/NursingOrdersTableRow';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Cancel nursing order',
  source: 'apps/ehr/src/features/nursing-orders/components/orders/NursingOrdersTableRow.tsx',
  base: 'InPersonModal',
  kind: 'destructive-confirm',
  where: 'In-person chart → Nursing orders → trash icon on a pending order row',
  notes: 'A single real row is rendered inside a bare table; the order is mock data.',
  render: () => (
    <Table>
      <TableBody>
        <NursingOrdersTableRow
          columns={['order', 'orderAdded', 'status']}
          allowDelete
          refetchOrders={() => undefined}
          nursingOrderData={{
            serviceRequestId: 'sr-1',
            appointmentId: 'appt-1',
            note: 'Apply ice pack to left ankle for 20 minutes',
            status: 'pending',
            orderAddedDate: '2026-11-12T15:20:00.000Z',
            orderingPhysician: 'Dr. Maya Patel',
            encounterTimezone: 'America/New_York',
          }}
        />
      </TableBody>
    </Table>
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByAltText('delete icon'));
    await screen.findByText('Cancel Nursing Order');
  },
});
