import {
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  DocumentScanner as DocumentScannerIcon,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { otherColors } from 'utils/lib/theme/billing-palette';
import {
  AR_STAGE,
  CLAIM_STATUS_FIELDS_BY_KEY,
  formatClaimStatusValue,
} from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { claimStatusValueColor } from '../../constants/claimStatus';
import { downloadTextFile } from '../../utils/downloadFile';
import { Row } from '../Row';

// =====================================================================================
// UI-only prototype: E-Pay / card-on-file payment setup plus Uninvoiced Claims and
// Invoices tabs for a non-insurance organization. All data is local test data.
// =====================================================================================

type DeliveryMethod = 'mail' | 'email' | 'fax' | 'epay' | 'portal';

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  mail: 'Mail',
  email: 'Email',
  fax: 'Fax',
  epay: 'E-Pay',
  portal: 'Portal',
};

// Mirrors the patient-outreach medium chip colors (EHR otherColors.outreachMedium*).
const DELIVERY_CHIP_COLORS: Record<DeliveryMethod, string> = {
  mail: '#4E342E',
  email: '#0277BD',
  fax: '#6A1B9A',
  epay: '#43A047',
  portal: '#00838F',
};

type PaidStatus = 'open' | 'past-due' | 'paid' | 'void';

const PAID_STATUS_META: Record<PaidStatus, { label: string; color: 'warning' | 'error' | 'success' | 'default' }> = {
  open: { label: 'Open', color: 'warning' },
  'past-due': { label: 'Past due', color: 'error' },
  paid: { label: 'Paid', color: 'success' },
  void: { label: 'Void', color: 'default' },
};

interface ProtoClaim {
  id: string;
  patientName: string;
  serviceDate: string;
  status: string; // nonInsuranceArStatus code
  amount: number;
}

interface ProtoPayment {
  date: string;
  method: string;
  reference: string;
  amount: number;
  documentName?: string;
}

interface ProtoInvoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  dueDate: string;
  // method -> sent date; a method absent here was not used
  delivery: Partial<Record<DeliveryMethod, string>>;
  paidStatus: PaidStatus;
  payments: ProtoPayment[];
  claims: ProtoClaim[];
  voidedAt?: string;
  voidNotice?: string;
}

const UNINVOICED_CLAIMS: ProtoClaim[] = [
  {
    id: 'demo-nio-1',
    patientName: 'Jordan Pruitt',
    serviceDate: '2026-09-14',
    status: 'ready-to-invoice',
    amount: 180,
  },
  { id: 'demo-nio-2', patientName: 'Maya Collins', serviceDate: '2026-09-18', status: 'ready-to-invoice', amount: 95 },
  { id: 'demo-nio-3', patientName: 'Leo Marsh', serviceDate: '2026-09-21', status: 'created', amount: 140 },
  { id: 'demo-nio-4', patientName: 'Priya Natarajan', serviceDate: '2026-09-25', status: 'created', amount: 95 },
];

const INITIAL_INVOICES: ProtoInvoice[] = [
  {
    id: 'inv-1',
    number: 'INV-20260901-0042',
    date: '2026-09-01',
    amount: 460,
    dueDate: '2026-10-01',
    delivery: { mail: '2026-09-01', email: '2026-09-01' },
    paidStatus: 'paid',
    payments: [
      { date: '2026-09-19', method: 'Check', reference: '#88123', amount: 460, documentName: 'check-88123-scan.pdf' },
    ],
    claims: [
      { id: 'demo-inv1-1', patientName: 'Sam Whitaker', serviceDate: '2026-08-04', status: 'finalized', amount: 180 },
      { id: 'demo-inv1-2', patientName: 'Elena Ford', serviceDate: '2026-08-11', status: 'finalized', amount: 140 },
      { id: 'demo-inv1-3', patientName: 'Noah Briggs', serviceDate: '2026-08-15', status: 'finalized', amount: 140 },
    ],
  },
  {
    id: 'inv-2',
    number: 'INV-20260915-0057',
    date: '2026-09-15',
    amount: 275,
    dueDate: '2026-10-15',
    delivery: { email: '2026-09-15', epay: '2026-09-15' },
    paidStatus: 'open',
    payments: [],
    claims: [
      { id: 'demo-inv2-1', patientName: 'Ava Romero', serviceDate: '2026-09-02', status: 'invoiced', amount: 180 },
      { id: 'demo-inv2-2', patientName: 'Miles Dunn', serviceDate: '2026-09-05', status: 'invoiced', amount: 95 },
    ],
  },
  {
    id: 'inv-3',
    number: 'INV-20260801-0031',
    date: '2026-08-01',
    amount: 320,
    dueDate: '2026-08-31',
    delivery: { mail: '2026-08-01' },
    paidStatus: 'past-due',
    payments: [],
    claims: [
      { id: 'demo-inv3-1', patientName: 'Tess Okafor', serviceDate: '2026-07-08', status: 'invoiced', amount: 180 },
      { id: 'demo-inv3-2', patientName: 'Ray Lindqvist', serviceDate: '2026-07-16', status: 'invoiced', amount: 140 },
    ],
  },
];

