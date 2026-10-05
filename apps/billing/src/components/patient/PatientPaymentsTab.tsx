import { Add as AddIcon, Close as CloseIcon, Replay as ReplayIcon } from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  capitalize,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import { enqueueSnackbar } from 'notistack';
import { MouseEvent, ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { PAYMENT_REFUND_VOID_REASONS, PaymentRefundVoidReason } from 'utils/lib/types/api/patient-payment-types';
import { dataGridSlots, dataGridSx } from '../BillingDataGrid';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MockInvoice,
  MockInvoiceStatus,
  MockPayment,
  MockPaymentMethod,
} from './paymentsTabMock';

const EHR_URL = import.meta.env.VITE_APP_EHR_URL;

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number): string => usdFormatter.format(cents / 100);

// parse date parts directly — new Date(iso) treats date-only strings as UTC and can shift a day
const formatIsoDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
};

const localIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayIso = (): string => localIsoDate(new Date());
const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
};

const METHOD_LABELS: Record<MockPaymentMethod, string> = {
  card: 'Card',
  'card-reader': 'Card reader',
  'external-card-reader': 'External card reader',
  cash: 'Cash',
  check: 'Check',
  invoice: 'Invoice',
};

const INVOICE_STATUS_META: Record<
  MockInvoiceStatus,
  { label: string; color: 'info' | 'error' | 'success' | 'default' }
> = {
  open: { label: 'Open', color: 'info' },
  'past-due': { label: 'Past Due', color: 'error' },
  paid: { label: 'Paid', color: 'success' },
  void: { label: 'Void', color: 'default' },
};

const stopRowClick = (e: MouseEvent): void => e.stopPropagation();

