import { TableCell, TableRow, Box } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';
import { NursingOrdersTableColumn } from './NursingOrdersTable';

interface NursingOrdersTableRowProps {
  columns: NursingOrdersTableColumn[];
  nursingOrderData: any;
  onRowClick?: () => void;
  allowDelete?: boolean;
}

export const NursingOrdersTableRow = ({
  nursingOrderData,
  columns,
  onRowClick,
}: NursingOrdersTableRowProps): ReactElement => {
  const formatDate = (datetime: string): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(nursingOrderData.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  const renderCellContent = (column: NursingOrdersTableColumn): React.ReactNode => {
    switch (column) {
      case 'order':
        return (
          <Box>
            <Box>{nursingOrderData.order}</Box>
          </Box>
        );
      case 'orderAdded':
        return (
          <Box>
            <Box>{formatDate(nursingOrderData.orderAddedDate)}</Box>
            <Box sx={{ opacity: '60%' }}>{nursingOrderData.orderingPhysician}</Box>
          </Box>
        );
      case 'status':
        return <NursingOrdersStatusChip status={nursingOrderData.orderStatus} />;
      default:
        return null;
    }
  };

  return (
    <TableRow
      sx={{
        '&:hover': { backgroundColor: '#f5f5f5' },
        cursor: 'pointer',
      }}
      onClick={onRowClick}
    >
      {columns.map((column) => (
        <TableCell key={column}>{renderCellContent(column)}</TableCell>
      ))}
    </TableRow>
  );
};
