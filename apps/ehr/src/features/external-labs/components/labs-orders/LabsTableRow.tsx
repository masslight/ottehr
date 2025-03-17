import { ReactElement } from 'react';
import { TableCell, TableRow, Box, Chip, Button, Typography, Tooltip } from '@mui/material';
import { formatDate, LabOrderDTO } from 'utils';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { LabsTableColumn } from './LabsTable';
import { otherColors } from '../../../../CustomThemeProvider';
import {
  getAccessionNumber,
  getFormattedDiagnoses,
  getFullDiagnosesText,
  getResultsReceivedDate,
  getStatusColor,
  getVisitDate,
} from './labs.helpers';
import { getExternalLabOrderEditUrl } from '../../../css-module/routing/helpers';

interface LabsTableRowProps {
  appointmentId: string;
  labOrderData: LabOrderDTO;
  onDeleteOrder?: (encounterId?: string) => void;
  columns: LabsTableColumn[];
  allowDelete?: boolean;
}

export const LabsTableRow = ({
  appointmentId,
  labOrderData,
  onDeleteOrder,
  columns,
  allowDelete = false,
}: LabsTableRowProps): ReactElement => {
  const navigateTo = useNavigate();

  const handleRowClick = (): void => {
    // navigateTo(getExternalLabOrderEditUrl(appointmentId, labOrderData.id));
    navigateTo(getExternalLabOrderEditUrl(appointmentId, labOrderData.id));
  };

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
        return getAccessionNumber(labOrderData);
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
      onClick={handleRowClick}
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
