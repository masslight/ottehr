import { ChatOutlined as ChatIcon, Phone as PhoneIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';
import { agingBucketForDate } from '../constants/agingBuckets';

const formatUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

const PRE_INVOICE_STATUSES = ['None', 'Not Invoiced', 'Ready to Invoice'];
const POST_INVOICE_STATUSES = ['Invoiced', 'Paid'];

const STATUS_CHIP_COLOR: Record<string, 'default' | 'warning' | 'info' | 'primary' | 'success'> = {
  None: 'default',
  'Not Invoiced': 'warning',
  'Ready to Invoice': 'info',
  Invoiced: 'primary',
  Paid: 'success',
};

interface PatientBalanceRow {
  id: string;
  patientName: string;
  dateOfService: string;
  amount: number;
  status: string;
  phone: string;
  email: string;
}

// Fake patient balances until patient AR is backed by real data.
const BASE_PATIENTS: Omit<PatientBalanceRow, 'id' | 'status'>[] = [
  { patientName: 'Maria Gonzalez', dateOfService: '06/12/2026', amount: 148.5, phone: '(555) 201-8834', email: 'maria.g@example.com' },
  { patientName: 'David Kim', dateOfService: '06/03/2026', amount: 92.25, phone: '(555) 318-2245', email: 'dkim@example.com' },
  { patientName: 'Angela Wright', dateOfService: '05/28/2026', amount: 315.0, phone: '(555) 476-9081', email: 'a.wright@example.com' },
  { patientName: 'Sam Patel', dateOfService: '05/21/2026', amount: 64.75, phone: '(555) 907-1123', email: 'sam.patel@example.com' },
  { patientName: 'Linda Okafor', dateOfService: '05/14/2026', amount: 210.4, phone: '(555) 550-7789', email: 'lokafor@example.com' },
  { patientName: 'Robert Chen', dateOfService: '05/02/2026', amount: 57.9, phone: '(555) 662-3410', email: 'r.chen@example.com' },
  { patientName: 'Emily Duncan', dateOfService: '04/25/2026', amount: 129.99, phone: '(555) 731-5566', email: 'eduncan@example.com' },
  { patientName: 'James Whitfield', dateOfService: '04/22/2026', amount: 88.6, phone: '(555) 284-6621', email: 'jwhitfield@example.com' },
  { patientName: 'Sofia Ramirez', dateOfService: '04/18/2026', amount: 176.35, phone: '(555) 493-0754', email: 'sofia.r@example.com' },
  { patientName: 'Noah Bergstrom', dateOfService: '04/15/2026', amount: 241.8, phone: '(555) 616-8830', email: 'nbergstrom@example.com' },
  { patientName: 'Grace Liu', dateOfService: '04/11/2026', amount: 73.2, phone: '(555) 342-9917', email: 'grace.liu@example.com' },
  { patientName: 'Marcus Bell', dateOfService: '04/07/2026', amount: 195.45, phone: '(555) 728-4406', email: 'mbell@example.com' },
  { patientName: 'Hannah Fitzgerald', dateOfService: '04/02/2026', amount: 112.9, phone: '(555) 851-2093', email: 'hfitz@example.com' },
  { patientName: 'Omar Haddad', dateOfService: '03/28/2026', amount: 304.15, phone: '(555) 190-6642', email: 'ohaddad@example.com' },
  { patientName: 'Priya Raman', dateOfService: '03/24/2026', amount: 149.0, phone: '(555) 277-3358', email: 'praman@example.com' },
  { patientName: 'Tyler Novak', dateOfService: '03/19/2026', amount: 82.5, phone: '(555) 903-7714', email: 'tnovak@example.com' },
  { patientName: 'Isabella Moretti', dateOfService: '03/14/2026', amount: 267.25, phone: '(555) 468-1290', email: 'imoretti@example.com' },
  { patientName: 'Ethan Caldwell', dateOfService: '03/09/2026', amount: 54.35, phone: '(555) 335-8847', email: 'ecaldwell@example.com' },
  { patientName: 'Naomi Sasaki', dateOfService: '03/05/2026', amount: 188.7, phone: '(555) 742-0165', email: 'nsasaki@example.com' },
  { patientName: 'Carlos Mendes', dateOfService: '02/27/2026', amount: 96.8, phone: '(555) 529-6631', email: 'cmendes@example.com' },
  { patientName: 'Rachel Adeyemi', dateOfService: '02/21/2026', amount: 233.5, phone: '(555) 814-9972', email: 'radeyemi@example.com' },
  { patientName: 'Peter Kovacs', dateOfService: '02/15/2026', amount: 141.05, phone: '(555) 607-2248', email: 'pkovacs@example.com' },
];

interface PatientInvoicingQueueProps {
  queueName: string;
  preInvoice: boolean;
}

export function PatientInvoicingQueue({ queueName, preInvoice }: PatientInvoicingQueueProps): ReactElement {
  const statusSet = preInvoice ? PRE_INVOICE_STATUSES : POST_INVOICE_STATUSES;

  const rows: PatientBalanceRow[] = useMemo(
    () =>
      BASE_PATIENTS.map((patient, idx) => ({
        ...patient,
        id: `${queueName}-${idx}`,
        // Post-invoice (aging) queues only hold unpaid balances.
        status: preInvoice ? statusSet[idx % statusSet.length] : 'Invoiced',
      })),
    [queueName, statusSet, preInvoice]
  );

  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceRow, setInvoiceRow] = useState<PatientBalanceRow | null>(null);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [textRow, setTextRow] = useState<PatientBalanceRow | null>(null);
  const [textMessage, setTextMessage] = useState('');

  const filteredRows = statusFilter ? rows.filter((row) => row.status === statusFilter) : rows;

  const openInvoiceDialog = (row: PatientBalanceRow): void => {
    setInvoiceAmount(row.amount.toFixed(2));
    setInvoiceNote('');
    setInvoiceRow(row);
  };

  const openTextDialog = (row: PatientBalanceRow): void => {
    setTextMessage(
      `Hi ${row.patientName.split(' ')[0]}, this is LedgEHR Billing. You have an outstanding balance of ${formatUsd(
        row.amount
      )} for your visit on ${row.dateOfService}.`
    );
    setTextRow(row);
  };

  const sendInvoice = (): void => {
    enqueueSnackbar(`Invoice for $${invoiceAmount} sent to ${invoiceRow?.patientName} (demo — nothing sent)`, {
      variant: 'success',
    });
    setInvoiceRow(null);
  };

  const sendText = (): void => {
    enqueueSnackbar(`Text sent to ${textRow?.patientName} (demo — nothing sent)`, { variant: 'success' });
    setTextRow(null);
  };

  const copyPhone = (row: PatientBalanceRow): void => {
    void navigator.clipboard
      .writeText(row.phone)
      .then(() => enqueueSnackbar(`${row.phone} copied to clipboard`, { variant: 'success' }));
  };

  return (
    <Box>
      <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
        <InputLabel>Status</InputLabel>
        <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {statusSet.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr" sx={{ '& th': { textAlign: 'left', py: 1, borderBottom: 1, borderColor: 'divider' } }}>
            <Box component="th" sx={{ width: '25%' }}>
              <Typography fontWeight={500} fontSize={14}>
                Patient Name
              </Typography>
            </Box>
            <Box component="th" sx={{ width: '15%' }}>
              <Typography fontWeight={500} fontSize={14}>
                Date of Service
              </Typography>
            </Box>
            <Box component="th" sx={{ width: '12%' }}>
              <Typography fontWeight={500} fontSize={14}>
                Amount
              </Typography>
            </Box>
            <Box component="th" sx={{ width: '18%' }}>
              <Typography fontWeight={500} fontSize={14}>
                Invoice Status
              </Typography>
            </Box>
            <Box component="th" sx={{ width: '30%', textAlign: 'right' }}>
              <Typography fontWeight={500} fontSize={14} sx={{ textAlign: 'right' }}>
                Actions
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box component="tbody">
          {filteredRows.map((row) => (
            <Box
              component="tr"
              key={row.id}
              sx={{ '& td': { py: 1.25, borderBottom: 1, borderColor: 'divider' } }}
            >
              <Box component="td">
                <Tooltip title={`${row.phone} · ${row.email}`}>
                  <Typography variant="body2" sx={{ textDecoration: 'underline', cursor: 'pointer', width: 'fit-content' }}>
                    {row.patientName}
                  </Typography>
                </Tooltip>
              </Box>
              <Box component="td">
                <Typography variant="body2">{row.dateOfService}</Typography>
              </Box>
              <Box component="td">
                <Typography variant="body2">{formatUsd(row.amount)}</Typography>
              </Box>
              <Box component="td">
                {row.status === 'Invoiced' ? (
                  // Invoiced balances are colored by their AR aging bucket, matching the bucket buttons.
                  <Tooltip title={`Aging ${agingBucketForDate(row.dateOfService).label} days`}>
                    <Chip
                      label={row.status}
                      size="small"
                      sx={{
                        borderRadius: '4px',
                        bgcolor: agingBucketForDate(row.dateOfService).color,
                        color: '#fff',
                      }}
                    />
                  </Tooltip>
                ) : (
                  <Chip label={row.status} size="small" color={STATUS_CHIP_COLOR[row.status]} sx={{ borderRadius: '4px' }} />
                )}
              </Box>
              <Box component="td" sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={row.status === 'Paid'}
                  onClick={() => openInvoiceDialog(row)}
                >
                  Invoice
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ ml: 1 }}
                  disabled={row.status === 'Paid'}
                  onClick={() =>
                    enqueueSnackbar(`Statement sent to ${row.patientName} (demo — nothing sent)`, {
                      variant: 'success',
                    })
                  }
                >
                  Statement
                </Button>
                <Tooltip title="Send SMS">
                  <IconButton
                    sx={{
                      ml: 1,
                      backgroundColor: 'primary.main',
                      width: 34,
                      height: 34,
                      '&:hover': { backgroundColor: 'primary.dark' },
                    }}
                    onClick={() => openTextDialog(row)}
                  >
                    <ChatIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Call ${row.phone} (click to copy)`}>
                  <IconButton
                    sx={{
                      ml: 1,
                      backgroundColor: 'primary.main',
                      width: 34,
                      height: 34,
                      '&:hover': { backgroundColor: 'primary.dark' },
                    }}
                    onClick={() => copyPhone(row)}
                  >
                    <PhoneIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      {filteredRows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          No patient balances match this filter.
        </Typography>
      )}

      {/* Send invoice dialog */}
      <Dialog open={!!invoiceRow} onClose={() => setInvoiceRow(null)} PaperProps={{ sx: { width: 480 } }}>
        <DialogTitle>Send Invoice</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            {invoiceRow?.patientName} · Service on {invoiceRow?.dateOfService}
          </Typography>
          <TextField
            label="Amount ($)"
            size="small"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
          />
          <TextField label="Send to Phone" size="small" defaultValue={invoiceRow?.phone} />
          <TextField label="Send to Email" size="small" defaultValue={invoiceRow?.email} />
          <TextField
            label="Note to Patient"
            size="small"
            multiline
            minRows={2}
            value={invoiceNote}
            onChange={(e) => setInvoiceNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInvoiceRow(null)}>Cancel</Button>
          <Button variant="contained" onClick={sendInvoice}>
            Send Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send text dialog */}
      <Dialog open={!!textRow} onClose={() => setTextRow(null)} PaperProps={{ sx: { width: 480 } }}>
        <DialogTitle>Text {textRow?.patientName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            To: {textRow?.phone}
          </Typography>
          <TextField
            label="Message"
            size="small"
            multiline
            minRows={3}
            value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTextRow(null)}>Cancel</Button>
          <Button variant="contained" onClick={sendText}>
            Send Text
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
