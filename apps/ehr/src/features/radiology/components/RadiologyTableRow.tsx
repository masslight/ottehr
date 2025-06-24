import { otherColors } from '@ehrTheme/colors';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, Chip, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { formatDate, GetRadiologyOrderListZambdaOrder } from 'utils';
import { RadiologyTableColumn } from './RadiologyTable';
import { RadiologyTableStatusChip } from './RadiologyTableStatusChip';

interface RadiologyTableRowProps {
  columns: RadiologyTableColumn[];
  order: GetRadiologyOrderListZambdaOrder;
  onDeleteOrder?: () => void;
  allowDelete?: boolean;
  onRowClick?: () => void;
}

export const RadiologyTableRow = ({
  order,
  onDeleteOrder,
  columns,
  allowDelete = false,
  onRowClick,
}: RadiologyTableRowProps): ReactElement => {
  const theme = useTheme();

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onDeleteOrder) {
      onDeleteOrder();
    }
  };

  const renderCellContent = (column: RadiologyTableColumn): React.ReactNode => {
    switch (column) {
      case 'studyType':
        return <Typography variant="body2">{order.studyType}</Typography>;
      case 'dx': {
        return <Typography variant="body2">{order.diagnosis}</Typography>;
      }
      case 'ordered':
        return (
          <Box>
            <DateTimeDisplay dateTimeString={order.orderAddedDateTime} />
            <Typography
              variant="body2"
              sx={{
                color: 'gray',
              }}
            >{`${order.providerName}`}</Typography>
          </Box>
        );
      case 'stat':
        if (order.isStat) {
          return (
            <Chip
              size="small"
              label="STAT"
              sx={{
                borderRadius: '4px',
                border: 'none',
                fontWeight: 900,
                fontSize: '14px',
                textTransform: 'uppercase',
                background: theme.palette.error.main,
                color: 'white',
                padding: '8px',
                height: '24px',
                width: 'fit-content',
              }}
              variant="outlined"
            />
          );
        } else {
          return <></>;
        }
      case 'status':
        return <RadiologyTableStatusChip status={order.status} />;
      case 'actions':
        if (allowDelete && order.status === 'pending') {
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
      <Typography variant="body2">
        {dateStr}&nbsp;{timeStr}
      </Typography>
    </Box>
  );
};
