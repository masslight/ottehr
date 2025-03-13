import { ReactElement, useState } from 'react';
import { TableCell, TableRow, Box, Chip, Button, Typography, Tooltip } from '@mui/material';
import { DateTime } from 'luxon';
import { DiagnosisDTO, LabOrderDTO } from 'utils';
import { useNavigate } from 'react-router-dom';
import { deleteLabOrder } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';
import { CancelExternalLabDialog } from '../CancelExternalLabOrderDialog';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { LabsTableColumn } from './LabsTable';
import { otherColors } from '../../../../CustomThemeProvider';

interface LabsTableRowProps {
  labOrderData: LabOrderDTO;
  refreshLabOrders: () => Promise<void>;
  columns: LabsTableColumn[];
  allowDelete?: boolean;
  encounterId?: string;
}

export const LabsTableRow = ({
  labOrderData,
  refreshLabOrders,
  columns,
  allowDelete = false,
  encounterId,
}: LabsTableRowProps): ReactElement => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigateTo = useNavigate();
  const { oystehrZambda } = useApiClients();

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';

    try {
      const date = DateTime.fromISO(dateString);
      if (!date.isValid) {
        console.error('Invalid date:', dateString);
        return '';
      }
      return date.toFormat('MM/dd/yyyy hh:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const getFullDiagnosesText = (diagnoses: DiagnosisDTO[]): string => {
    if (!diagnoses || !Array.isArray(diagnoses) || diagnoses.length <= 1) return '';

    return diagnoses
      .map((dx) => {
        const display = dx.display || '';
        const code = dx.code || '';
        return `${code} ${display}`;
      })
      .join('\n');
  };

  const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): React.ReactNode => {
    if (!diagnoses || diagnoses.length === 0) {
      return '';
    }

    if (diagnoses.length === 1) {
      return `${diagnoses[0].code} ${diagnoses[0].display || ''}`;
    }

    return (
      <>
        {diagnoses[0].code} <span style={{ color: 'gray' }}>{diagnoses.length - 1} more</span>
      </>
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#E0E0E0';
      case 'received':
        return '#90CAF9';
      case 'prelim':
        return '#A5D6A7';
      case 'sent':
        return '#CE93D8';
      case 'reviewed':
        return '#81C784';
      default:
        return '#E0E0E0';
    }
  };

  const getVisitDate = (): string => {
    // todo: need to get visit date from encounter data
    return formatDate(labOrderData.orderAdded);
  };

  const getResultsReceivedDate = (): string => {
    // todo: need to get results received date from lab order data
    if (labOrderData.status === 'received' || labOrderData.status === 'reviewed') {
      return formatDate(labOrderData.orderAdded);
    }
    return '';
  };

  const getAccessionNumber = (): string => {
    // todo: need to get accession number from lab order data
    return labOrderData.id ? `DL4523H${labOrderData.id.slice(0, 3)}` : '';
  };

  const handleRowClick = (): void => {
    if (!dialogOpen) {
      // todo: need url to navigate to order details
      navigateTo(`/external-labs/order-details/${labOrderData.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  const handleCloseDialog = (): void => setDialogOpen(false);

  const handleConfirmDelete = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!encounterId) {
      setDeleteError('Unable to delete lab order: Missing encounter ID');
      return;
    }

    if (!labOrderData.id) {
      setDeleteError('Unable to delete lab order: Missing lab order ID');
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);

      if (!oystehrZambda) {
        throw new Error('Oystehr Zambda is not available');
      }

      await deleteLabOrder(oystehrZambda, {
        labOrderId: labOrderData.id,
        encounterId,
      });

      setDialogOpen(false);
      await refreshLabOrders();
    } catch (error: any) {
      console.error('Error deleting lab order:', error);
      setDeleteError(error.message || 'An error occurred while deleting the lab order');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderCellContent = (column: LabsTableColumn): ReactElement | string | null => {
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
        return getVisitDate();
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
        return getResultsReceivedDate();
      case 'accessionNumber':
        return getAccessionNumber();
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

      {allowDelete && (
        <CancelExternalLabDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          labOrderType={labOrderData.type}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}
    </TableRow>
  );
};
