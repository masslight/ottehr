import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { getRefundState, RefundChip } from 'ui-components/lib/components/PaymentRefundChip';
import { commaFormattedName } from 'utils/lib/fhir/billing';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { BillingPatientAccountPayment } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingPatientAccountPayment } from '../api/api';
import { Amount } from '../components/Amount';
import { EHR_URL, paymentDetailPath, paymentMethodLabel } from '../components/PatientPaymentsTab';
import {
  MANUAL_REFUND_METHODS,
  PaymentAction,
  PaymentActionDialog,
  REFUND_MEDIUM_LABELS,
} from '../components/PaymentActionDialog';
import { ReadOnlySection, thSx } from '../components/ReadOnlySection';
import { Row } from '../components/Row';
import { useApiClients } from '../hooks/useAppClients';
import { useEvolveUser } from '../hooks/useEvolveUser';
import { usePatient } from '../hooks/usePatient';
import { formatDate, formatDateTime } from '../utils/format';

const REFUNDABLE_METHODS = ['card', 'card-reader', 'cash', 'check', 'external-card-reader'];
// refunds of these go through Stripe; they can additionally record a refund issued outside it
const STRIPE_LINKED_METHODS = ['card', 'card-reader'];
const VOIDABLE_METHODS = ['cash', 'check', 'external-card-reader'];
// the refund and void zambdas allow only this role
const PAYMENT_MANAGEMENT_ROLES = [RoleType.BillingAdmin];
const NOT_ALLOWED_HINT = 'Only users with the Billing Admin role can refund or void payments';

// a manual payment's date is a date-only paymentDate, which must not render as midnight
const formatPaymentDate = (iso: string): string => (iso.length <= 10 ? formatDate(iso) : formatDateTime(iso));

const isSettledRefund = (refund: PaymentRefundDTO): boolean =>
  refund.status !== 'failed' && refund.status !== 'canceled';

const cents = (amountInCents: number): string => formatCurrency(amountInCents / 100);

