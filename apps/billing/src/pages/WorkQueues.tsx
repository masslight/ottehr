import { Add as AddIcon, DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { otherColors } from 'utils/lib/theme/billing-palette';
import { WorkQueueSummary } from 'utils/lib/types/data/billing/work-queue.schemas';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingWorkQueues } from '../api/api';
import { CreateWorkQueueDialog } from '../components/work-queue/CreateWorkQueueDialog';
import { DeleteWorkQueueDialog } from '../components/work-queue/DeleteWorkQueueDialog';
import { useApiClients } from '../hooks/useAppClients';

const INCOMPLETE_HINT = 'This queue holds more claims than could be counted, so the figures are lower bounds.';
const UNAVAILABLE_HINT = "This queue's claims couldn't be counted. Open the queue to check its filters.";

// A figure for the list: "—" when it couldn't be worked out, and "+" when it's a lower bound.
function QueueFigure({ value, incomplete }: { value: string | null; incomplete: boolean }): ReactElement {
  if (value === null) {
    return (
      <Tooltip title={UNAVAILABLE_HINT}>
        <span>—</span>
      </Tooltip>
    );
  }
  if (!incomplete) return <>{value}</>;
  return (
    <Tooltip title={INCOMPLETE_HINT}>
      <span>{value}+</span>
    </Tooltip>
  );
}

// A table row can't be a link, so each cell holds a link to the queue that fills the whole cell:
// clicking anywhere on the row opens the queue, and the browser's open-in-new-tab works too. Only
// the queue name's link is a tab stop, so keyboard users meet one link per row.
function QueueLinkCell({
  queueId,
  align,
  primary,
  children,
}: {
  queueId: string;
  align?: 'right';
  primary?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    // height: 1px lets the link's height: 100% fill the cell, however tall the row grows.
    <TableCell align={align} sx={{ p: 0, height: '1px' }}>
      <Link
        to={`/work-queues/${queueId}`}
        tabIndex={primary ? undefined : -1}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          height: '100%',
          padding: '16px',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        {children}
      </Link>
    </TableCell>
  );
}

export default function WorkQueues(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [queues, setQueues] = useState<WorkQueueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkQueueSummary | null>(null);

  const fetchQueues = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingWorkQueues(oystehrZambda);
      setQueues(data.queues ?? []);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load work queues' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    void fetchQueues();
  }, [fetchQueues]);

  const headerCellSx = { fontWeight: 600, color: 'text.primary', fontSize: 14 };

  return (
    <Box p={0}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Work Queues
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Insurance claims organized into work queues.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          style={{ flexShrink: 0 }}
        >
          Create Work Queue
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : queues.length === 0 && !error ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.primary" fontWeight={500}>
            No work queues yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create a work queue to give a team of billers a filtered stream of claims to work.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{ bgcolor: 'background.paper', border: `1px solid ${otherColors.lightDivider}`, borderRadius: 2, px: 1 }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Queue</TableCell>
                <TableCell sx={headerCellSx} align="right">
                  Claims
                </TableCell>
                <TableCell sx={headerCellSx} align="right">
                  Charged
                </TableCell>
                <TableCell sx={headerCellSx}>Owner</TableCell>
                <TableCell sx={{ width: 56 }} aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <QueueLinkCell queueId={queue.id} primary>
                    <Box>
                      <Typography fontWeight={500}>{queue.name}</Typography>
                      {queue.description && (
                        <Typography variant="body2" color="text.secondary">
                          {queue.description}
                        </Typography>
                      )}
                    </Box>
                  </QueueLinkCell>
                  <QueueLinkCell queueId={queue.id} align="right">
                    <QueueFigure
                      value={queue.claimCount === null ? null : queue.claimCount.toLocaleString()}
                      incomplete={queue.incomplete}
                    />
                  </QueueLinkCell>
                  <QueueLinkCell queueId={queue.id} align="right">
                    <QueueFigure
                      value={queue.charged === null ? null : formatCurrency(queue.charged)}
                      incomplete={queue.incomplete}
                    />
                  </QueueLinkCell>
                  <QueueLinkCell queueId={queue.id}>{queue.owner?.name ?? ''}</QueueLinkCell>
                  <TableCell align="right" sx={{ py: 0 }}>
                    <Tooltip title="Delete work queue">
                      <IconButton size="small" aria-label={`Delete ${queue.name}`} onClick={() => setDeleting(queue)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <CreateWorkQueueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(queue) => navigate(`/work-queues/${queue.id}`)}
      />
      <DeleteWorkQueueDialog
        queue={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setQueues((current) => current.filter((q) => q.id !== deleting?.id));
          setDeleting(null);
        }}
      />
    </Box>
  );
}
