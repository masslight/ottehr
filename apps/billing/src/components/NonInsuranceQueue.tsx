import { ReceiptLong as ReceiptIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';

const formatUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

interface NonInsuranceClaimRow {
  id: string;
  claimId: string;
  patientName: string;
  dateOfService: string;
  amount: number;
  invoiced: boolean;
  invoiceNumber?: string;
}

// Chip colors cycled per invoice so claims on the same invoice are visually grouped.
const INVOICE_CHIP_COLORS: ('primary' | 'secondary' | 'success' | 'warning' | 'info')[] = [
  'primary',
  'success',
  'warning',
  'info',
  'secondary',
];

// Deterministic RNG so each org's fake data is stable across renders.
const hashSeed = (s: string): number => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FIRST_NAMES = ['Maria', 'David', 'Angela', 'Sam', 'Linda', 'Robert', 'Emily', 'Omar', 'Grace', 'Marcus', 'Hannah', 'Tyler', 'Sofia', 'Noah', 'Priya', 'Ethan', 'Naomi', 'Carlos', 'Rachel', 'Peter'];
const LAST_NAMES = ['Gonzalez', 'Kim', 'Wright', 'Patel', 'Okafor', 'Chen', 'Duncan', 'Haddad', 'Liu', 'Bell', 'Fitzgerald', 'Novak', 'Ramirez', 'Bergstrom', 'Raman', 'Caldwell', 'Sasaki', 'Mendes', 'Adeyemi', 'Kovacs'];

function generateClaims(seedKey: string, count: number): NonInsuranceClaimRow[] {
  const rng = mulberry32(hashSeed(seedKey));
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = Math.floor(rng() * 180);
    const date = new Date(2026, 7, 23);
    date.setDate(date.getDate() - daysAgo);
    const dateOfService = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    return {
      id: `${seedKey}-${i}`,
      claimId: `CLM-${1000 + i}`,
      patientName: `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]}`,
      dateOfService,
      amount: Math.round((40 + rng() * 410) * 100) / 100,
      invoiced: false,
    };
  });
}

interface InvoiceRow {
  invoiceNumber: string;
  date: string;
  claims: NonInsuranceClaimRow[];
  total: number;
}

// Groups a few hundred claims into invoices of 3–7 claims each.
function generateInvoices(organization: string, claimCount: number): InvoiceRow[] {
  const claims = generateClaims(`${organization}-aging`, claimCount);
  const rng = mulberry32(hashSeed(`${organization}-inv`));
  const invoices: InvoiceRow[] = [];
  let index = 0;
  let invoiceIdx = 0;
  while (index < claims.length) {
    const size = 3 + Math.floor(rng() * 5);
    const group = claims.slice(index, index + size);
    const invoiceNumber = `INV-${3000 + invoiceIdx}`;
    group.forEach((claim) => {
      claim.invoiced = true;
      claim.invoiceNumber = invoiceNumber;
    });
    invoices.push({
      invoiceNumber,
      date: group[0].dateOfService,
      claims: group,
      total: group.reduce((sum, claim) => sum + claim.amount, 0),
    });
    index += size;
    invoiceIdx += 1;
  }
  return invoices;
}

interface InvoicePreviewDialogProps {
  open: boolean;
  organization: string;
  invoiceNumber: string;
  claims: NonInsuranceClaimRow[];
  mode: 'create' | 'view';
  onClose: () => void;
  onPrimary: () => void;
}

