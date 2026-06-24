import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { ClaimHistoryEntry, getApiError } from 'utils';
import { getBillingClaimHistory } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { otherColors } from '../../themes/ottehr/colors';

const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13 };

function formatWhen(recorded: string): string {
  if (!recorded) return '-';
  const date = new Date(recorded);
  if (Number.isNaN(date.getTime())) return recorded;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatValue(value: string | null): string {
  return value && value.length ? value : '—';
}

export function ClaimHistory({ claimId }: { claimId: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [entries, setEntries] = useState<ClaimHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!oystehrZambda || !claimId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingClaimHistory(oystehrZambda, { claimId });
      setEntries(data.entries);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load claim history' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, claimId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!entries || entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No history recorded for this claim yet.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={thSx}>When</TableCell>
          <TableCell sx={thSx}>Who</TableCell>
          <TableCell sx={thSx}>Action</TableCell>
          <TableCell sx={thSx}>Changes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} sx={{ verticalAlign: 'top' }}>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatWhen(entry.recorded)}</TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">{entry.actor.display}</Typography>
                {entry.actor.type === 'system' && (
                  <Chip label="System" size="small" color="default" sx={{ height: 18, fontSize: 10 }} />
                )}
              </Box>
            </TableCell>
            <TableCell>{entry.activity}</TableCell>
            <TableCell>
              {entry.changes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ) : (
                entry.changes.map((change, idx) => (
                  <Box
                    key={`${entry.id}-${change.field}-${idx}`}
                    sx={{
                      py: 0.25,
                      borderBottom: idx < entry.changes.length - 1 ? `1px solid ${otherColors.lightDivider}` : 'none',
                    }}
                  >
                    <Typography variant="body2">
                      <Box component="span" sx={{ fontWeight: 500 }}>
                        {change.label}:
                      </Box>{' '}
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {formatValue(change.previousValue)}
                      </Box>{' '}
                      → {formatValue(change.newValue)}
                    </Typography>
                  </Box>
                ))
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
