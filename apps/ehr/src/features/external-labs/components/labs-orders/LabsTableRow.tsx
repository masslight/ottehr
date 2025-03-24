import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Chip, Button, Typography, Tooltip } from '@mui/material';
import { formatDate, LabOrderDTO } from 'utils';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { LabsTableColumn } from './LabsTable';
import { otherColors } from '../../../../CustomThemeProvider';
import {
  getFormattedDiagnoses,
  getFullDiagnosesText,
  getResultsReceivedDate,
  getStatusColor,
  getVisitDate,
} from './labs.helpers';

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
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.type}</Box>
            {(labOrderData.reflexTestsCount || 0) > 0 && (
              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                + {labOrderData.reflexTestsCount} Reflex results
              </Box>
            )}
          </Box>
        );
      case 'visit':
        return getVisitDate(labOrderData);
      case 'orderAdded':
        return formatDate(labOrderData.orderAdded);
      case 'provider':
        return labOrderData.provider || '';
      case 'dx': {
        const fullDiagnosesText = getFullDiagnosesText(labOrderData.diagnoses || []);
        if (fullDiagnosesText) {
          return (
            <Tooltip title={fullDiagnosesText} arrow placement="top">
              <Typography variant="body2">{getFormattedDiagnoses(labOrderData.diagnoses || [])}</Typography>
            </Tooltip>
          );
        }
        return <Typography variant="body2">{getFormattedDiagnoses(labOrderData.diagnoses || [])}</Typography>;
      }
      case 'resultsReceived':
        return getResultsReceivedDate(labOrderData);
      case 'accessionNumber':
        return labOrderData.accessionNumber;
      case 'status':
        return (
          <Chip
            label={(labOrderData.status || 'pending').toUpperCase()}
            size="small"
            sx={{
              backgroundColor: getStatusColor(labOrderData.status || 'pending'),
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          />
        );
      case 'psc':
        return labOrderData.isPSC ? 'PSC' : '';
      case 'actions':
        if (allowDelete && labOrderData.status === 'pending') {
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
