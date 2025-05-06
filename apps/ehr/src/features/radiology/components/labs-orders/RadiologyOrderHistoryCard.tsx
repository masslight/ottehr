import { Table, TableRow, TableCell } from '@mui/material';
import { AccordionCard } from '../../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { RadiologyOrderHistoryRow } from 'utils';

interface RadiologyOrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: RadiologyOrderHistoryRow[];
}

export const RadiologyOrderHistoryCard: React.FC<RadiologyOrderHistoryProps> = ({
  isCollapsed = false,
  orderHistory = [],
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  return (
    <>
      <AccordionCard
        label={'Procedure History'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Table>
          {orderHistory.map((row) => {
            return (
              <TableRow key={`${row.status}-${row.performer}-${row.date}`}>
                <TableCell>{row.status.toUpperCase()}</TableCell>
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