function EhrVisitLink({ visit }: { visit?: { date: string; appointmentId: string } }): ReactElement {
  if (!visit) return <>—</>;
  if (!EHR_URL) return <>{formatIsoDate(visit.date)}</>;
  return (
    <Link
      href={`${EHR_URL}/visit/${visit.appointmentId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopRowClick}
    >
      {formatIsoDate(visit.date)}
    </Link>
  );
}

function ClaimLink({ claim }: { claim?: { date: string; claimId: string } }): ReactElement {
  if (!claim) return <>—</>;
  return (
    <Link component={RouterLink} to={`/claims/${claim.claimId}`} onClick={stopRowClick}>
      {formatIsoDate(claim.date)}
    </Link>
  );
}

function MethodCell({ payment }: { payment: MockPayment }): ReactElement {
  if (payment.cardLast4) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
        <Typography variant="body2">
          {METHOD_LABELS[payment.method]} — {capitalize(payment.cardBrand ?? 'Card')} •••• {payment.cardLast4}
        </Typography>
      </Box>
    );
  }
  return <Typography variant="body2">{METHOD_LABELS[payment.method]}</Typography>;
}

function RefundStateChip({ payment }: { payment: MockPayment }): ReactElement | null {
  if (payment.refundedAmountInCents <= 0) return null;
  const full = payment.refundedAmountInCents >= payment.amountInCents;
  return (
    <Chip
      label={full ? 'REFUNDED' : 'PARTIALLY REFUNDED'}
      size="small"
      sx={{
        ml: 1,
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.4px',
        height: 20,
        color: 'error.dark',
        backgroundColor: (theme) => alpha(theme.palette.error.light, 0.12),
      }}
    />
  );
}

const buttonSx = { fontWeight: 500, textTransform: 'none', borderRadius: 6 } as const;

// UI-only port of the EHR PaymentActionDialog refund flow — confirming only updates local mock state
function RefundDialog({
  payment,
  onClose,
  onRefund,
}: {
  payment: MockPayment;
  onClose: () => void;
  onRefund: (paymentId: string, amountInCents: number) => void;
}): ReactElement {
  const [reason, setReason] = useState<PaymentRefundVoidReason | ''>('');
  const [notes, setNotes] = useState('');
  const remainingCents = payment.amountInCents - payment.refundedAmountInCents;
  const [amountText, setAmountText] = useState((remainingCents / 100).toFixed(2));

  const parsedAmountCents = Math.round(Number(amountText) * 100);
  const amountValid =
    Number.isFinite(parsedAmountCents) && parsedAmountCents > 0 && parsedAmountCents <= remainingCents;
  const amountError =
    amountText.trim() !== '' && !amountValid
      ? `Enter an amount between $0.01 and ${formatCents(remainingCents)}`
      : undefined;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth sx={{ '.MuiPaper-root': { padding: 1 } }}>
      <IconButton aria-label="close" onClick={onClose} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark">
        Refund Payment
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Up to {formatCents(remainingCents)} can be refunded. This is a UI prototype — no money will move.
        </Typography>
        <TextField
          fullWidth
          required
          label="Refund amount"
          type="number"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={!!amountError}
          helperText={amountError}
          inputProps={{ min: 0.01, max: remainingCents / 100, step: 0.01 }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          sx={{ mb: 2, mt: 0.5 }}
        />
        <TextField
          select
          fullWidth
          required
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as PaymentRefundVoidReason)}
          sx={{ mb: 2, mt: 0.5 }}
        >
          {PAYMENT_REFUND_VOID_REASONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" sx={buttonSx} onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          color="error"
          sx={buttonSx}
          disabled={!reason || !amountValid}
          onClick={() => {
            onRefund(payment.id, parsedAmountCents);
            onClose();
          }}
        >
          Issue Refund
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const linkedRowSx = {
  '& .MuiDataGrid-row.linked-row, & .MuiDataGrid-row.linked-row:hover': {
    bgcolor: (theme: { palette: { primary: { main: string } } }) => alpha(theme.palette.primary.main, 0.08),
  },
  '& .MuiDataGrid-row.selected-row, & .MuiDataGrid-row.selected-row:hover': {
    bgcolor: (theme: { palette: { primary: { main: string } } }) => alpha(theme.palette.primary.main, 0.14),
  },
} as const;

type AddPaymentMethod = 'card' | 'card-reader' | 'cash' | 'check';

export interface AddPaymentInput {
  amountInCents: number;
  method: AddPaymentMethod;
  cardBrand?: string;
  cardLast4?: string;
}

const MOCK_CARDS_ON_FILE = [
  { id: 'pm_mock_visa', brand: 'visa', last4: '4242' },
  { id: 'pm_mock_mastercard', brand: 'mastercard', last4: '5100' },
];

// card details a simulated terminal payment reports back
const MOCK_TERMINAL_CARD = { brand: 'visa', last4: '9876' };

// UI-only port of the EHR visit-details PaymentDialog — confirming only updates local mock state
function AddPaymentDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: AddPaymentInput) => void;
}): ReactElement {
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<AddPaymentMethod>('card');
  const [cardId, setCardId] = useState(MOCK_CARDS_ON_FILE[0].id);

  const parsedAmountCents = Math.round(Number(amountText) * 100);
  const amountValid = Number.isFinite(parsedAmountCents) && parsedAmountCents > 0;
  const amountError = amountText.trim() !== '' && !amountValid ? 'Amount must be greater than 0' : undefined;

  const submitLabel = method === 'card' || method === 'card-reader' ? 'Process Payment' : 'Record Payment';

  const handleSubmit = (): void => {
    const card =
      method === 'card'
        ? MOCK_CARDS_ON_FILE.find((c) => c.id === cardId)
        : method === 'card-reader'
        ? MOCK_TERMINAL_CARD
        : undefined;
    onAdd({
      amountInCents: parsedAmountCents,
      method,
      cardBrand: card?.brand,
      cardLast4: card?.last4,
    });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth sx={{ '.MuiPaper-root': { padding: 1 } }}>
      <IconButton aria-label="close" onClick={onClose} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark">
        Payment
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          required
          label="Amount"
          type="number"
          placeholder="Enter amount in dollars"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={!!amountError}
          helperText={amountError}
          inputProps={{ min: 0.01, step: 0.01 }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          sx={{ mb: 2, mt: 0.5 }}
        />
        <FormControl fullWidth required sx={{ mb: 1 }}>
          <InputLabel shrink sx={{ position: 'relative', transform: 'none', fontSize: 13, mb: 0.5 }}>
            Payment method
          </InputLabel>
          <RadioGroup row value={method} onChange={(e) => setMethod(e.target.value as AddPaymentMethod)}>
            <FormControlLabel value="card" control={<Radio />} label="Card" />
            <FormControlLabel value="card-reader" control={<Radio />} label="Card Reader" />
            <FormControlLabel value="cash" control={<Radio />} label="Cash" />
            <FormControlLabel value="check" control={<Radio />} label="Check" />
          </RadioGroup>
        </FormControl>
        {method === 'card' && (
          <TextField
            select
            fullWidth
            required
            label="Credit card"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            sx={{ mt: 1 }}
          >
            {MOCK_CARDS_ON_FILE.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CreditCardBrandIcon brand={card.brand} />
                  {capitalize(card.brand)} •••• {card.last4}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        )}
        {method === 'card-reader' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Prototype: the terminal flow is simulated — the payment will be recorded as a terminal payment on{' '}
            {capitalize(MOCK_TERMINAL_CARD.brand)} •••• {MOCK_TERMINAL_CARD.last4}.
          </Typography>
        )}
        {(method === 'cash' || method === 'check') && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Collect the {method} from the patient directly — this only records the payment.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" sx={buttonSx} onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" sx={buttonSx} disabled={!amountValid} onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface IssueInvoiceInput {
  amountInCents: number;
  dueDate: string;
}

const DEFAULT_INVOICE_SMS =
  'Hi [Patient Name], you have a new invoice from [Clinic] for [Amount], due [Due Date]. Pay online: [Invoice Link]';
const DEFAULT_INVOICE_MEMO = 'Patient responsibility for visit on [Visit Date].';

// UI-only port of the EHR invoicing report's SendInvoiceToPatientDialog
function IssueInvoiceDialog({
  onClose,
  onIssue,
}: {
  onClose: () => void;
  onIssue: (input: IssueInvoiceInput) => void;
}): ReactElement {
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState(() => isoDaysFromNow(30));
  const [smsMessage, setSmsMessage] = useState(DEFAULT_INVOICE_SMS);
  const [memo, setMemo] = useState(DEFAULT_INVOICE_MEMO);

  const parsedAmountCents = Math.round(Number(amountText) * 100);
  const amountValid = Number.isFinite(parsedAmountCents) && parsedAmountCents > 0;
  const amountError = amountText.trim() !== '' && !amountValid ? 'Amount must be greater than 0' : undefined;
  const dueDateValid = dueDate > todayIso();
  const dueDateError = dueDate && !dueDateValid ? 'Invoice Due Date must be in the future' : undefined;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth sx={{ '.MuiPaper-root': { padding: 1 } }}>
      <IconButton aria-label="close" onClick={onClose} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark">
        Issue Invoice
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 0.5 }}>
          <TextField
            fullWidth
            required
            label="Amount, $"
            type="number"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            error={!!amountError}
            helperText={amountError}
            inputProps={{ min: 0.01, step: 0.01 }}
          />
          <TextField
            fullWidth
            required
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={!!dueDateError}
            helperText={dueDateError}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: isoDaysFromNow(1) }}
          />
        </Box>
        <TextField
          fullWidth
          required
          multiline
          minRows={2}
          label="SMS message"
          value={smsMessage}
          onChange={(e) => setSmsMessage(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          required
          multiline
          minRows={2}
          label="Invoice memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Prototype: no invoice is created in Stripe and no SMS is sent.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" sx={buttonSx} onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          sx={buttonSx}
          disabled={!amountValid || !dueDateValid || !smsMessage.trim() || !memo.trim()}
          onClick={() => {
            onIssue({ amountInCents: parsedAmountCents, dueDate });
            onClose();
          }}
        >
          Send Invoice
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PatientPaymentsTab(): ReactElement {
  const [payments, setPayments] = useState<MockPayment[]>(MOCK_PAYMENTS);
  const [invoices, setInvoices] = useState<MockInvoice[]>(MOCK_INVOICES);

  const [hoveredPaymentId, setHoveredPaymentId] = useState<string | null>(null);
  const [hoveredInvoiceId, setHoveredInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<MockPayment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MockInvoice | null>(null);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [issueInvoiceOpen, setIssueInvoiceOpen] = useState(false);

  const invoiceIdByPaymentId = useMemo(() => {
    const map = new Map<string, string>();
    payments.forEach((p) => p.invoiceId && map.set(p.id, p.invoiceId));
    invoices.forEach((inv) => inv.paymentId && map.set(inv.paymentId, inv.id));
    return map;
  }, [payments, invoices]);
  const paymentIdByInvoiceId = useMemo(() => {
    const map = new Map<string, string>();
    invoiceIdByPaymentId.forEach((invId, payId) => map.set(invId, payId));
    return map;
  }, [invoiceIdByPaymentId]);

  const activePaymentId = hoveredPaymentId ?? selectedPaymentId;
  const activeInvoiceId = hoveredInvoiceId ?? selectedInvoiceId;
  // row linked to the active row in the OTHER table
  const linkedInvoiceId = activePaymentId ? invoiceIdByPaymentId.get(activePaymentId) ?? null : null;
  const linkedPaymentId = activeInvoiceId ? paymentIdByInvoiceId.get(activeInvoiceId) ?? null : null;

  const handleRefund = (paymentId: string, amountInCents: number): void => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, refundedAmountInCents: p.refundedAmountInCents + amountInCents } : p
      )
    );
    enqueueSnackbar(`Refund of ${formatCents(amountInCents)} recorded (prototype — nothing was charged back)`, {
      variant: 'success',
    });
  };

  const handleCancelInvoice = (invoiceId: string): void => {
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'void' as const } : inv)));
    enqueueSnackbar('Invoice voided (prototype — nothing was voided in Stripe)', { variant: 'success' });
  };

  const handleAddPayment = (input: AddPaymentInput): void => {
    setPayments((prev) => [
      {
        id: `pay-new-${Date.now()}`,
        paymentDate: todayIso(),
        amountInCents: input.amountInCents,
        method: input.method,
        cardBrand: input.cardBrand,
        cardLast4: input.cardLast4,
        refundedAmountInCents: 0,
      },
      ...prev,
    ]);
    enqueueSnackbar(`Payment of ${formatCents(input.amountInCents)} recorded (prototype — nothing was charged)`, {
      variant: 'success',
    });
  };

  const handleIssueInvoice = (input: IssueInvoiceInput): void => {
    setInvoices((prev) => [
      {
        id: `inv-new-${Date.now()}`,
        invoiceDate: todayIso(),
        dueDate: input.dueDate,
        amountInCents: input.amountInCents,
        status: 'open' as const,
      },
      ...prev,
    ]);
    enqueueSnackbar(`Invoice for ${formatCents(input.amountInCents)} issued (prototype — no SMS was sent)`, {
      variant: 'success',
    });
  };

  const paymentColumns: GridColDef<MockPayment>[] = [
    {
      field: 'paymentDate',
      headerName: 'Payment Date',
      width: 130,
      valueFormatter: (params: { value: string }) => formatIsoDate(params.value),
    },
    {
      field: 'amountInCents',
      headerName: 'Amount',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<MockPayment>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
          {formatCents(params.row.amountInCents)}
          <RefundStateChip payment={params.row} />
        </Box>
      ),
    },
    {
      field: 'encounter',
      headerName: 'Encounter',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<MockPayment>) => <EhrVisitLink visit={params.row.encounter} />,
    },
    {
      field: 'claim',
      headerName: 'Claim',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<MockPayment>) => <ClaimLink claim={params.row.claim} />,
    },
    {
      field: 'method',
      headerName: 'Method',
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (params: GridRenderCellParams<MockPayment>) => <MethodCell payment={params.row} />,
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<MockPayment>) => {
        const remaining = params.row.amountInCents - params.row.refundedAmountInCents;
        return (
          <Tooltip title={remaining > 0 ? 'Refund' : 'Fully refunded'}>
            <span>
              <IconButton
                size="small"
                aria-label="refund"
                disabled={remaining <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setRefundTarget(params.row);
                }}
              >
                <ReplayIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const invoiceColumns: GridColDef<MockInvoice>[] = [
    {
      field: 'invoiceDate',
      headerName: 'Invoice Date',
      width: 130,
      valueFormatter: (params: { value: string }) => formatIsoDate(params.value),
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 120,
      valueFormatter: (params: { value: string }) => formatIsoDate(params.value),
    },
    {
      field: 'amountInCents',
      headerName: 'Amount',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: { value: number }) => formatCents(params.value),
    },
    {
      field: 'visit',
      headerName: 'Visit',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<MockInvoice>) => <EhrVisitLink visit={params.row.visit} />,
    },
    {
      field: 'claim',
      headerName: 'Claim',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<MockInvoice>) => <ClaimLink claim={params.row.claim} />,
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<MockInvoice>) => {
        const meta = INVOICE_STATUS_META[params.row.status];
        const linkedPayment = params.row.paymentId ? payments.find((p) => p.id === params.row.paymentId) : undefined;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip
              label={meta.label}
              color={meta.color}
              variant="outlined"
              size="small"
              sx={{ borderRadius: '4px', fontSize: 12 }}
            />
            {linkedPayment && <RefundStateChip payment={linkedPayment} />}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<MockInvoice>) => {
        const voidable = params.row.status === 'open' || params.row.status === 'past-due';
        if (!voidable) return <></>;
        return (
          <Tooltip title="Void invoice">
            <IconButton
              size="small"
              aria-label="void invoice"
              onClick={(e) => {
                e.stopPropagation();
                setCancelTarget(params.row);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  const rowIdOf = (e: MouseEvent<HTMLDivElement>): string | null => e.currentTarget.getAttribute('data-id');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Payments
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAddPaymentOpen(true)}>
          Add payment
        </Button>
      </Box>
      <DataGridPro
        rows={payments}
        columns={paymentColumns}
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        hideFooter
        onRowClick={(params) => {
          setSelectedInvoiceId(null);
          setSelectedPaymentId((prev) => (prev === params.id ? null : String(params.id)));
        }}
        getRowClassName={(params) =>
          params.id === selectedPaymentId ? 'selected-row' : params.id === linkedPaymentId ? 'linked-row' : ''
        }
        slotProps={{
          row: {
            onMouseEnter: (e) => setHoveredPaymentId(rowIdOf(e)),
            onMouseLeave: () => setHoveredPaymentId(null),
          },
        }}
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, ...linkedRowSx, mb: 3 }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Invoices
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIssueInvoiceOpen(true)}>
          Issue invoice
        </Button>
      </Box>
      <DataGridPro
        rows={invoices}
        columns={invoiceColumns}
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        hideFooter
        onRowClick={(params) => {
          setSelectedPaymentId(null);
          setSelectedInvoiceId((prev) => (prev === params.id ? null : String(params.id)));
        }}
        getRowClassName={(params) =>
          params.id === selectedInvoiceId ? 'selected-row' : params.id === linkedInvoiceId ? 'linked-row' : ''
        }
        slotProps={{
          row: {
            onMouseEnter: (e) => setHoveredInvoiceId(rowIdOf(e)),
            onMouseLeave: () => setHoveredInvoiceId(null),
          },
        }}
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, ...linkedRowSx }}
      />

      {refundTarget && (
        <RefundDialog payment={refundTarget} onClose={() => setRefundTarget(null)} onRefund={handleRefund} />
      )}
      {addPaymentOpen && <AddPaymentDialog onClose={() => setAddPaymentOpen(false)} onAdd={handleAddPayment} />}
      {issueInvoiceOpen && (
        <IssueInvoiceDialog onClose={() => setIssueInvoiceOpen(false)} onIssue={handleIssueInvoice} />
      )}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Void invoice?"
        confirmLabel="Void Invoice"
        cancelLabel="Keep Invoice"
        confirmColor="error"
        onConfirm={() => {
          if (cancelTarget) handleCancelInvoice(cancelTarget.id);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      >
        {cancelTarget
          ? `The ${formatCents(cancelTarget.amountInCents)} invoice from ${formatIsoDate(
              cancelTarget.invoiceDate
            )} will be voided and the patient will no longer be able to pay it.`
          : ''}
      </ConfirmDialog>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Prototype data — payments and invoices shown here are mocked and actions do not persist.
      </Typography>
    </Box>
  );
}
