import { Table, TableCell, TableRow } from '@mui/material';
import React, { useState } from 'react';
import { formatDateForLabs, PSC_HOLD_LOCALE } from 'utils';
import { LabOrderHistoryRow } from 'utils/lib/types/data/labs/labs.types';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { LabsOrderStatusChip } from './ExternalLabsStatusChip';

interface OrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: LabOrderHistoryRow[];
  timezone: string | undefined;
  isPSCPerformed?: boolean;
}

export const OrderHistoryCard: React.FC<OrderHistoryProps> = ({
  isCollapsed = false,
  orderHistory = [],
  timezone,
  isPSCPerformed,
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  return (
    <>
      <AccordionCard
        label={'Order History'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Table>
          {orderHistory.map((row) => {
            const isReviewOrReceiveAction =
              row.action === 'reviewed' || row.action === 'received' || row.action === 'corrected';
            return (
              <TableRow key={`${row.action}-${row.performer}-${row.date}`}>
                <TableCell>
                  {<LabsOrderStatusChip status={row.action} />}
                  {isReviewOrReceiveAction ? ` (${row.testType})` : ''}
                </TableCell>
                <TableCell>
                  {row.action === 'performed' && isPSCPerformed
                    ? PSC_HOLD_LOCALE
                    : row.performer
                    ? `by ${row.performer}`
                    : ''}
                </TableCell>
                <TableCell>{formatDateForLabs(row.date, timezone)}</TableCell>
              </TableRow>
            );
          })}
        </Table>
      </AccordionCard>
    </>
  );
};
