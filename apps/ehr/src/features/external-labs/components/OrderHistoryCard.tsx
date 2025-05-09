import { Table, TableRow, TableCell } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { LabOrderHistoryRow } from 'utils/lib/types/data/labs/labs.types';
import { DateTime } from 'luxon';

interface OrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: LabOrderHistoryRow[];
  timezone: string | undefined;
}

export const OrderHistoryCard: React.FC<OrderHistoryProps> = ({ isCollapsed = false, orderHistory = [], timezone }) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const formatDate = (datetime: string | undefined): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
  };

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
            const isReviewOrReceiveAction = row.action === 'reviewed' || row.action === 'received';
            const actionDescription = isReviewOrReceiveAction ? `${row.action} (${row.testType})` : row.action;
            return (
              <TableRow key={`${row.action}-${row.performer}-${row.date}`}>
                <TableCell>{actionDescription}</TableCell>
                <TableCell>{row.performer}</TableCell>
                <TableCell>{formatDate(row.date)}</TableCell>
              </TableRow>
            );
          })}
        </Table>
      </AccordionCard>
    </>
  );
};
