import { Link, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { InventoryLotRow } from 'utils/lib/types/api/config/in-house-medications';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { describeChange, describeReason, formatWhen } from './inventory.helpers';
import { useLotHistory } from './inventory.queries';

const RECENT_HISTORY_ENTRIES = 7;

interface LotHistoryProps {
  lot: InventoryLotRow;
}

export const LotHistory = ({ lot }: LotHistoryProps): ReactElement => {
  const [showAll, setShowAll] = useState(false);
  const { data, isPending, isError, error } = useLotHistory(lot.id);

  const entries = data?.entries ?? [];
  const shown = showAll ? entries : entries.slice(0, RECENT_HISTORY_ENTRIES);
  const hidden = entries.length - shown.length;

  return (
    <>
      <Typography variant="overline" color="primary.dark" fontWeight={500} sx={{ display: 'block', mb: 1 }}>
        Stock history
      </Typography>
      {isError ? (
        <Typography color="error">An error occurred getting the stock history: {error.message}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Change</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Visit</TableCell>
              <TableCell>By</TableCell>
              <TableCell>On Hand After</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton width="40%" />
                </TableCell>
              </TableRow>
            )}
            {shown.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatWhen(entry.effectiveDateTime)}</TableCell>
                <TableCell>{describeChange(entry)}</TableCell>
                <TableCell>{describeReason(entry)}</TableCell>
                <TableCell>
                  {entry.visit
                    ? (() => {
                        const label = [entry.visit.patientName, formatDateForDisplay(entry.visit.date)]
                          .filter(Boolean)
                          .join(', ');
                        return entry.visit.appointmentId ? (
                          <Link component={RouterLink} to={`/in-person/${entry.visit.appointmentId}`}>
                            {label || 'Visit'}
                          </Link>
                        ) : (
                          label
                        );
                      })()
                    : null}
                </TableCell>
                <TableCell>{entry.performerName}</TableCell>
                <TableCell>{entry.onHandAfter}</TableCell>
              </TableRow>
            ))}
            {hidden > 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Link component="button" type="button" variant="body2" onClick={() => setShowAll(true)}>
                    Show {hidden} earlier {hidden === 1 ? 'entry' : 'entries'}
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
};