const EPAY_EMAILS = ['payments@acmehealth.example.com'];
const CARD_ON_FILE = { brand: 'Visa', last4: '4242', exp: '08/2028' };

const fmtDate = (iso: string): string => DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED);
const balanceOf = (invoice: ProtoInvoice): number =>
  invoice.amount - invoice.payments.reduce((sum, p) => sum + p.amount, 0);

const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' };

function statusChip(code: string): ReactElement {
  return (
    <Chip
      label={formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.nonInsuranceArStatus, code)}
      color={claimStatusValueColor(code)}
      variant="outlined"
      size="small"
      sx={{ borderRadius: '4px', fontSize: 12 }}
    />
  );
}

function stageChip(): ReactElement {
  return (
    <Chip
      label={formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, AR_STAGE.nonInsurancePayer)}
      color={claimStatusValueColor(AR_STAGE.nonInsurancePayer)}
      variant="outlined"
      size="small"
      sx={{ borderRadius: '4px', fontSize: 12 }}
    />
  );
}

// Same card-on-file indicator styling as the patient payments screen.
function CardOnFileIndicator({ hasCard, onClick }: { hasCard: boolean; onClick?: () => void }): ReactElement {
  const stroke = hasCard ? '#2E7D32' : '#8A1538';
  const fill = hasCard ? '#E8F5E9' : '#FBE9E7';
  return (
    <Tooltip
      title={
        <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.3px',
              color: stroke,
              backgroundColor: hasCard ? '#C8E6C9' : '#FFCDD2',
            }}
          >
            {hasCard ? 'ON FILE' : 'NO CARD'}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {hasCard ? 'Credit card on file' : 'No card on file'}
          </Typography>
        </Box>
      }
    >
      <Box
        component={onClick ? ButtonBase : 'div'}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          ...(onClick && { borderRadius: 1, '&:hover': { opacity: 0.75 } }),
        }}
        aria-label={hasCard ? 'card on file' : 'no card on file'}
        onClick={onClick}
      >
        <svg width="38" height="38" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="12" width="36" height="30" rx="5" fill={fill} stroke={stroke} strokeWidth="2" />
          <rect x="15" y="18" width="26" height="5" rx="1" fill={stroke} opacity="0.7" />
          <rect x="15" y="27" width="12" height="4" rx="1" fill={stroke} opacity="0.45" />
          {hasCard ? (
            <path
              d="M31 31L34.5 34.5L41 28"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <>
              <path d="M32 28L40 36" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
              <path d="M40 28L32 36" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </Box>
    </Tooltip>
  );
}

