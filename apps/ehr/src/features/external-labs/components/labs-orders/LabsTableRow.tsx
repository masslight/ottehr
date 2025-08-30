import { otherColors } from '@ehrTheme/colors';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { formatDateForLabs, LabOrderListPageDTO, PSC_LOCALE, ReflexLabDTO, UnsolicitedLabListPageDTO } from 'utils';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { LabsTableColumn } from './LabsTable';

interface LabsTableRowProps {
  columns: LabsTableColumn[];
  labOrderData: LabOrderListPageDTO | ReflexLabDTO | UnsolicitedLabListPageDTO;
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

  const renderCellContentForLabWithoutSR = (
    column: LabsTableColumn,
    lab: ReflexLabDTO | UnsolicitedLabListPageDTO
  ): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{lab.testItem}</Box>
          </Box>
        );
      case 'visit':
        return '';
      case 'orderAdded':
        return '';
      case 'provider':
        return '';
      case 'ordered':
        return '';
      case 'dx':
        return '';
      case 'resultsReceived':
        return <Box>{formatDateForLabs(lab.lastResultReceivedDate, undefined)}</Box>;
      case 'accessionNumber':
        return lab.accessionNumbers.join(', ');
      case 'requisitionNumber':
        return 'orderNumber' in lab ? lab.orderNumber : '';
      case 'status':
        return <LabsOrderStatusChip status={lab.orderStatus} />;
      case 'detail':
        return 'isReflex' in lab ? 'RFX' : 'UNS';
      case 'actions':
        return null;
      default:
        return null;
    }
  };

  const renderCellContentForOrderedLab = (column: LabsTableColumn, lab: LabOrderListPageDTO): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{lab.testItem}</Box>
          </Box>
        );
      case 'visit':
        return <Box>{formatDateForLabs(lab.visitDate, lab.encounterTimezone)}</Box>;
      case 'orderAdded':
        return <Box>{formatDateForLabs(lab.orderAddedDate, lab.encounterTimezone)}</Box>;
      case 'provider':
        return lab.orderingPhysician || '';
      case 'ordered':
        return (
          <Box>
            <Box>{formatDateForLabs(lab.orderAddedDate, lab.encounterTimezone)}</Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                by {lab.orderingPhysician || ''}
              </Typography>
            </Box>
          </Box>
        );
      case 'dx': {
        const firstDx = lab.diagnosesDTO[0]?.display || '';
        const firstDxCode = lab.diagnosesDTO[0]?.code || '';
        const firstDxText = `${firstDxCode} ${firstDx}`;
        const fullDxText = lab.diagnosesDTO.map((dx) => `${dx.code} ${dx.display}`).join('; ');
        const dxCount = lab.diagnosesDTO.length;
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
        return <Box>{formatDateForLabs(lab.lastResultReceivedDate, lab.encounterTimezone)}</Box>;
      case 'accessionNumber':
        return lab.accessionNumbers.join(', ');
      case 'requisitionNumber':
        return lab.orderNumber;
      case 'status':
        return <LabsOrderStatusChip status={lab.orderStatus} />;
      case 'detail':
        return lab.isPSC ? PSC_LOCALE : '';
      case 'actions':
        if (allowDelete && (lab.orderStatus === 'pending' || lab.orderStatus === 'ready')) {
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

  const isLabWithoutSR = 'isReflex' in labOrderData || 'isUnsolicited' in labOrderData;

  return (
    <TableRow
      sx={{
        '&:hover': { backgroundColor: '#f5f5f5' },
        cursor: 'pointer',
      }}
      onClick={onRowClick}
    >
      {columns.map((column) =>
        isLabWithoutSR ? (
          <TableCell key={column}>{renderCellContentForLabWithoutSR(column, labOrderData)}</TableCell>
        ) : (
          <TableCell key={column}>{renderCellContentForOrderedLab(column, labOrderData)}</TableCell>
        )
      )}
    </TableRow>
  );
};
