import { ReactElement } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import SendOutLabsTableRow from './ExternalLabsTableRow';
import { mockLabOrders } from '../helpers/types';

export default function ExternalLabsTable(): ReactElement {
  const statusOrder = { pending: 1, received: 2, sent: 3, reviewed: 4 };

  const sortedLabOrders = [...mockLabOrders].sort((a, b) => {
    const statusComparison = statusOrder[a.status] - statusOrder[b.status];
    if (statusComparison !== 0) return statusComparison;
    return a.orderAdded.toMillis() - b.orderAdded.toMillis();
  });

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '28%', padding: '16px 16px' }}>
              Test type
            </TableCell>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '10%', padding: '8px 16px' }}>
              Order added
            </TableCell>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '28%', padding: '8px 16px' }}>
              Provider
            </TableCell>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '28%', padding: '8px 16px' }}>
              Dx
            </TableCell>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '5%', padding: '8px 16px' }}>
              Status
            </TableCell>
            <TableCell align="left" sx={{ fontWeight: 'bold', width: '1%', padding: '8px 16px' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedLabOrders.map((order, index) => (
            <SendOutLabsTableRow key={index} externalLabsData={order} />
            // TODO: use an id field or unique identifier on the lab orders here once real data is being used
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