function ClaimsTable({ claims }: { claims: ProtoClaim[] }): ReactElement {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={thSx}>Patient</TableCell>
          <TableCell sx={thSx}>Date of Service</TableCell>
          <TableCell sx={thSx}>Stage</TableCell>
          <TableCell sx={thSx}>Status</TableCell>
          <TableCell sx={{ ...thSx, textAlign: 'right' }}>Amount</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {claims.map((claim) => (
          <TableRow key={claim.id}>
            <TableCell>{claim.patientName}</TableCell>
            <TableCell>{fmtDate(claim.serviceDate)}</TableCell>
            <TableCell>{stageChip()}</TableCell>
            <TableCell>{statusChip(claim.status)}</TableCell>
            <TableCell align="right">{formatCurrency(claim.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeliveryChips({ invoice }: { invoice: ProtoInvoice }): ReactElement {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {(Object.keys(DELIVERY_LABELS) as DeliveryMethod[])
        .filter((method) => invoice.delivery[method])
        .map((method) => (
          <Tooltip key={method} title={`Sent ${fmtDate(invoice.delivery[method] as string)}`}>
            <Chip
              label={DELIVERY_LABELS[method]}
              size="small"
              variant="outlined"
              sx={{
                borderRadius: '4px',
                fontSize: 12,
                fontWeight: 500,
                bgcolor: 'background.paper',
                color: DELIVERY_CHIP_COLORS[method],
                borderColor: DELIVERY_CHIP_COLORS[method],
              }}
            />
          </Tooltip>
        ))}
    </Box>
  );
}

// Hidden file input behind a button.
function UploadDocumentButton({ onAttach }: { onAttach: (fileName: string) => void }): ReactElement {
  return (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />}>
      Upload
      <input
        type="file"
        hidden
        accept="application/pdf,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAttach(file.name);
          e.target.value = '';
        }}
      />
    </Button>
  );
}

// Prototype: "scanning" produces a timestamped document immediately.
function ScanDocumentButton({ onAttach }: { onAttach: (fileName: string) => void }): ReactElement {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<DocumentScannerIcon />}
      onClick={() => onAttach(`scan-${DateTime.now().toFormat('yyyyLLdd-HHmmss')}.pdf`)}
    >
      Scan
    </Button>
  );
}

function AttachDocumentButtons({ onAttach }: { onAttach: (fileName: string) => void }): ReactElement {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <UploadDocumentButton onAttach={onAttach} />
      <ScanDocumentButton onAttach={onAttach} />
    </Box>
  );
}

function PaidStatusChip({ status }: { status: PaidStatus }): ReactElement {
  const meta = PAID_STATUS_META[status];
  return (
    <Chip
      label={meta.label}
      color={meta.color}
      variant="outlined"
      size="small"
      sx={{ borderRadius: '4px', fontSize: 12 }}
    />
  );
}

interface PaymentDraft {
  date: string;
  amount: string;
  method: string;
  reference: string;
  documentName: string;
}

