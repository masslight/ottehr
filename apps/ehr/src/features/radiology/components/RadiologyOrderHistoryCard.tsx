import { Table, TableCell, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { RadiologyOrderHistoryRow } from 'utils';
import { AccordionCard } from '../../../components/AccordionCard';
import { RadiologyTableStatusChip } from './RadiologyTableStatusChip';

interface RadiologyOrderHistoryProps {
  isLoading?: boolean;
  isCollapsed?: boolean;
  orderHistory?: RadiologyOrderHistoryRow[];
  timezone?: string;
  label?: string;
}

export const RadiologyOrderHistoryCard: React.FC<RadiologyOrderHistoryProps> = ({
  isCollapsed = false,
  orderHistory = [],
  timezone,
  label = 'Procedure History',
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const formatDate = (datetime: string | undefined): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  return (
    <>
      <AccordionCard
        label={label}
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
                <TableCell>
                  <RadiologyTableStatusChip status={row.status} />
                </TableCell>
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
