import React from 'react';
import { Typography, Collapse, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { formatDateForLabs } from 'utils';
import { InHouseOrderDetailPageDTO } from 'utils/lib/types/data/in-house/in-house.types';

interface InHouseLabOrderHistoryProps {
  showDetails: boolean;
  testDetails: InHouseOrderDetailPageDTO;
}

export const InHouseLabOrderHistory: React.FC<InHouseLabOrderHistoryProps> = ({ showDetails, testDetails }) => {
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
                <Typography variant="body2">{formatDateForLabs(date, testDetails.timezone)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Collapse>
  );
};
