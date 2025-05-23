import React from 'react';
import { Typography, Collapse, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { InHouseLabDTO } from 'utils';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { DateTime } from 'luxon';

interface InHouseLabOrderHistoryProps {
  showDetails: boolean;
  testDetails: InHouseLabDTO;
}

export const InHouseLabOrderHistory: React.FC<InHouseLabOrderHistoryProps> = ({ showDetails, testDetails }) => {
  const formatDate = (datetime: string | undefined): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(testDetails.timezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  return (
    <Collapse in={showDetails}>
      <Table
        sx={{
          mt: 2,
          p: '8px 16px 8px 16px',
          borderCollapse: 'separate',
          backgroundColor: '#F8F9FA',
        }}
      >
        <TableBody>
          {testDetails.orderHistory.map(({ date, providerName, status }) => (
            <TableRow
              key={date + providerName + status}
              sx={{
                borderRadius: '8px',
                '&:last-of-type td': {
                  borderBottom: 'none',
                },
              }}
            >
              <TableCell sx={{ p: '8px 0 8px 0', width: '33%' }}>
                <InHouseLabsStatusChip status={status} />
              </TableCell>
              <TableCell sx={{ p: '8px 0 8px 0', width: '33%' }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {providerName}
                </Typography>
              </TableCell>
              <TableCell sx={{ p: '8px 0 8px 0', width: '33%' }}>
                <Typography variant="body2">{formatDate(date)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Collapse>
  );
};