// Fake generated invoice document, styled like a printable statement.
function InvoicePreviewDialog({
  open,
  organization,
  invoiceNumber,
  claims,
  mode,
  onClose,
  onPrimary,
}: InvoicePreviewDialogProps): ReactElement {
  const total = claims.reduce((sum, claim) => sum + claim.amount, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 720, maxWidth: '95vw' } }}>
      <DialogTitle>{mode === 'create' ? 'New Invoice' : `Invoice ${invoiceNumber}`}</DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: '#fff' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary.dark">
                INVOICE
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {invoiceNumber}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                LedgEHR Medical Group
              </Typography>
              <Typography variant="caption" color="text.secondary">
                4900 Commerce Way, Suite 210
                <br />
                Austin, TX 78701
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                BILL TO
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {organization}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Accounts Payable
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                INVOICE DATE
              </Typography>
              <Typography variant="body2">08/23/2026</Typography>
              <Typography variant="caption" color="text.secondary">
                TERMS: NET 30
              </Typography>
            </Box>
          </Box>

          <Table size="small" sx={{ mt: 3 }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'grey.100' } }}>
                <TableCell>Claim</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Date of Service</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>{claim.claimId}</TableCell>
                  <TableCell>{claim.patientName}</TableCell>
                  <TableCell>{claim.dateOfService}</TableCell>
                  <TableCell align="right">{formatUsd(claim.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, pr: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Total Due
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} color="primary.dark">
              {formatUsd(total)}
            </Typography>
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        {mode === 'view' && (
          <Button
            variant="outlined"
            onClick={() => enqueueSnackbar(`Invoice ${invoiceNumber} re-generated (demo)`, { variant: 'success' })}
          >
            Re-Generate
          </Button>
        )}
        <Button variant="contained" onClick={onPrimary}>
          {mode === 'create' ? 'Send Invoice' : 'Re-Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface NonInsuranceQueueProps {
  organization: string;
  preInvoice: boolean;
}

export function NonInsuranceQueue({ organization, preInvoice }: NonInsuranceQueueProps): ReactElement {
  // Pre-invoice queues hold only claims not yet invoiced; aging queues hold invoices.
  const initialClaims = useMemo(
    () => (preInvoice ? generateClaims(organization, 300) : []),
    [organization, preInvoice]
  );
  const invoices = useMemo(
    () => (preInvoice ? [] : generateInvoices(organization, 350)),
    [organization, preInvoice]
  );

  const [claims, setClaims] = useState<NonInsuranceClaimRow[]>(initialClaims);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceRow | null>(null);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(4000);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const invoiceChipColor = (invoiceNumber: string): (typeof INVOICE_CHIP_COLORS)[number] =>
    INVOICE_CHIP_COLORS[hashSeed(invoiceNumber) % INVOICE_CHIP_COLORS.length];

  const pagedClaims = claims.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const pagedInvoices = invoices.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const selectedRows = claims.filter((row) => selectedIds.includes(row.id));

  const toggleSelected = (id: string): void =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  // Header checkbox selects/deselects the claims on the current page.
  const pageIds = pagedClaims.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelectPage = (): void =>
    setSelectedIds((prev) =>
      allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]
    );

  const sendNewInvoice = (): void => {
    // Invoiced claims leave the pre-invoice queue.
    setClaims((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
    enqueueSnackbar(
      `Invoice INV-${nextInvoiceNumber} for ${selectedIds.length} claim(s) sent to ${organization} (demo — nothing sent)`,
      { variant: 'success' }
    );
    setNextInvoiceNumber((n) => n + 1);
    setSelectedIds([]);
    setCreatingInvoice(false);
  };

  if (preInvoice) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {claims.length} claims not yet invoiced
          </Typography>
          <Button
            variant="contained"
            startIcon={<ReceiptIcon fontSize="small" />}
            disabled={selectedIds.length === 0}
            onClick={() => setCreatingInvoice(true)}
          >
            Invoice ({selectedIds.length})
          </Button>
        </Box>

        <Table aria-label="nonInsuranceClaimsTable" size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allPageSelected}
                  indeterminate={!allPageSelected && pageIds.some((id) => selectedIds.includes(id))}
                  onChange={toggleSelectPage}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Claim</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Date of Service</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Amount
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Non-Insurance AR Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedClaims.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                  />
                </TableCell>
                <TableCell>{row.claimId}</TableCell>
                <TableCell>{row.patientName}</TableCell>
                <TableCell>{row.dateOfService}</TableCell>
                <TableCell align="right">{formatUsd(row.amount)}</TableCell>
                <TableCell>
                  <Chip label="Not Invoiced" size="small" variant="outlined" color="warning" sx={{ borderRadius: '4px' }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={claims.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value));
            setPage(0);
          }}
        />

        <InvoicePreviewDialog
          open={creatingInvoice}
          organization={organization}
          invoiceNumber={`INV-${nextInvoiceNumber}`}
          claims={selectedRows}
          mode="create"
          onClose={() => setCreatingInvoice(false)}
          onPrimary={sendNewInvoice}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {invoices.length} invoices outstanding
      </Typography>

      <Table aria-label="nonInsuranceInvoicesTable" size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Invoice</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Invoice Date</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">
              Claims
            </TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Patients</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">
              Total
            </TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pagedInvoices.map((invoice) => (
            <TableRow key={invoice.invoiceNumber} hover>
              <TableCell>
                <Tooltip title="View invoice">
                  <Chip
                    label={invoice.invoiceNumber}
                    size="small"
                    color={invoiceChipColor(invoice.invoiceNumber)}
                    onClick={() => setViewingInvoice(invoice)}
                    sx={{ borderRadius: '4px', cursor: 'pointer' }}
                  />
                </Tooltip>
              </TableCell>
              <TableCell>{invoice.date}</TableCell>
              <TableCell align="right">{invoice.claims.length}</TableCell>
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 320 }}>
                  {[...new Set(invoice.claims.map((claim) => claim.patientName))].join(', ')}
                </Typography>
              </TableCell>
              <TableCell align="right">{formatUsd(invoice.total)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Button size="small" onClick={() => setViewingInvoice(invoice)}>
                  View
                </Button>
                <Button
                  size="small"
                  sx={{ ml: 1 }}
                  onClick={() =>
                    enqueueSnackbar(`Invoice ${invoice.invoiceNumber} re-sent to ${organization} (demo — nothing sent)`, {
                      variant: 'success',
                    })
                  }
                >
                  Re-Send
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        rowsPerPageOptions={[25, 50, 100]}
        component="div"
        count={invoices.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value));
          setPage(0);
        }}
      />

      <InvoicePreviewDialog
        open={!!viewingInvoice}
        organization={organization}
        invoiceNumber={viewingInvoice?.invoiceNumber ?? ''}
        claims={viewingInvoice?.claims ?? []}
        mode="view"
        onClose={() => setViewingInvoice(null)}
        onPrimary={() => {
          enqueueSnackbar(`Invoice ${viewingInvoice?.invoiceNumber} re-sent to ${organization} (demo — nothing sent)`, {
            variant: 'success',
          });
          setViewingInvoice(null);
        }}
      />
    </Box>
  );
}
