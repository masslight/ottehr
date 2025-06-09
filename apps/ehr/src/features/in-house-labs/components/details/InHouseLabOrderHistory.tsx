import React from 'react';
import { Typography, Collapse, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { formatDateForLabs } from 'utils';
import { InHouseOrderDetailPageItemDTO } from 'utils/lib/types/data/in-house/in-house.types';

interface InHouseLabOrderHistoryProps {
  showDetails: boolean;
  testDetails: InHouseOrderDetailPageItemDTO;
}

export const InHouseLabOrderHistory: React.FC<InHouseLabOrderHistoryProps> = ({ showDetails, testDetails }) => {
  return (
    <Collapse in={showDetails}>
      <Table
        sx={{
          p: '8px 16px',
          borderCollapse: 'separate',
          backgroundColor: '#F8F9FA',
          borderRadius: '8px',
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
              <TableCell
                sx={{
                  p: '8px 0',
                  width: '33%',
                  verticalAlign: 'middle',
                }}
              >
                <InHouseLabsStatusChip status={status} />
              </TableCell>
              <TableCell
                sx={{
                  p: '8px 0',
                  width: '33%',
                  verticalAlign: 'middle',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {providerName ? `by ${providerName}` : ''}
                </Typography>
              </TableCell>
              <TableCell
                sx={{
                  p: '8px 0',
                  width: '33%',
                  verticalAlign: 'middle',
                  textAlign: 'right',
                }}
              >
                <Typography variant="body2">{formatDateForLabs(date, testDetails.timezone)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Collapse>
  );
};
