import { otherColors } from '@ehrTheme/colors';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { formatDateForLabs, InHouseOrderListPageItemDTO } from 'utils';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { InHouseLabsTableColumn } from './InHouseLabsTable';

interface InHouseLabsTableRowProps {
  columns: InHouseLabsTableColumn[];
  labOrderData: InHouseOrderListPageItemDTO;
  onRowClick?: () => void;
  allowDelete?: boolean;
  onDeleteOrder?: () => void;
}

export const InHouseLabsTableRow = ({
  labOrderData,
  columns,
  onRowClick,
  allowDelete,
  onDeleteOrder,
}: InHouseLabsTableRowProps): ReactElement => {
  const theme = useTheme();

  const renderCellContent = (column: InHouseLabsTableColumn): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItemName}</Box>
          </Box>
        );
      case 'visit':
        return <Box>{formatDateForLabs(labOrderData.visitDate, labOrderData.timezone)}</Box>;
      case 'orderAdded':
        return <Box>{formatDateForLabs(labOrderData.orderAddedDate, labOrderData.timezone)}</Box>;
      case 'provider':
        return labOrderData.orderingPhysicianFullName || '';
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
        return <Box>{formatDateForLabs(labOrderData.resultReceivedDate || '-', labOrderData.timezone)}</Box>;
      case 'status':
        return <InHouseLabsStatusChip status={labOrderData.status} />;
      case 'actions':
        if (allowDelete && labOrderData.status === 'ORDERED') {
          return (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOrder?.();
              }}
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              <DeleteIcon sx={{ color: otherColors.priorityHighText }} />
            </Button>
          );
        }
        return null;
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
