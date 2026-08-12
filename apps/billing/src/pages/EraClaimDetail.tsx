import {
  Close as CloseIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ERA_CLAIM_STATUS_CODE, X12_ADJUSTMENT_GROUP_CODE } from 'utils/lib/types/data/billing/billing.constants';
import {
  ClaimRemitAdjustment,
  EraClaimListItem,
  EraClaimRemit,
  EraDetailResponse,
  EraRemitServiceLine,
} from 'utils/lib/types/data/billing/billing.types';
import { carcDescription, X12_ADJUSTMENT_GROUP_LABELS } from 'utils/lib/types/data/billing/carc';
import { formatCurrency, roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { getAgeInYears } from 'utils/lib/validation/helper';
import { getBillingEraDetail, lookupProcedureDescriptions } from '../api/api';
import { ReadOnlySection, thSx } from '../components/ReadOnlySection';
import { ERA_STATUS_LABELS } from '../constants/era';
import { useApiClients } from '../hooks/useAppClients';
import { formatDate } from '../utils/format';

const sumPatientResp = (adjustments: ClaimRemitAdjustment[]): number =>
  roundNumberToDecimalPlaces(
    adjustments
      .filter((adjustment) => adjustment.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility)
      .reduce((sum, adjustment) => sum + adjustment.amount, 0),
    2
  );

const adjustmentDescription = (adjustment: ClaimRemitAdjustment): string => {
  const groupLabel = X12_ADJUSTMENT_GROUP_LABELS[adjustment.groupCode] ?? adjustment.groupCode;
  if (!adjustment.reasonCode) return groupLabel;
  return `${groupLabel} — ${carcDescription(adjustment.reasonCode) ?? 'No description available'}`;
};

// CLP02 statuses a biller must not miss; they color the remit chip and force the remit header
const isAdverseRemitStatus = (statusCode: EraClaimRemit['eraStatusCode']): boolean =>
  statusCode === ERA_CLAIM_STATUS_CODE.denied || statusCode === ERA_CLAIM_STATUS_CODE.reversal;

function InlinePair({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <Typography variant="body2" component="span">
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}:{' '}
      </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>
        {value || '-'}
      </Box>
    </Typography>
  );
}

function StatCard({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 180 }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}:
        </Typography>
        <Typography variant="h6" fontWeight={700} color="primary.dark">
          {formatCurrency(value)}
        </Typography>
      </CardContent>
    </Card>
  );
}

const amountChip = (label: string, color: 'success' | 'primary' | 'warning' | 'default'): ReactElement => (
  <Chip label={label} color={color} variant="outlined" size="small" sx={{ borderRadius: '4px', fontSize: 12 }} />
);

