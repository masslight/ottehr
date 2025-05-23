import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Typography, Tooltip, useTheme } from '@mui/material';
import { InHouseLabsTableColumn } from './InHouseLabsTable';
import { DateTime } from 'luxon';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { InHouseOrderListPageDTO } from 'utils/lib/types/data/in-house';

interface InHouseLabsTableRowProps {
  columns: InHouseLabsTableColumn[];
  labOrderData: InHouseOrderListPageDTO;
  onRowClick?: () => void;
  allowDelete?: boolean;
}

export const InHouseLabsTableRow = ({ labOrderData, columns, onRowClick }: InHouseLabsTableRowProps): ReactElement => {
  const theme = useTheme();

  const formatDate = (datetime: string): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(labOrderData.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  const renderCellContent = (column: InHouseLabsTableColumn): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItem}</Box>
          </Box>
        );
      case 'visit':
        return <Box>{formatDate(labOrderData.visitDate)}</Box>;
      case 'orderAdded':
        return <Box>{formatDate(labOrderData.orderAddedDate)}</Box>;
      case 'provider':
        return labOrderData.orderingPhysician || '';
      case 'dx': {
        const firstDx = labOrderData.diagnosesDTO[0]?.display || '';
        const firstDxCode = labOrderData.diagnosesDTO[0]?.code || '';
        const firstDxText = `${firstDxCode} ${firstDx}`;
        const fullDxText = labOrderData.diagnosesDTO.map((dx) => `${dx.code} ${dx.display}`).join('; ');
        const dxCount = labOrderData.diagnosesDTO.length;

        if (dxCount > 1) {
          return (
            <Tooltip title={fullDxText} arrow placement="top">
              <Typography variant="body2">
                {firstDxText}; <span style={{ color: theme.palette.text.secondary }}>+ {dxCount - 1} more</span>
              </Typography>
            </Tooltip>
          );
        }
        return <Typography variant="body2">{firstDxText}</Typography>;
      }
      case 'resultsReceived':
        return <Box>{formatDate(labOrderData.lastResultReceivedDate || '-')}</Box>;
      case 'status':
        return <InHouseLabsStatusChip status={labOrderData.status} />;
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
