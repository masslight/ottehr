import { otherColors } from '@ehrTheme/colors';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { formatDateForLabs, LabOrderListPageDTO, PSC_LOCALE } from 'utils';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { LabsTableColumn } from './LabsTable';

interface LabsTableRowProps {
  columns: LabsTableColumn[];
  labOrderData: LabOrderListPageDTO;
  onDeleteOrder?: () => void;
  allowDelete?: boolean;
  onRowClick?: () => void;
}

export const LabsTableRow = ({
  labOrderData,
  onDeleteOrder,
  columns,
  allowDelete = false,
  onRowClick,
}: LabsTableRowProps): ReactElement => {
  const theme = useTheme();
  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onDeleteOrder) {
      onDeleteOrder();
    }
  };

  const renderCellContent = (column: LabsTableColumn): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItem}</Box>
            {(labOrderData.reflexResultsCount || 0) > 0 && (
              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                + {labOrderData.reflexResultsCount} Reflex results
              </Box>
            )}
          </Box>
        );
      case 'visit':
        return <Box>{formatDateForLabs(labOrderData.visitDate, labOrderData.encounterTimezone)}</Box>;
      case 'orderAdded':
        return <Box>{formatDateForLabs(labOrderData.orderAddedDate, labOrderData.encounterTimezone)}</Box>;
      case 'provider':
        return labOrderData.orderingPhysician || '';
      case 'ordered':
        return (
          <Box>
            <Box>{formatDateForLabs(labOrderData.orderAddedDate, labOrderData.encounterTimezone)}</Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                by {labOrderData.orderingPhysician || ''}
              </Typography>
            </Box>
          </Box>
        );
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
        return <Box>{formatDateForLabs(labOrderData.lastResultReceivedDate, labOrderData.encounterTimezone)}</Box>;
      case 'accessionNumber':
        return labOrderData.accessionNumbers.join(', ');
      case 'requisitionNumber':
        return labOrderData.orderNumber;
      case 'status':
        return <LabsOrderStatusChip status={labOrderData.orderStatus} />;
      case 'detail':
        return labOrderData.isPSC ? PSC_LOCALE : '';
      case 'actions':
        if (allowDelete && (labOrderData.orderStatus === 'pending' || labOrderData.orderStatus === 'ready')) {
          return (
            <Button
              onClick={handleDeleteClick}
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
