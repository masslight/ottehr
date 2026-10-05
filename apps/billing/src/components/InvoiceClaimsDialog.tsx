import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { BillingClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';

// --- UI-only prototype test data -------------------------------------------------------------
// Would come from clinic settings; hard-coded for the prototype.
const CLINIC_SETTINGS = {
  name: 'Ottehr',
  logoUrl: '/ottehr-logo.png',
  addressLines: ['2500 Medical Plaza Drive, Suite 400', 'Austin, TX 78701'],
  phone: '(512) 555-0142',
};

const NIO_ADDRESS_BOOK: Record<string, string[]> = {
  'Acme Health Services': ['4820 Commerce Parkway, Suite 210', 'Austin, TX 78744'],
  'Lakeside School District': ['77 Lakeshore Boulevard', 'Madison, WI 53703'],
  'Harrington & Lowe LLP': ['900 Congress Avenue, 14th Floor', 'Austin, TX 78701'],
  'Meridian Life Underwriting': ['415 Lakeview Drive', 'Chicago, IL 60601'],
};
const FALLBACK_NIO_ADDRESS = ['100 Main Street', 'Anytown, USA 00000'];

interface NioContact {
  email: string;
  cc: string[];
  ePay: string[];
  fax: string;
  portalUrl: string;
}

const NIO_CONTACTS: Record<string, NioContact> = {
  'Acme Health Services': {
    email: 'ap@acmehealth.example.com',
    cc: ['billing@acmehealth.example.com', 'office-manager@acmehealth.example.com'],
    ePay: ['payments@acmehealth.example.com'],
    fax: '(512) 555-0199',
    portalUrl: 'https://vendors.acmehealth.example.com/invoices',
  },
  'Lakeside School District': {
    email: 'accounts@lakesidesd.example.org',
    cc: ['athletics@lakesidesd.example.org'],
    ePay: ['accounts@lakesidesd.example.org'],
    fax: '(608) 555-0171',
    portalUrl: 'https://procurement.lakesidesd.example.org/ap',
  },
  'Harrington & Lowe LLP': {
    email: 'records@harringtonlowe.example.com',
    cc: ['paralegals@harringtonlowe.example.com'],
    ePay: ['accounting@harringtonlowe.example.com'],
    fax: '(512) 555-0823',
    portalUrl: 'https://vendors.harringtonlowe.example.com/invoices',
  },
  'Meridian Life Underwriting': {
    email: 'aps@meridianlife.example.com',
    cc: ['underwriting@meridianlife.example.com'],
    ePay: ['ap@meridianlife.example.com'],
    fax: '(312) 555-0467',
    portalUrl: 'https://providers.meridianlife.example.com/billing',
  },
};
const FALLBACK_NIO_CONTACT: NioContact = {
  email: 'ap@example.com',
  cc: [],
  ePay: ['ap@example.com'],
  fax: '(000) 000-0000',
  portalUrl: 'https://vendorportal.example.com/invoices',
};

// Document Requestor NIOs are priced per claim + per document + per page (all additive) instead
// of claim balances. Pricing would come from the NIO's Document Invoice Pricing settings.
interface DocPricing {
  perClaim: number;
  perDocument: number;
  perPage: number;
}
const NIO_DOC_PRICING: Record<string, DocPricing> = {
  'Harrington & Lowe LLP': { perClaim: 25, perDocument: 10, perPage: 0.5 },
  'Meridian Life Underwriting': { perClaim: 15, perDocument: 5, perPage: 0.25 },
};
// Documents/pages fulfilled per claim — would come from the records request in a real flow.
const CLAIM_DOC_COUNTS: Record<string, { documents: number; pages: number }> = {
  'demo-doc-1': { documents: 3, pages: 42 },
  'demo-doc-2': { documents: 1, pages: 12 },
  'demo-doc-3': { documents: 2, pages: 27 },
  'demo-doc-4': { documents: 2, pages: 18 },
  'demo-doc-5': { documents: 1, pages: 30 },
};
const FALLBACK_DOC_COUNTS = { documents: 1, pages: 5 };
// ----------------------------------------------------------------------------------------------

const amountDueOf = (claim: BillingClaimItem): number => (claim.claimBalance > 0 ? claim.claimBalance : claim.billed);

const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' };

type DeliveryMethodKey = 'mail' | 'email' | 'fax' | 'epay' | 'portal';

interface InvoiceClaimsDialogProps {
  open: boolean;
  claims: BillingClaimItem[];
  onClose: () => void;
}

// UI-only prototype: renders an invoice-style preview of the selected Non-insurance Payer AR
// claims for a single non-insurance organization, with a placeholder options sidebar.
export default function InvoiceClaimsDialog({ open, claims, onClose }: InvoiceClaimsDialogProps): ReactElement {
  const nioName = claims[0]?.nonInsurancePayerName ?? '';
  const nioAddressLines = NIO_ADDRESS_BOOK[nioName] ?? FALLBACK_NIO_ADDRESS;
  const nioContact = NIO_CONTACTS[nioName] ?? FALLBACK_NIO_CONTACT;
  const docPricing = NIO_DOC_PRICING[nioName];

  const docLineOf = (claim: BillingClaimItem): { documents: number; pages: number; amount: number } => {
    const counts = CLAIM_DOC_COUNTS[claim.id] ?? FALLBACK_DOC_COUNTS;
    const pricing = docPricing ?? { perClaim: 0, perDocument: 0, perPage: 0 };
    return {
      ...counts,
      amount: pricing.perClaim + counts.documents * pricing.perDocument + counts.pages * pricing.perPage,
    };
  };

  const issueDate = useMemo(() => DateTime.now(), []);
  const invoiceNumber = useMemo(() => `INV-${issueDate.toFormat('yyyyLLdd')}-DRAFT`, [issueDate]);
  const totalDue = claims.reduce((sum, c) => sum + (docPricing ? docLineOf(c).amount : amountDueOf(c)), 0);

  // Delivery method options
  const [mailEnabled, setMailEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [faxEnabled, setFaxEnabled] = useState(false);
  const [ePayEnabled, setEPayEnabled] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState<DeliveryMethodKey | null>('mail');
  const [mailAddress, setMailAddress] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [faxNumber, setFaxNumber] = useState('');
  const [ePayEmails, setEPayEmails] = useState('');
  const [includeCms1500, setIncludeCms1500] = useState(false);
  const [includeVisitSummary, setIncludeVisitSummary] = useState(false);

  // Re-seed the option defaults for the organization being invoiced each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const addressLines = NIO_ADDRESS_BOOK[nioName] ?? FALLBACK_NIO_ADDRESS;
    const contact = NIO_CONTACTS[nioName] ?? FALLBACK_NIO_CONTACT;
    setMailEnabled(true);
    setEmailEnabled(false);
    setFaxEnabled(false);
    setEPayEnabled(false);
    setPortalEnabled(false);
    setExpandedMethod('mail');
    setMailAddress([nioName, ...addressLines].filter(Boolean).join('\n'));
    setEmailTo(contact.email);
    setEmailCc(contact.cc.join('\n'));
    setEmailPassword('invoice-2026');
    setFaxNumber(contact.fax);
    setEPayEmails(contact.ePay.join('\n'));
    setIncludeCms1500(false);
    setIncludeVisitSummary(false);
  }, [open, nioName]);

  const handleCreate = (): void => {
    enqueueSnackbar(`Invoice ${invoiceNumber} created.`, { variant: 'success' });
    onClose();
  };

  const deliveryMethods: {
    key: DeliveryMethodKey;
    label: string;
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    details: ReactNode;
  }[] = [
    {
      key: 'mail',
      label: 'Mail',
      enabled: mailEnabled,
      setEnabled: setMailEnabled,
      details: (
        <TextField
          label="Mail to"
          size="small"
          fullWidth
          multiline
          minRows={3}
          value={mailAddress}
          onChange={(e) => setMailAddress(e.target.value)}
        />
      ),
    },
    {
      key: 'email',
      label: 'Email',
      enabled: emailEnabled,
      setEnabled: setEmailEnabled,
      details: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Email address"
            size="small"
            fullWidth
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <TextField
            label="CC addresses"
            size="small"
            fullWidth
            multiline
            minRows={2}
            helperText="One address per line"
            value={emailCc}
            onChange={(e) => setEmailCc(e.target.value)}
          />
          <TextField
            label="Encryption password"
            type="password"
            size="small"
            fullWidth
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
          />
        </Box>
      ),
    },
    {
      key: 'fax',
      label: 'Fax',
      enabled: faxEnabled,
      setEnabled: setFaxEnabled,
      details: (
        <TextField
          label="Fax number"
          size="small"
          fullWidth
          value={faxNumber}
          onChange={(e) => setFaxNumber(e.target.value)}
        />
      ),
    },
    {
      key: 'epay',
      label: 'E-Pay',
      enabled: ePayEnabled,
      setEnabled: setEPayEnabled,
      details: (
        <TextField
          label="Send payment link to"
          size="small"
          fullWidth
          multiline
          minRows={2}
          helperText="One email per line"
          value={ePayEmails}
          onChange={(e) => setEPayEmails(e.target.value)}
        />
      ),
    },
    {
      key: 'portal',
      label: 'External Portal',
      enabled: portalEnabled,
      setEnabled: setPortalEnabled,
      details: (
        <>
          <Link
            href={nioContact.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ wordBreak: 'break-all' }}
          >
            {nioContact.portalUrl}
          </Link>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Log in with your vendor credentials, choose “Submit invoice”, upload the generated invoice PDF, and enter
            the invoice number and total due. Allow 2–3 business days for processing.
          </Typography>
        </>
      ),
    },
  ];

  const enabledMethods = deliveryMethods.filter((m) => m.enabled);

  const toggleMethod = (method: (typeof deliveryMethods)[number], checked: boolean): void => {
    method.setEnabled(checked);
    if (checked) setExpandedMethod(method.key);
    else if (expandedMethod === method.key) setExpandedMethod(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>Invoice claims</DialogTitle>

      <DialogContent dividers sx={{ bgcolor: 'grey.100', overflow: 'hidden', display: 'flex' }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'stretch', flex: 1, minWidth: 0 }}>
          {/* Invoice document preview */}
          <Paper elevation={3} sx={{ flex: 1, p: { xs: 3, md: 5 }, minWidth: 0, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Box
                  component="img"
                  src={CLINIC_SETTINGS.logoUrl}
                  alt={CLINIC_SETTINGS.name}
                  sx={{ height: 36, mb: 1 }}
                />
                {CLINIC_SETTINGS.addressLines.map((line) => (
                  <Typography key={line} variant="body2" color="text.secondary">
                    {line}
                  </Typography>
                ))}
                <Typography variant="body2" color="text.secondary">
                  {CLINIC_SETTINGS.phone}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" color="primary.dark" fontWeight={700} letterSpacing={2}>
                  INVOICE
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Invoice #: {invoiceNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Issue date: {issueDate.toLocaleString(DateTime.DATE_MED)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Due date: {issueDate.plus({ days: 30 }).toLocaleString(DateTime.DATE_MED)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary">
                Bill to
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {nioName || '—'}
              </Typography>
              {nioAddressLines.map((line) => (
                <Typography key={line} variant="body2" color="text.secondary">
                  {line}
                </Typography>
              ))}
            </Box>

            <Table size="small" sx={{ mb: docPricing ? 1 : 3 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Service Date</TableCell>
                  <TableCell sx={thSx}>Patient</TableCell>
                  {docPricing ? (
                    <>
                      <TableCell sx={thSx}>Claim ID</TableCell>
                      <TableCell sx={{ ...thSx, textAlign: 'right' }}>Documents</TableCell>
                      <TableCell sx={{ ...thSx, textAlign: 'right' }}>Pages</TableCell>
                      <TableCell sx={{ ...thSx, textAlign: 'right' }}>Amount Due</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell sx={thSx}>Service</TableCell>
                      <TableCell sx={thSx}>Claim ID</TableCell>
                      <TableCell sx={{ ...thSx, textAlign: 'right' }}>Amount Due</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {claims.map((claim) => {
                  const line = docPricing ? docLineOf(claim) : null;
                  return (
                    <TableRow key={claim.id}>
                      <TableCell>{claim.serviceDate}</TableCell>
                      <TableCell>{claim.patientName}</TableCell>
                      {line ? (
                        <>
                          <TableCell>{claim.id}</TableCell>
                          <TableCell align="right">{line.documents}</TableCell>
                          <TableCell align="right">{line.pages}</TableCell>
                          <TableCell align="right">{formatCurrency(line.amount)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{formatAntCaseString(claim.service ?? '')}</TableCell>
                          <TableCell>{claim.id}</TableCell>
                          <TableCell align="right">{formatCurrency(amountDueOf(claim))}</TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {docPricing && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                Document pricing: {formatCurrency(docPricing.perClaim)} per claim +{' '}
                {formatCurrency(docPricing.perDocument)} per document + {formatCurrency(docPricing.perPage)} per page.
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 260 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Claims ({claims.length})
                  </Typography>
                  <Typography variant="body2">{formatCurrency(totalDue)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Total due
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {formatCurrency(totalDue)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Options sidebar — fixed width, scrolls internally so the dialog never resizes */}
          <Paper elevation={1} sx={{ width: 380, flexShrink: 0, p: 2, overflow: 'auto' }}>
            <Typography variant="subtitle1" color="primary.dark" fontWeight={600} sx={{ mb: 1 }}>
              Delivery Options
            </Typography>

            <Typography variant="overline" color="text.secondary">
              Delivery Method
            </Typography>
            <FormGroup row sx={{ mb: 1 }}>
              {deliveryMethods.map((method) => (
                <FormControlLabel
                  key={method.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={method.enabled}
                      onChange={(_, checked) => toggleMethod(method, checked)}
                    />
                  }
                  label={method.label}
                  slotProps={{ typography: { variant: 'body2' } }}
                  sx={{ mr: 1.5 }}
                />
              ))}
            </FormGroup>

            {enabledMethods.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Select at least one delivery method.
              </Typography>
            ) : (
              <Box>
                {enabledMethods.map((method) => (
                  <Accordion
                    key={method.key}
                    disableGutters
                    elevation={0}
                    expanded={expandedMethod === method.key}
                    onChange={(_, expanded) => setExpandedMethod(expanded ? method.key : null)}
                    sx={{ border: '1px solid', borderColor: 'divider', '&:not(:last-child)': { borderBottom: 0 } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" fontWeight={600}>
                        {method.label}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>{method.details}</AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="overline" color="text.secondary">
              Attachments
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includeCms1500}
                    onChange={(_, checked) => setIncludeCms1500(checked)}
                  />
                }
                label="CMS-1500"
                slotProps={{ typography: { variant: 'body2' } }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includeVisitSummary}
                    onChange={(_, checked) => setIncludeVisitSummary(checked)}
                  />
                }
                label="Visit Notes"
                slotProps={{ typography: { variant: 'body2' } }}
              />
            </FormGroup>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate}>
          Create invoice
        </Button>
      </DialogActions>
    </Dialog>
  );
}
