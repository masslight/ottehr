import {
  Button,
  Link,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { adjustMedicationInventory } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FundingChip } from 'src/features/immunization/components/VaccineLotBlank';
import { useApiClients } from 'src/hooks/useAppClients';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { VfcBorrowingRow } from 'utils/lib/types/api/config/in-house-medications';
import { VFC_ELIGIBILITY_LABELS } from 'utils/lib/types/data/immunization/vfc';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { formatWhen } from './inventory.helpers';
import { INVENTORY_QUERY_KEY, useVfcBorrowings } from './inventory.queries';

/** Admin → Inventory: the vaccine borrowing log, one row per dose given from the other stock. */
export default function VfcBorrowingLog(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useVfcBorrowings();
  const [replacing, setReplacing] = useState<string | undefined>(undefined);
  const borrowings = data?.borrowings ?? [];

  const markReplaced = async (borrowing: VfcBorrowingRow): Promise<void> => {
    if (!oystehrZambda) return;
    setReplacing(borrowing.id);
    try {
      await adjustMedicationInventory(oystehrZambda, { action: 'borrowing-replaced', borrowingId: borrowing.id });
      await queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });
    } catch (err) {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to mark the borrowing replaced' }), {
        variant: 'error',
      });
    } finally {
      setReplacing(undefined);
    }
  };

  return (
    <>
      <Typography variant="h5" color="primary.dark" sx={{ mt: 4, mb: 0.5 }}>
        Vaccine borrowing log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Doses given from VFC stock to a patient who was not eligible, or from private stock to one who was. Each must be
        paid back to the stock it came from.
      </Typography>
      {isError ? (
        <Typography color="error">An error occurred getting the borrowing log: {error.message}</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small" data-testid={dataTestIds.vfcBorrowingLog.table}>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                <TableCell>Date</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Vaccine · lot</TableCell>
                <TableCell>Stock used → owed to</TableCell>
                <TableCell>Eligibility</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Replaced</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Skeleton width="40%" />
                  </TableCell>
                </TableRow>
              )}
              {!isPending && borrowings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ color: 'text.secondary' }}>
                    No borrowing recorded.
                  </TableCell>
                </TableRow>
              )}
              {borrowings.map((borrowing) => (
                <TableRow key={borrowing.id} data-testid={dataTestIds.vfcBorrowingLog.row(borrowing.id)}>
                  <TableCell>{formatWhen(borrowing.date)}</TableCell>
                  <TableCell>
                    {borrowing.appointmentId ? (
                      <Link component={RouterLink} to={`/in-person/${borrowing.appointmentId}`}>
                        {borrowing.patientName ?? 'Visit'}
                      </Link>
                    ) : (
                      borrowing.patientName
                    )}
                  </TableCell>
                  <TableCell>
                    {[borrowing.vaccineName, borrowing.lotNumber ? `Lot ${borrowing.lotNumber}` : undefined]
                      .filter(Boolean)
                      .join(' · ')}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <FundingChip fundingSource={borrowing.fundingSource} /> →{' '}
                    <FundingChip fundingSource={borrowing.owedTo} />
                  </TableCell>
                  <TableCell>
                    {borrowing.vfcEligibility
                      ? `${VFC_ELIGIBILITY_LABELS[borrowing.vfcEligibility].short} (${borrowing.vfcEligibility})`
                      : ''}
                  </TableCell>
                  <TableCell>{borrowing.reason}</TableCell>
                  <TableCell>{borrowing.performerName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {borrowing.replaced ? (
                      [formatDateForDisplay(borrowing.replaced.date), borrowing.replaced.performerName]
                        .filter(Boolean)
                        .join(' · ')
                    ) : (
                      <Button
                        size="small"
                        sx={{ textTransform: 'none' }}
                        disabled={replacing === borrowing.id}
                        onClick={() => void markReplaced(borrowing)}
                        data-testid={dataTestIds.vfcBorrowingLog.replacedButton(borrowing.id)}
                      >
                        Mark replaced
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
