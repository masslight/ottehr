import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ClaimHistoryEntry, ClaimHistoryLink, getApiError } from 'utils';
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

// A single before/after value: a link to the resource's screen when one is available, otherwise text.
function HistoryValue({
  value,
  link,
  muted,
}: {
  value: string | null;
  link?: ClaimHistoryLink | null;
  muted?: boolean;
}): ReactElement {
  const color = muted ? 'text.secondary' : 'inherit';
  if (link && value) {
    return (
      <MuiLink component={RouterLink} to={`/${link.screen}/${link.id}`} sx={{ fontWeight: 500 }}>
        {value}
      </MuiLink>
    );
  }
  return (
    <Box component="span" sx={{ color }}>
      {formatValue(value)}
    </Box>
  );
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

  let body: ReactElement;
  if (loading) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    body = <Alert severity="error">{error}</Alert>;
  } else if (!entries || entries.length === 0) {
    body = (
      <Typography variant="body2" color="text.secondary">
        No history recorded for this claim yet.
      </Typography>
    );
  } else {
    body = (
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
            <TableRow key={entry.id} sx={{ verticalAlign: 'top', '& td': { borderColor: otherColors.lightDivider } }}>
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
                    <Typography variant="body2" key={`${entry.id}-${change.field}-${idx}`} sx={{ py: 0.25 }}>
                      <Box component="span" sx={{ fontWeight: 500 }}>
                        {change.label}:
                      </Box>{' '}
                      <HistoryValue value={change.previousValue} link={change.previousLink} muted /> →{' '}
                      <HistoryValue value={change.newValue} link={change.newLink} />
                    </Typography>
                  ))
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16} sx={{ mb: 1.5 }}>
          History
        </Typography>
        {body}
      </CardContent>
    </Card>
  );
}
