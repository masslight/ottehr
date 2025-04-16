import { Table, TableRow, TableCell } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { LabOrderHistoryRow } from 'utils/lib/types/data/labs/labs.types';

interface OrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: LabOrderHistoryRow[];
}

export const OrderHistoryCard: React.FC<OrderHistoryProps> = ({ isCollapsed = false, orderHistory = [] }) => {
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
            const isReviewOrReceiveAction = row.action === 'reviewed' || row.action === 'received';
            const actionDescription = isReviewOrReceiveAction ? `${row.action} (${row.resultType})` : row.action;
            return (
              <TableRow key={`${row.action}-${row.performer}-${row.date}`}>
                <TableCell>{actionDescription}</TableCell>
                <TableCell>{row.performer}</TableCell>
                <TableCell>{row.date}</TableCell>
              </TableRow>
            );
          })}
        </Table>
      </AccordionCard>
    </>
  );
};
