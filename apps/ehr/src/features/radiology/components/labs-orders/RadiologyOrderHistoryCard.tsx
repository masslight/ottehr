import { Table, TableRow, TableCell } from '@mui/material';
import { AccordionCard } from '../../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { RadiologyOrderHistoryRow } from 'utils';
import { DateTime } from 'luxon';

interface RadiologyOrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: RadiologyOrderHistoryRow[];
  timezone: string | undefined;
}

export const RadiologyOrderHistoryCard: React.FC<RadiologyOrderHistoryProps> = ({
  isCollapsed = false,
  orderHistory = [],
  timezone,
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const formatDate = (datetime: string | undefined): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
  };

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
                <TableCell>{formatDate(row.date)}</TableCell>
              </TableRow>
            );
          })}
        </Table>
      </AccordionCard>
    </>
  );
};
