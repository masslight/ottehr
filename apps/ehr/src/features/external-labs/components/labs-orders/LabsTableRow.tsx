import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Chip, Button, Typography } from '@mui/material';
import { formatDate, LabOrderDTO } from 'utils';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { LabsTableColumn } from './LabsTable';
import { otherColors } from '../../../../CustomThemeProvider';
import { getStatusColor } from './labs.helpers';

interface LabsTableRowProps {
  columns: LabsTableColumn[];
  labOrderData: LabOrderDTO;
  onDeleteOrder?: () => void;
  onRowClick: () => void;
  allowDelete?: boolean;
}

export const LabsTableRow = ({
  labOrderData,
  onDeleteOrder,
  onRowClick,
  columns,
  allowDelete = false,
}: LabsTableRowProps): ReactElement => {
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
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.typeLab}</Box>
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
        return labOrderData.providerName || '';
      case 'dx': {
        // <Tooltip title={fullDxText} arrow placement="top">
        //   <Typography variant="body2">{dx}</Typography>
        // </Tooltip>
        return <Typography variant="body2">{labOrderData.dx}</Typography>;
      }
      case 'resultsReceived':
        return <DateTimeDisplay dateTimeString={labOrderData.lastResultReceivedDate} />;
      case 'accessionNumber':
        return labOrderData.accessionNumbers.join(', ');
      case 'status':
        return (
          <Chip
            label={(labOrderData.orderedLabStatus || 'pending').toUpperCase()}
            size="small"
            sx={{
              backgroundColor: getStatusColor(labOrderData.orderedLabStatus || 'pending'),
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          />
        );
      case 'psc':
        return labOrderData.isPSC ? 'PSC' : '';
      case 'actions':
        if (allowDelete && labOrderData.orderedLabStatus === 'pending') {
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
      onClick={onRowClick}
      sx={{
        '&:hover': { backgroundColor: '#f5f5f5' },
        cursor: 'pointer',
      }}
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
