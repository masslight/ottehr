import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Button, Typography, Tooltip, useTheme } from '@mui/material';
import { formatDate, LabOrderListPageDTO } from 'utils';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { LabsTableColumn } from './LabsTable';
import { otherColors } from '../../../../CustomThemeProvider';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';

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
        return <DateTimeDisplay dateTimeString={labOrderData.visitDate} />;
      case 'orderAdded':
        return <DateTimeDisplay dateTimeString={labOrderData.orderAddedDate} />;
      case 'provider':
        return labOrderData.orderingPhysician || '';
      case 'dx': {
        const firstDx = labOrderData.diagnosesDTO[0]?.display || '';
        const fullDxText = labOrderData.diagnosesDTO.map((dx) => dx.display).join('; ');
        const dxCount = labOrderData.diagnosesDTO.length;
        if (dxCount > 1) {
          return (
            <Tooltip title={fullDxText} arrow placement="top">
              <Typography variant="body2">
                {firstDx}; <span style={{ color: theme.palette.text.secondary }}>+ {dxCount - 1} more</span>
              </Typography>
            </Tooltip>
          );
        }
        return <Typography variant="body2">{firstDx}</Typography>;
      }
      case 'resultsReceived':
        return <DateTimeDisplay dateTimeString={labOrderData.lastResultReceivedDate} />;
      case 'accessionNumber':
        return labOrderData.accessionNumbers.join(', ');
      case 'status':
        return <LabsOrderStatusChip status={labOrderData.orderStatus} />;
      case 'psc':
        return labOrderData.isPSC ? 'PSC' : '';
      case 'actions':
        if (allowDelete && labOrderData.orderStatus === 'pending') {
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

const DateTimeDisplay = ({ dateTimeString }: { dateTimeString: string }): ReactElement => {
  const dateTimeRegex = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2} [AP]M)$/;
  const formattedDate = formatDate(dateTimeString, 'MM/dd/yyyy hh:mm a');
  const match = formattedDate.match(dateTimeRegex);

  if (!match) {
    return <Box>{formattedDate}</Box>;
  }

  const [, dateStr, timeStr] = match;

  return (
    <Box>
      <Typography variant="body2">{dateStr}</Typography>
      <Typography variant="body2">{timeStr}</Typography>
    </Box>
  );
};