function ServiceLineRow({
  line,
  lineNumber,
  descriptions,
}: {
  line: EraRemitServiceLine;
  lineNumber: number;
  descriptions: Record<string, string>;
}): ReactElement {
  const [expanded, setExpanded] = useState(true);
  const patientResp = sumPatientResp(line.adjustments);
  const hasPrBuckets = line.adjustments.some(
    (adjustment) => adjustment.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility
  );

  const codeWithModifiers = [line.cptCode, ...line.modifiers].filter(Boolean).join(':');
  const description = line.cptCode ? descriptions[line.cptCode] : undefined;
  const procedure = line.isClaimLevel ? (
    <Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
      Claim-level adjustments
    </Box>
  ) : codeWithModifiers ? (
    description ? (
      `${description} (${codeWithModifiers})`
    ) : (
      codeWithModifiers
    )
  ) : (
    '-'
  );

  return (
    <>
      <TableRow sx={{ '& > td': { borderBottom: line.adjustments.length > 0 ? 'none' : undefined } }}>
        <TableCell sx={{ width: 40, py: 0.5 }}>
          {line.adjustments.length > 0 && (
            <IconButton size="small" onClick={() => setExpanded((prev) => !prev)} aria-label="Toggle adjustments">
              {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>{line.isClaimLevel ? '-' : lineNumber}</TableCell>
        <TableCell>{line.isClaimLevel ? '-' : formatDate(line.serviceDate) || '-'}</TableCell>
        <TableCell>{procedure}</TableCell>
        <TableCell align="right">{line.billed === null ? '-' : formatCurrency(line.billed)}</TableCell>
        <TableCell align="right">
          {line.allowed === null ? '-' : amountChip(formatCurrency(line.allowed), 'success')}
        </TableCell>
        <TableCell align="right">{amountChip(`Paid ${formatCurrency(line.paid)}`, 'primary')}</TableCell>
        <TableCell align="right">
          {amountChip(formatCurrency(patientResp), patientResp > 0 ? 'warning' : 'default')}
        </TableCell>
      </TableRow>
      {line.adjustments.length > 0 && (
        <TableRow>
          <TableCell colSpan={8} sx={{ py: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1, pl: 5 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...thSx, width: 80, borderBottom: 'none' }}>Group</TableCell>
                      <TableCell sx={{ ...thSx, width: 80, borderBottom: 'none' }}>CARC</TableCell>
                      <TableCell sx={{ ...thSx, borderBottom: 'none' }}>Description</TableCell>
                      <TableCell sx={{ ...thSx, borderBottom: 'none' }} align="right">
                        Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {line.adjustments.map((adjustment, idx) => (
                      <TableRow key={idx} sx={{ '& > td': { borderBottom: 'none', py: 0.5 } }}>
                        <TableCell>
                          <Chip
                            label={adjustment.groupCode}
                            color={
                              adjustment.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility
                                ? 'warning'
                                : 'default'
                            }
                            variant="outlined"
                            size="small"
                            sx={{ borderRadius: '4px', fontSize: 12 }}
                          />
                        </TableCell>
                        <TableCell>{adjustment.reasonCode || '-'}</TableCell>
                        <TableCell>{adjustmentDescription(adjustment)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} component="span">
                            {formatCurrency(adjustment.amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasPrBuckets && (
                  <Stack direction="row" spacing={4} sx={{ pl: 2, pt: 1 }}>
                    <InlinePair label="Deductible" value={formatCurrency(line.deductible)} />
                    <InlinePair label="Coinsurance" value={formatCurrency(line.coinsurance)} />
                    <InlinePair label="Copay" value={formatCurrency(line.copay)} />
                  </Stack>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RemitSection({
  remit,
  claim,
  era,
  descriptions,
  showRemitHeader,
}: {
  remit: EraClaimRemit;
  claim: EraClaimListItem;
  era: EraDetailResponse;
  descriptions: Record<string, string>;
  showRemitHeader: boolean;
}): ReactElement {
  const payee = era.payee;
  const payeeDisplay = !payee
    ? ''
    : payee.name && payee.npi
    ? `${payee.name} (NPI ${payee.npi})`
    : payee.name || (payee.npi ? `NPI ${payee.npi}` : '');
  const patientRespReason = remit.patientRespAdjustments
    .map(
      (adjustment) =>
        `PR-${adjustment.reasonCode || '?'} — ${carcDescription(adjustment.reasonCode) ?? 'No description available'}`
    )
    .join('; ');

  return (
    <Box sx={{ mb: 1 }}>
      {showRemitHeader && (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          {remit.eraStatusCode && (
            <Chip
              label={ERA_STATUS_LABELS[remit.eraStatusCode]}
              color={isAdverseRemitStatus(remit.eraStatusCode) ? 'error' : 'default'}
              variant="outlined"
              size="small"
              sx={{ borderRadius: '4px', fontSize: 12 }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {[remit.outcome, formatDate(remit.created), remit.disposition].filter(Boolean).join(' · ')}
          </Typography>
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={4} rowGap={1.5} flexWrap="wrap" useFlexGap>
            <InlinePair label="Payer" value={era.payerName} />
            <InlinePair
              label="Claim ID"
              value={
                claim.matched ? (
                  <Link component={RouterLink} to={`/claims/${claim.claimId}`} underline="hover">
                    {claim.claimId}
                  </Link>
                ) : (
                  ''
                )
              }
            />
            <InlinePair label="Payer Claim #" value={remit.payerClaimControlNumber} />
            <InlinePair label="Trace Number" value={era.checkNumber} />
            <InlinePair label="Payment Date" value={formatDate(era.checkDate)} />
          </Stack>
          <Stack direction="row" spacing={4} rowGap={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <InlinePair label="Created Date" value={formatDate(era.createdDate)} />
            <InlinePair label="Billing Provider" value={payeeDisplay} />
            {patientRespReason && <InlinePair label="Pt Resp Reason" value={patientRespReason} />}
          </Stack>
        </CardContent>
      </Card>

      <ReadOnlySection title="Service Line Details & Adjustments">
        {remit.serviceLines.length === 0 ? (
          'No service line detail on this remit'
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...thSx, width: 40 }} />
                  <TableCell sx={{ ...thSx, width: 70 }}>Line #</TableCell>
                  <TableCell sx={{ ...thSx, width: 130 }}>Date of Service</TableCell>
                  <TableCell sx={thSx}>Procedure (CPT/HCPCS)</TableCell>
                  <TableCell sx={thSx} align="right">
                    Billed
                  </TableCell>
                  <TableCell sx={thSx} align="right">
                    Allowed
                  </TableCell>
                  <TableCell sx={thSx} align="right">
                    Payment
                  </TableCell>
                  <TableCell sx={thSx} align="right">
                    Patient Resp.
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {remit.serviceLines.map((line, idx) => (
                  <ServiceLineRow
                    key={`${remit.claimResponseId}-${idx}`}
                    line={line}
                    lineNumber={line.itemSequence ?? idx + 1}
                    descriptions={descriptions}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {remit.notes.length > 0 && (
          <Box sx={{ mt: 1.5, pl: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Payer remarks
            </Typography>
            {remit.notes.map((note, idx) => (
              <Typography key={idx} variant="body2">
                {note}
              </Typography>
            ))}
          </Box>
        )}
      </ReadOnlySection>
    </Box>
  );
}

// Drill-in from the ERA claims list: the full adjudication of one claim on one ERA — check and
// claim identifiers, money totals, and every service line with its coded adjustments explained.
export default function EraClaimDetail(): ReactElement {
  const { eraId, claimId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [era, setEra] = useState<EraDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !eraId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingEraDetail(oystehrZambda, { eraId });
      setEra(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load ERA' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, eraId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const claim = useMemo(() => era?.claims.find((candidate) => candidate.claimId === claimId), [era, claimId]);

  useEffect(() => {
    if (!oystehrZambda || !claim) return;
    const codes = claim.remits.flatMap((remit) => remit.serviceLines.map((line) => line.cptCode));
    if (codes.every((code) => !code)) return;
    let cancelled = false;
    void lookupProcedureDescriptions(oystehrZambda, codes).then((found) => {
      if (!cancelled) setDescriptions(found);
    });
    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, claim]);

  const contractualWriteOff = useMemo(() => {
    if (!claim) return 0;
    return roundNumberToDecimalPlaces(
      claim.remits
        .flatMap((remit) => remit.serviceLines)
        .flatMap((line) => line.adjustments)
        .filter((adjustment) => adjustment.groupCode === X12_ADJUSTMENT_GROUP_CODE.contractualObligation)
        .reduce((sum, adjustment) => sum + adjustment.amount, 0),
      2
    );
  }, [claim]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !era || !claim) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Claim not found on this ERA'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(eraId ? `/eras/${eraId}` : '/eras')}>
          Back to ERA
        </Button>
      </Box>
    );
  }

  const dob = claim.patientDob ? `${formatDate(claim.patientDob)} (${getAgeInYears(claim.patientDob)}y)` : '';

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          Reimbursement Details
        </Typography>
        <IconButton onClick={() => navigate(`/eras/${eraId}`)} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={4} rowGap={1.5} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h6" color="primary.dark" fontWeight={700}>
                {claim.patientName || '-'}
              </Typography>
              {!claim.matched && (
                <Chip
                  label="Unmatched"
                  color="warning"
                  variant="outlined"
                  size="small"
                  sx={{ borderRadius: '4px', fontSize: 12 }}
                />
              )}
            </Stack>
            <InlinePair label="Visit Date" value={formatDate(claim.dos)} />
            <InlinePair label="DOB" value={dob} />
            <InlinePair label="Member ID" value={claim.memberId} />
            <InlinePair label="Patient Account #" value={claim.patientAccountNumber} />
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <StatCard label="Total Claim Billed" value={claim.billed} />
        <StatCard label="Total Claim Paid" value={claim.paid} />
        <StatCard label="Total Patient Responsibility" value={claim.patientResp} />
        <StatCard label="Contractual Write-Off" value={contractualWriteOff} />
      </Stack>

      {claim.remits.length === 0 ? (
        <Alert severity="info">No remit detail available for this claim</Alert>
      ) : (
        claim.remits.map((remit, idx) => (
          <RemitSection
            key={remit.claimResponseId || idx}
            remit={remit}
            claim={claim}
            era={era}
            descriptions={descriptions}
            showRemitHeader={claim.remits.length > 1 || isAdverseRemitStatus(remit.eraStatusCode)}
          />
        ))
      )}
    </Box>
  );
}