export default function PatientPaymentDetail(): ReactElement {
  const { id: patientId, encounterId, paymentId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [payment, setPayment] = useState<BillingPatientAccountPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedPatient] = usePatient({ id: patientId! });
  // usePatient keeps the previous patient (and a late response for it) when the route moves to another
  // patient, so the header shows only the one this route names
  const patient = loadedPatient?.id === patientId ? loadedPatient : null;
  const { currentUser } = useEvolveUser();
  const canManagePayments = currentUser?.hasRole(PAYMENT_MANAGEMENT_ROLES) ?? false;
  const [action, setAction] = useState<PaymentAction | null>(null);

  const backToPayments = (): void => navigate(`/patients/${patientId}?tab=payments`);

  // set when the URL is switched to the id a payment was just loaded under, so that switch doesn't reload it
  const loadedUnderIdRef = useRef<string | undefined>(undefined);
  // Loads overlap (a failed action reloads without waiting, a retry reloads again, the route can change
  // mid-load), so each one takes a generation and only the latest may touch state or the URL.
  const generationRef = useRef(0);
  const invalidateLoads = (): void => {
    generationRef.current++;
  };
  // The payment the page is on: its patient/encounter and its ids, current first, then those it was opened
  // under before the URL moved to its billing id. Null once the page is gone. A refund or void dialog holds the
  // reload of the route it was opened on and may call it after the user has moved on; that reload is dropped.
  const routeRef = useRef<{ key: string; paymentIds: string[] } | null>(null);
  const routeKey = `${patientId}/${encounterId}`;

  const fetchPayment = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !patientId || !encounterId || !paymentId) return;
    const isOnRoute = (): boolean =>
      routeRef.current?.key === `${patientId}/${encounterId}` && routeRef.current.paymentIds.includes(paymentId);
    if (!isOnRoute()) return;
    const generation = ++generationRef.current;
    const isCurrent = (): boolean => generation === generationRef.current && isOnRoute();
    setLoading(true);
    setError(null);
    try {
      const res = await getBillingPatientAccountPayment(oystehrZambda, { patientId, encounterId, paymentId });
      if (!isCurrent() || !routeRef.current) return;
      setPayment(res.payment);
      // a legacy EHR payment gets a billing id once it is refunded or voided; keep the URL current
      const resolvedId = res.payment.fhirPaymentNotificationId;
      const path = paymentDetailPath(patientId, res.payment);
      if (resolvedId && path && routeRef.current.paymentIds[0] !== resolvedId) {
        routeRef.current = { ...routeRef.current, paymentIds: [resolvedId, ...routeRef.current.paymentIds] };
        loadedUnderIdRef.current = resolvedId;
        navigate(path, { replace: true });
      }
    } catch (err) {
      if (!isCurrent()) return;
      setError(getApiError({ error: err, defaultError: 'Failed to load payment' }));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [oystehrZambda, patientId, encounterId, paymentId, navigate]);

  useEffect(() => {
    if (loadedUnderIdRef.current && loadedUnderIdRef.current === paymentId) {
      // the same payment under its current id, already loaded
      loadedUnderIdRef.current = undefined;
    } else {
      const route = routeRef.current;
      if (!route || route.key !== routeKey || !route.paymentIds.includes(paymentId ?? '')) {
        // a different payment must not show (or be acted on) the previous one's data
        if (route) {
          setPayment(null);
          setAction(null);
        }
        routeRef.current = { key: routeKey, paymentIds: paymentId ? [paymentId] : [] };
      }
      void fetchPayment();
    }
    // leaving the route or the page drops whatever is still loading for it
    return invalidateLoads;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPayment, paymentId, routeKey]);

  useEffect(
    () => () => {
      routeRef.current = null;
    },
    []
  );

  if (loading && !payment) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!payment) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Payment not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={backToPayments}>
          Back to Payments
        </Button>
      </Box>
    );
  }

  const refundState = getRefundState(payment);
  const refundedCents = payment.refundedAmountInCents ?? 0;
  const netCents = payment.voided ? 0 : payment.amountInCents - refundedCents;
  const refunds = payment.refunds ?? [];
  const refundedToCard = !MANUAL_REFUND_METHODS.includes(payment.paymentMethod) && !refunds.some((r) => r.medium);

  // after a failed reload the shown balance is unconfirmed, so no new operation may start from it
  const balanceUnconfirmed = loading || !!error;
  const method = payment.paymentMethod;
  const refundApplies =
    REFUNDABLE_METHODS.includes(method) &&
    // a card or terminal payment Stripe recorded without a PaymentIntent cannot be refunded from here
    (!STRIPE_LINKED_METHODS.includes(method) || !!payment.stripePaymentId) &&
    !payment.voided &&
    netCents > 0 &&
    !!payment.fhirPaymentNotificationId;
  const actions: { action: PaymentAction; label: string }[] = [
    ...(refundApplies
      ? [
          {
            action: 'refund' as const,
            label: MANUAL_REFUND_METHODS.includes(method) ? 'Record Refund' : 'Refund Payment',
          },
        ]
      : []),
    ...(refundApplies && STRIPE_LINKED_METHODS.includes(method)
      ? [{ action: 'external-refund' as const, label: 'Record External Refund' }]
      : []),
    ...(VOIDABLE_METHODS.includes(method) &&
    !payment.voided &&
    refundedCents <= 0 &&
    !!payment.fhirPaymentNotificationId
      ? [{ action: 'void' as const, label: 'Void Payment' }]
      : []),
  ];

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <IconButton onClick={backToPayments} size="small" sx={{ mt: 0.5 }} aria-label="Back to payments">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" color="primary.dark" fontWeight={600}>
              Payment Details
            </Typography>
            <RefundChip state={refundState} />
          </Box>
          {patient && (
            <Typography variant="body2" color="text.secondary">
              {commaFormattedName(patient)} | DOB {patient.dob} | MRN {patient.clinicalId}
            </Typography>
          )}
        </Box>
        {actions.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            {actions.map(({ action: actionType, label }) => (
              <Tooltip
                key={actionType}
                title={
                  !canManagePayments
                    ? NOT_ALLOWED_HINT
                    : balanceUnconfirmed
                    ? 'Waiting for the latest payment balance'
                    : ''
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    // a new operation must start from the confirmed balance, e.g. after a failed attempt
                    disabled={!canManagePayments || balanceUnconfirmed}
                    onClick={() => setAction(actionType)}
                  >
                    {label}
                  </Button>
                </span>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Amount label="Amount" value={payment.amountInCents / 100} />
            {refundedCents > 0 && <Amount label="Refunded" value={-refundedCents / 100} />}
            {refundState !== 'none' && <Amount label="Net" value={netCents / 100} />}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ ml: 5 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void fetchPayment()} disabled={loading}>
                Reload
              </Button>
            }
          >
            {error} — the details below may be out of date.
          </Alert>
        )}
        {refundState !== 'none' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {refundState === 'voided'
              ? `This payment has been voided${
                  payment.voidReason ? ` (${payment.voidReason.toLowerCase()})` : ''
                } and is not counted toward the total collected.`
              : refundState === 'full'
              ? `This payment has been fully refunded${
                  refundedToCard ? ' to the credit card' : ''
                } and is not counted toward the total collected.`
              : `${cents(refundedCents)} of this payment has been refunded${
                  refundedToCard ? ' to the credit card' : ''
                }. Only the remaining ${cents(netCents)} counts toward the total collected.`}
          </Alert>
        )}

        <ReadOnlySection title="Payment">
          <Row
            label="Method"
            value={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
                {paymentMethodLabel(payment)}
              </Box>
            }
          />
          <Row label="Payment Date" value={formatPaymentDate(payment.dateISO)} />
          {/* a manual payment's date carries no time, and may be backdated; show when it was entered */}
          {payment.dateISO.length <= 10 && <Row label="Recorded" value={formatDateTime(payment.recordedDateISO)} />}
          <Row label="Taken By" value={payment.takenBy} />
          <Row label="Description" value={payment.description} />
          {payment.stripePaymentId && (
            <Row
              label={payment.paymentMethod === 'card' ? 'Credit Card Payment' : 'Stripe Payment'}
              value={payment.stripePaymentId}
            />
          )}
          {payment.voided && (
            <>
              <Row label="Void Reason" value={payment.voidReason} />
              <Row label="Void Notes" value={payment.voidNotes} />
              <Row label="Voided By" value={payment.voidedBy} />
            </>
          )}
          <Row
            label="Encounter"
            value={
              EHR_URL && payment.appointmentId ? (
                <Link href={`${EHR_URL}/visit/${payment.appointmentId}`} target="_blank" rel="noopener noreferrer">
                  {payment.visitDateISO ? formatDate(payment.visitDateISO) : 'Open visit'}
                </Link>
              ) : (
                payment.visitDateISO && formatDate(payment.visitDateISO)
              )
            }
          />
          <Row
            label="Claim"
            hideBorder
            value={
              payment.claimId && (
                <Link component={RouterLink} to={`/claims/${payment.claimId}`}>
                  {payment.claimServiceDate ? formatDate(payment.claimServiceDate) : 'Open claim'}
                </Link>
              )
            }
          />
        </ReadOnlySection>

        <ReadOnlySection title="Transactions">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Type</TableCell>
                  <TableCell sx={thSx}>Date</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                  <TableCell sx={thSx}>Reason</TableCell>
                  <TableCell sx={thSx}>Notes</TableCell>
                  <TableCell sx={thSx}>By</TableCell>
                  <TableCell sx={thSx} align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Payment</TableCell>
                  <TableCell>{formatDateTime(payment.recordedDateISO)}</TableCell>
                  <TableCell>{payment.voided ? 'Voided' : 'Succeeded'}</TableCell>
                  <TableCell>{payment.voidReason || '-'}</TableCell>
                  <TableCell>{payment.voidNotes || '-'}</TableCell>
                  <TableCell>{payment.takenBy || '-'}</TableCell>
                  <TableCell align="right">{cents(payment.amountInCents)}</TableCell>
                </TableRow>
                {refunds.map((refund) => {
                  const settled = isSettledRefund(refund);
                  const mutedSx = settled ? undefined : { color: 'text.disabled' };
                  return (
                    <TableRow key={refund.stripeRefundId}>
                      <TableCell sx={mutedSx}>
                        Refund
                        {refund.medium && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            via {REFUND_MEDIUM_LABELS[refund.medium].toLowerCase()}
                          </Typography>
                        )}
                        {!refund.stripeRefundId.startsWith('manual_') && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ wordBreak: 'break-all' }}
                          >
                            {refund.stripeRefundId}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={mutedSx}>{formatDateTime(refund.dateISO)}</TableCell>
                      <TableCell sx={mutedSx}>{refund.status ? refund.status.replace(/_/g, ' ') : 'unknown'}</TableCell>
                      <TableCell sx={mutedSx}>{refund.reason ? refund.reason.replace(/_/g, ' ') : '-'}</TableCell>
                      <TableCell sx={mutedSx}>{refund.notes || '-'}</TableCell>
                      <TableCell sx={mutedSx}>{refund.refundedBy || '-'}</TableCell>
                      <TableCell
                        align="right"
                        sx={settled ? { color: 'error.main' } : { ...mutedSx, textDecoration: 'line-through' }}
                      >
                        -{cents(refund.amountInCents)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {refundState !== 'none' && (
                  <TableRow sx={{ '& td': { borderBottom: 0, fontWeight: 600 } }}>
                    <TableCell colSpan={6}>Net</TableCell>
                    <TableCell align="right">{cents(netCents)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </ReadOnlySection>
      </Box>
      {action && (
        <PaymentActionDialog action={action} payment={payment} onClose={() => setAction(null)} onDone={fetchPayment} />
      )}
    </Box>
  );
}
