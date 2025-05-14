import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Typography, Tooltip, useTheme, Chip } from '@mui/material';
import { LabOrderListPageDTO } from 'utils/lib/types/data/labs';
import { InHouseLabsTableColumn } from './InHouseLabsTable';
import { DateTime } from 'luxon';

interface InHouseLabsTableRowProps {
  columns: InHouseLabsTableColumn[];
  labOrderData: LabOrderListPageDTO;
  onRowClick?: () => void;
  allowDelete?: boolean;
}

export const InHouseLabsTableRow = ({ labOrderData, columns, onRowClick }: InHouseLabsTableRowProps): ReactElement => {
  const theme = useTheme();

  const formatDate = (datetime: string): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(labOrderData.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  const getStatusChip = (status: string): ReactElement => {
    let color = 'default';
    let label = status;

    switch (status.toLowerCase()) {
      case 'final':
        color = 'primary';
        label = 'FINAL';
        break;
      case 'collected':
      case 'preliminary':
        color = 'warning';
        label = 'COLLECTED';
        break;
      default:
        color = 'secondary';
        label = 'COLLECTED';
    }

    return (
      <Chip
        label={label}
        color={color as any}
        size="small"
        sx={{
          borderRadius: '4px',
          fontWeight: 'bold',
          backgroundColor: color === 'primary' ? '#e6f4ff' : '#e8deff',
          color: color === 'primary' ? '#1976d2' : '#5e35b1',
        }}
      />
    );
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
        return <Box>{formatDate(labOrderData.lastResultReceivedDate)}</Box>;
      case 'status':
        return getStatusChip(labOrderData.orderStatus);
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