function RecordPaymentDialog({
  open,
  balance,
  onClose,
  onSave,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
  onSave: (payment: ProtoPayment) => void;
}): ReactElement {
  const [draft, setDraft] = useState<PaymentDraft>({
    date: DateTime.now().toISODate() ?? '',
    amount: String(balance),
    method: 'Check',
    reference: '',
    documentName: '',
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record a payment</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField
          label="Payment date"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
        <TextField
          label="Amount"
          type="number"
          size="small"
          fullWidth
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
        />
        <TextField
          label="Method"
          select
          size="small"
          fullWidth
          value={draft.method}
          onChange={(e) => setDraft({ ...draft, method: e.target.value })}
        >
          {['Check', 'ACH', 'Wire', 'Cash', 'Other'].map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Reference #"
          size="small"
          fullWidth
          value={draft.reference}
          onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
        />
        {draft.documentName ? (
          <Chip
            icon={<AttachFileIcon />}
            label={draft.documentName}
            size="small"
            variant="outlined"
            onDelete={() => setDraft({ ...draft, documentName: '' })}
            sx={{ alignSelf: 'flex-start' }}
          />
        ) : (
          <Box sx={{ alignSelf: 'flex-start' }}>
            <AttachDocumentButtons onAttach={(name) => setDraft({ ...draft, documentName: name })} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() =>
            onSave({
              date: draft.date,
              method: draft.method,
              reference: draft.reference || '—',
              amount: Number(draft.amount) || 0,
              ...(draft.documentName && { documentName: draft.documentName }),
            })
          }
        >
          Record payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CollectCardPaymentDialog({
  open,
  balance,
  hasCard,
  onClose,
  onCharge,
}: {
  open: boolean;
  balance: number;
  hasCard: boolean;
  onClose: () => void;
  onCharge: (amount: number) => void;
}): ReactElement {
  const [amount, setAmount] = useState(String(balance));
  const [cardNumber, setCardNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Collect credit card payment</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {hasCard ? (
          <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CardOnFileIndicator hasCard />
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {CARD_ON_FILE.brand} •••• {CARD_ON_FILE.last4}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Card on file · expires {CARD_ON_FILE.exp}
              </Typography>
            </Box>
          </Paper>
        ) : (
          <>
            <TextField
              label="Card number"
              size="small"
              fullWidth
              placeholder="1234 1234 1234 1234"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="MM/YY" size="small" value={exp} onChange={(e) => setExp(e.target.value)} />
              <TextField label="CVC" size="small" value={cvc} onChange={(e) => setCvc(e.target.value)} />
            </Box>
          </>
        )}
        <TextField
          label="Amount"
          type="number"
          size="small"
          fullWidth
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onCharge(Number(amount) || 0)}>
          Charge {formatCurrency(Number(amount) || 0)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface VoidOptions {
  notifyMethods: DeliveryMethod[];
  reason: string;
}

function VoidInvoiceDialog({
  invoice,
  onClose,
  onVoid,
}: {
  invoice: ProtoInvoice;
  onClose: () => void;
  onVoid: (options: VoidOptions) => void;
}): ReactElement {
  // Notification methods mirror the invoice-generation delivery methods, all off by default.
  const [notifyMethods, setNotifyMethods] = useState<DeliveryMethod[]>([]);
  const [reason, setReason] = useState('');

  const toggleMethod = (method: DeliveryMethod, checked: boolean): void =>
    setNotifyMethods((prev) => (checked ? [...prev, method] : prev.filter((m) => m !== method)));

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Void invoice</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Typography variant="body2">
          Are you sure you want to void invoice {invoice.number} for {formatCurrency(invoice.amount)}? A voided invoice
          can no longer be paid.
        </Typography>
        <TextField
          label="Reason"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Typography variant="overline" color="text.secondary">
          Notify the recipient
        </Typography>
        <FormGroup row sx={{ mt: -1 }}>
          {(Object.keys(DELIVERY_LABELS) as DeliveryMethod[]).map((method) => (
            <FormControlLabel
              key={method}
              control={
                <Checkbox
                  size="small"
                  checked={notifyMethods.includes(method)}
                  onChange={(_, checked) => toggleMethod(method, checked)}
                />
              }
              label={DELIVERY_LABELS[method]}
              slotProps={{ typography: { variant: 'body2' } }}
              sx={{ mr: 1.5 }}
            />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => onVoid({ notifyMethods, reason })}>
          Yes, void
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function invoiceText(nioName: string, invoice: ProtoInvoice): string {
  const lines = [
    `INVOICE ${invoice.number}`,
    `Bill to: ${nioName}`,
    `Issue date: ${invoice.date}  Due date: ${invoice.dueDate}`,
    '',
    ...invoice.claims.map((c) => `${c.serviceDate}  ${c.patientName}  ${formatCurrency(c.amount)}`),
    '',
    `Total due: ${formatCurrency(invoice.amount)}`,
  ];
  return lines.join('\n');
}

export function NioInvoicingPrototype({ nioName }: { nioName: string }): ReactElement {
  const [tab, setTab] = useState(0);
  const [invoices, setInvoices] = useState<ProtoInvoice[]>(INITIAL_INVOICES);
  const [hasCard, setHasCard] = useState(true);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [collectingCard, setCollectingCard] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const openInvoice = useMemo(() => invoices.find((i) => i.id === openInvoiceId) ?? null, [invoices, openInvoiceId]);

  const applyPayment = (payment: ProtoPayment): void => {
    if (!openInvoice) return;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== openInvoice.id) return inv;
        const payments = [...inv.payments, payment];
        const paid = inv.amount - payments.reduce((sum, p) => sum + p.amount, 0) <= 0;
        return { ...inv, payments, paidStatus: paid ? 'paid' : inv.paidStatus };
      })
    );
    enqueueSnackbar(`Payment of ${formatCurrency(payment.amount)} recorded.`, { variant: 'success' });
    setRecordingPayment(false);
    setCollectingCard(false);
  };

  const attachDocument = (paymentIndex: number, fileName: string): void => {
    if (!openInvoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === openInvoice.id
          ? {
              ...inv,
              payments: inv.payments.map((p, i) => (i === paymentIndex ? { ...p, documentName: fileName } : p)),
            }
          : inv
      )
    );
    enqueueSnackbar(`${fileName} attached.`, { variant: 'success' });
  };

  const applyVoid = ({ notifyMethods, reason }: VoidOptions): void => {
    if (!openInvoice) return;
    const noticeSummary = notifyMethods.length
      ? `notification sent by ${notifyMethods.map((method) => DELIVERY_LABELS[method]).join(', ')}`
      : 'no notification';
    const voidNotice = [reason.trim(), noticeSummary].filter(Boolean).join(' · ');
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === openInvoice.id
          ? { ...inv, paidStatus: 'void', voidedAt: DateTime.now().toISODate() ?? '', voidNotice }
          : inv
      )
    );
    enqueueSnackbar(`Invoice ${openInvoice.number} voided — ${noticeSummary}.`, { variant: 'success' });
    setVoiding(false);
  };

  const sectionTitleSx = { color: 'primary.dark', fontWeight: 600 };

  const deliveryDetail = (invoice: ProtoInvoice): ReactNode =>
    (Object.keys(DELIVERY_LABELS) as DeliveryMethod[])
      .filter((method) => invoice.delivery[method])
      .map((method) => (
        <Row
          key={method}
          label={DELIVERY_LABELS[method]}
          value={`Sent ${fmtDate(invoice.delivery[method] as string)}`}
        />
      ));

  return (
    <Box sx={{ mt: 3 }}>
      {/* Payment setup (prototype) */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Typography variant="h6" sx={sectionTitleSx}>
            Payment Setup
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <CardOnFileIndicator
            hasCard={hasCard}
            onClick={() => {
              setHasCard(!hasCard);
              enqueueSnackbar(hasCard ? 'Card on file removed.' : 'Card saved on file.', {
                variant: 'info',
              });
            }}
          />
        </Box>
        <Row label="E-Pay" value={`Enabled — payment links sent to ${EPAY_EMAILS.join(', ')}`} />
        <Row
          label="Card on file"
          value={hasCard ? `${CARD_ON_FILE.brand} •••• ${CARD_ON_FILE.last4} · expires ${CARD_ON_FILE.exp}` : 'None'}
          hideBorder
        />
      </Paper>

      {/* Claims / invoices tabs */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Uninvoiced Claims (${UNINVOICED_CLAIMS.length})`} />
          <Tab label={`Invoices (${invoices.length})`} />
        </Tabs>

        {tab === 0 && <ClaimsTable claims={UNINVOICED_CLAIMS} />}

        {tab === 1 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Invoice #</TableCell>
                <TableCell sx={thSx}>Date</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'right' }}>Amount</TableCell>
                <TableCell sx={thSx}>Due Date</TableCell>
                <TableCell sx={thSx}>Delivery</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setOpenInvoiceId(invoice.id)}
                >
                  <TableCell>{invoice.number}</TableCell>
                  <TableCell>{fmtDate(invoice.date)}</TableCell>
                  <TableCell align="right">{formatCurrency(invoice.amount)}</TableCell>
                  <TableCell>{fmtDate(invoice.dueDate)}</TableCell>
                  <TableCell>
                    <DeliveryChips invoice={invoice} />
                  </TableCell>
                  <TableCell>
                    <PaidStatusChip status={invoice.paidStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Invoice drawer */}
      <Drawer anchor="right" open={!!openInvoice} onClose={() => setOpenInvoiceId(null)}>
        {openInvoice && (
          <Box sx={{ width: 720, maxWidth: '95vw', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Typography variant="h5" sx={sectionTitleSx}>
                {openInvoice.number}
              </Typography>
              <PaidStatusChip status={openInvoice.paidStatus} />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton onClick={() => setOpenInvoiceId(null)} size="small" aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Box>

            <Row label="Billed to" value={nioName} />
            <Row label="Issue date" value={fmtDate(openInvoice.date)} />
            <Row label="Due date" value={fmtDate(openInvoice.dueDate)} />
            <Row label="Amount" value={formatCurrency(openInvoice.amount)} />
            <Row
              label="Balance"
              value={formatCurrency(Math.max(balanceOf(openInvoice), 0))}
              hideBorder={!openInvoice.voidedAt}
            />
            {openInvoice.voidedAt && (
              <Row
                label="Voided"
                value={`${fmtDate(openInvoice.voidedAt)} — ${openInvoice.voidNotice ?? ''}`}
                hideBorder
              />
            )}

            <Typography variant="h6" sx={{ ...sectionTitleSx, mt: 3, mb: 1 }}>
              Delivery
            </Typography>
            {deliveryDetail(openInvoice)}

            <Typography variant="h6" sx={{ ...sectionTitleSx, mt: 3, mb: 1 }}>
              Payments
            </Typography>
            {openInvoice.payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No payments recorded.
              </Typography>
            ) : (
              openInvoice.payments.map((payment, index) => (
                <Box
                  key={`${payment.date}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.75,
                    borderBottom:
                      index === openInvoice.payments.length - 1 ? '' : `1px solid ${otherColors.lightDivider}`,
                  }}
                >
                  <Typography variant="body2" color="primary.dark" sx={{ width: 180, flexShrink: 0 }}>
                    {fmtDate(payment.date)}
                  </Typography>
                  <Typography variant="body2">
                    {payment.method} {payment.reference} — {formatCurrency(payment.amount)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  {payment.documentName ? (
                    <Chip
                      icon={<AttachFileIcon />}
                      label={payment.documentName}
                      size="small"
                      variant="outlined"
                      onClick={() => enqueueSnackbar(`Opening ${payment.documentName}…`, { variant: 'info' })}
                    />
                  ) : (
                    <AttachDocumentButtons onAttach={(name) => attachDocument(index, name)} />
                  )}
                </Box>
              ))
            )}

            <Typography variant="h6" sx={{ ...sectionTitleSx, mt: 3, mb: 1 }}>
              Claims on this invoice
            </Typography>
            <ClaimsTable claims={openInvoice.claims} />

            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="small"
                disabled={openInvoice.paidStatus === 'paid' || openInvoice.paidStatus === 'void'}
                onClick={() => setRecordingPayment(true)}
              >
                Record payment
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={openInvoice.paidStatus === 'paid' || openInvoice.paidStatus === 'void'}
                onClick={() => setCollectingCard(true)}
              >
                Collect card payment
              </Button>
              {(openInvoice.paidStatus === 'open' || openInvoice.paidStatus === 'past-due') && (
                <Button variant="outlined" color="error" size="small" onClick={() => setVoiding(true)}>
                  Void invoice
                </Button>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="text"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => downloadTextFile(`${openInvoice.number}.txt`, invoiceText(nioName, openInvoice))}
              >
                Download invoice
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {openInvoice && recordingPayment && (
        <RecordPaymentDialog
          open
          balance={Math.max(balanceOf(openInvoice), 0)}
          onClose={() => setRecordingPayment(false)}
          onSave={applyPayment}
        />
      )}
      {openInvoice && collectingCard && (
        <CollectCardPaymentDialog
          open
          balance={Math.max(balanceOf(openInvoice), 0)}
          hasCard={hasCard}
          onClose={() => setCollectingCard(false)}
          onCharge={(amount) =>
            applyPayment({
              date: DateTime.now().toISODate() ?? '',
              method: 'Credit card',
              reference: hasCard ? `${CARD_ON_FILE.brand} •••• ${CARD_ON_FILE.last4}` : 'New card',
              amount,
            })
          }
        />
      )}
      {openInvoice && voiding && (
        <VoidInvoiceDialog invoice={openInvoice} onClose={() => setVoiding(false)} onVoid={applyVoid} />
      )}
    </Box>
  );
}
