import { otherColors } from '@ehrTheme/colors';
import { Close } from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, Fragment, useState } from 'react';
import {
  CoverageCheckWithDetails,
  EligibilityCheckSimpleStatus,
  InsuranceEligibilityCheckStatus,
  PatientPaymentBenefit,
} from 'utils';

const STATUS_TO_STYLE_MAP: Record<EligibilityCheckSimpleStatus, { bgColor: string; textColor: string }> = {
  ELIGIBLE: {
    bgColor: '#C8E6C9',
    textColor: '#1B5E20',
  },
  'NOT ELIGIBLE': {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
  UNKNOWN: {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
};

interface EligibilityError {
  code?: string;
  text?: string;
}

interface EligibilityDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  eligibilityCheck?: CoverageCheckWithDetails;
  simpleStatus?: EligibilityCheckSimpleStatus;
  errorDetails?: EligibilityError[];
  rawErrorResponse?: any;
}

interface DetailItem {
  label: string;
  value?: string;
}

const getStatusDisplay = (status: InsuranceEligibilityCheckStatus): { text: string; color: string } => {
  switch (status) {
    case InsuranceEligibilityCheckStatus.eligibilityConfirmed:
      return { text: 'Eligibility Confirmed', color: '#1B5E20' };
    case InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported:
      return { text: 'Eligibility Check Not Supported', color: '#FF8F00' };
    case InsuranceEligibilityCheckStatus.eligibilityNotChecked:
      return { text: 'Eligibility Not Checked', color: '#B71C1C' };
    case InsuranceEligibilityCheckStatus.eligibilityNotConfirmed:
      return { text: 'Eligibility Not Confirmed', color: '#B71C1C' };
    default:
      return { text: 'Unknown Status', color: '#757575' };
  }
};

const formatDate = (dateISO: string): string => {
  try {
    return new Date(dateISO).toLocaleString();
  } catch {
    return dateISO;
  }
};

const formatBenefitAmount = (benefit: PatientPaymentBenefit): string => {
  // Handle both string and number types for amountInUSD and percentage
  const amountInUSD = typeof benefit.amountInUSD === 'string' ? parseFloat(benefit.amountInUSD) : benefit.amountInUSD;
  const percentage = typeof benefit.percentage === 'string' ? parseFloat(benefit.percentage) : benefit.percentage;

  // Match CopayWidget logic
  if (benefit.coverageCode === 'A') {
    // Coinsurance - prefer percentage
    if (typeof percentage === 'number' && !isNaN(percentage) && percentage > 0) {
      return `${percentage}%`;
    } else if (typeof amountInUSD === 'number' && !isNaN(amountInUSD) && amountInUSD > 0) {
      return `$${amountInUSD.toFixed(2)}`;
    } else {
      return '0%';
    }
  } else {
    // Copay - prefer dollar amount
    if (typeof amountInUSD === 'number' && !isNaN(amountInUSD) && amountInUSD > 0) {
      return `$${amountInUSD.toFixed(2)}`;
    } else if (typeof percentage === 'number' && !isNaN(percentage) && percentage > 0) {
      return `${percentage}%`;
    } else {
      return '$0';
    }
  }
};

const valueOrDash = (value?: string): string => {
  if (!value || value.trim() === '') {
    return '—';
  }
  return value;
};

// Maps the raw `inplan_network` indicator to a human-readable network status.
// 'Y' = in network, 'N' = out of network, 'W' = not applicable, anything else = unknown.
const formatNetworkStatus = (inPlanNetworkCode?: string): string => {
  switch (inPlanNetworkCode) {
    case 'Y':
      return 'In Network';
    case 'N':
      return 'Out of Network';
    case 'W':
      return 'Not Applicable';
    default:
      return 'Unknown';
  }
};

const networkChipColors = (inPlanNetworkCode?: string): { backgroundColor: string; color: string } => {
  switch (inPlanNetworkCode) {
    case 'Y':
      return { backgroundColor: otherColors.employeeActiveChip, color: otherColors.employeeActiveText };
    case 'N':
      return { backgroundColor: otherColors.employeeDeactivatedChip, color: otherColors.employeeDeactivatedText };
    default:
      return { backgroundColor: otherColors.outreachNeutralAvatar, color: otherColors.eligibilityNeutralChipText };
  }
};

const formatInsuranceType = (insuranceCode?: string, insuranceDescription?: string): string => {
  const formatted = [insuranceCode, insuranceDescription].filter(Boolean).join(' - ');
  return valueOrDash(formatted);
};

const formatBenefitRange = (range?: string): string => {
  if (!range) {
    return '—';
  }

  const [startRaw, endRaw] = range.split('-');
  const formatPart = (value?: string): string => {
    if (!value || !/^\d{8}$/.test(value)) {
      return value || '';
    }
    return `${value.slice(4, 6)}/${value.slice(6, 8)}/${value.slice(0, 4)}`;
  };

  const start = formatPart(startRaw);
  const end = formatPart(endRaw);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || range;
};

const DetailSection: FC<{ title: string; context: string; items: DetailItem[] }> = ({ title, context, items }) => {
  return (
    <Box
      sx={{
        border: `1px solid ${otherColors.eligibilityPanelBorder}`,
        borderRadius: 2,
        p: 2,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="h6" sx={{ color: 'primary.dark', fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {context}
      </Typography>
      <Grid container spacing={1}>
        {items.map((item) => (
          <Fragment key={`${title}-${item.label}`}>
            <Grid item xs={5}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {item.label}
              </Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {valueOrDash(item.value)}
              </Typography>
            </Grid>
          </Fragment>
        ))}
      </Grid>
    </Box>
  );
};

export const EligibilityDetailsDialog: FC<EligibilityDetailsDialogProps> = ({
  open,
  onClose,
  eligibilityCheck,
  simpleStatus,
  errorDetails,
  rawErrorResponse,
}) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState<string>('copay-tab');
  if (!eligibilityCheck) {
    return null;
  }

  const statusDisplay = getStatusDisplay(eligibilityCheck.status);
  const copayBenefits = eligibilityCheck.copay || [];
  const benefitContextRows = [...copayBenefits, ...(eligibilityCheck.deductible || [])].sort((a, b) => {
    const descriptionA = (a.description || '').toLowerCase();
    const descriptionB = (b.description || '').toLowerCase();
    if (descriptionA === descriptionB) {
      return (a.code || '').localeCompare(b.code || '');
    }
    return descriptionA.localeCompare(descriptionB);
  });

  const hasErrors = errorDetails && errorDetails.length > 0;
  const hasFailedStatus =
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked ||
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;

  function formatName(firstName?: string, middleName?: string, lastName?: string): string {
    if (!firstName && !lastName) {
      return 'UNKNOWN';
    }

    if (middleName) {
      return `${firstName} ${middleName} ${lastName}`;
    }

    return `${firstName} ${lastName}`;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 600 }}>
          Eligibility Check Details
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Status Section */}
          <Paper sx={{ p: 3, backgroundColor: '#f8f9fa' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Chip
                label={simpleStatus || statusDisplay.text}
                sx={{
                  backgroundColor: STATUS_TO_STYLE_MAP[simpleStatus || 'UNKNOWN'].bgColor,
                  color: STATUS_TO_STYLE_MAP[simpleStatus || 'UNKNOWN'].textColor,
                  borderRadius: '8px',
                  padding: '0 9px',
                  height: '24px',
                  '& .MuiChip-label': {
                    padding: 0,
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                  },
                }}
              />
              <Typography variant="body2" color="textSecondary">
                Last checked {formatDate(eligibilityCheck.dateISO)}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DetailSection
                  title="Subscriber"
                  context="Information returned for the insured member used in the eligibility check."
                  items={[
                    {
                      label: 'Name',
                      value: formatName(
                        eligibilityCheck.coverageDetails?.subscriber?.firstName,
                        eligibilityCheck.coverageDetails?.subscriber?.middleName,
                        eligibilityCheck.coverageDetails?.subscriber?.lastName
                      ),
                    },
                    { label: 'Member ID', value: eligibilityCheck.coverageDetails?.subscriber?.memberID },
                    { label: 'DOB', value: eligibilityCheck.coverageDetails?.subscriber?.dateOfBirth },
                    { label: 'Address', value: eligibilityCheck.coverageDetails?.subscriber?.address },
                  ]}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DetailSection
                  title="Patient"
                  context="Patient demographic data included in the eligibility transaction."
                  items={[
                    {
                      label: 'Name',
                      value: formatName(
                        eligibilityCheck.coverageDetails?.patient?.firstName,
                        eligibilityCheck.coverageDetails?.patient?.middleName,
                        eligibilityCheck.coverageDetails?.patient?.lastName
                      ),
                    },
                    { label: 'DOB', value: eligibilityCheck.coverageDetails?.patient?.dateOfBirth },
                  ]}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DetailSection
                  title="Plan"
                  context="Plan and policy identifiers from the payer's eligibility response."
                  items={[
                    { label: 'Plan number', value: eligibilityCheck.coverageDetails?.insurance?.planNumber },
                    { label: 'Policy number', value: eligibilityCheck.coverageDetails?.insurance?.policyNumber },
                    {
                      label: 'Insurance type',
                      value: formatInsuranceType(
                        eligibilityCheck.coverageDetails?.insurance?.insuranceCode,
                        eligibilityCheck.coverageDetails?.insurance?.insuranceDescription
                      ),
                    },
                  ]}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DetailSection
                  title="Primary Payer"
                  context="Primary payer entity identified by the response for adjudication and routing."
                  items={[
                    { label: 'Payer name', value: eligibilityCheck.coverageDetails?.payer?.name },
                    { label: 'Payer ID', value: eligibilityCheck.coverageDetails?.payer?.payerID },
                    { label: 'Phone', value: eligibilityCheck.coverageDetails?.payer?.phone },
                    { label: 'Address', value: eligibilityCheck.coverageDetails?.payer?.address },
                  ]}
                />
              </Grid>
            </Grid>

            {(eligibilityCheck.coverageDetails?.plans?.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>
                  Additional Organizations
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  These organizations appear because the payer response included additional plan, MCO, or network
                  entities.
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell>Why listed</TableCell>
                      <TableCell>Payer ID</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Insurance type</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eligibilityCheck.coverageDetails?.plans?.map((plan, index) => (
                      <TableRow key={`org-${index}`}>
                        <TableCell>{[plan.entityName, plan.planName].filter(Boolean).join(' / ') || '—'}</TableCell>
                        <TableCell>{valueOrDash(plan.entityType || 'Included as plan or network entity')}</TableCell>
                        <TableCell>{valueOrDash(plan.payerID)}</TableCell>
                        <TableCell>{valueOrDash(plan.phone)}</TableCell>
                        <TableCell>{formatInsuranceType(plan.insuranceCode, plan.insuranceDescription)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {(eligibilityCheck.coverageDetails?.additionalPayers?.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>
                  Other / Additional Payers
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  These rows come from "Other or Additional Payor" benefit lines in the eligibility response.
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Benefit range</TableCell>
                      <TableCell>Plan sponsor</TableCell>
                      <TableCell>Plan network ID</TableCell>
                      <TableCell>Payer</TableCell>
                      <TableCell>Payer ID</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Insurance type</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eligibilityCheck.coverageDetails?.additionalPayers?.map((payer, index) => (
                      <TableRow key={`additional-payer-${index}`}>
                        <TableCell>{formatBenefitRange(payer.benefitRange)}</TableCell>
                        <TableCell>{valueOrDash(payer.planSponsor)}</TableCell>
                        <TableCell>{valueOrDash(payer.planNetworkId)}</TableCell>
                        <TableCell>{valueOrDash(payer.payerName)}</TableCell>
                        <TableCell>{valueOrDash(payer.payerID)}</TableCell>
                        <TableCell>{valueOrDash(payer.payerRole)}</TableCell>
                        <TableCell>{formatInsuranceType(payer.insuranceCode, payer.insuranceDescription)}</TableCell>
                        <TableCell>{valueOrDash(payer.notes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>

          {/* Error Details Section */}
          {(hasErrors || hasFailedStatus) && (
            <Paper
              sx={{
                p: 3,
                backgroundColor: otherColors.eligibilityErrorBg,
                border: `1px solid ${otherColors.eligibilityErrorBorder}`,
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Error Details
              </Typography>

              {hasErrors && errorDetails && (
                <Box sx={{ mb: 2 }}>
                  {errorDetails.map((error, index) => (
                    <Box key={index} sx={{ mb: 1, borderRadius: 1 }}>
                      {error.code && <Typography variant="body2">Error Code: {error.code}</Typography>}
                      {error.text && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          Error Message: {error.text}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {hasFailedStatus && !hasErrors && (
                <Box sx={{ p: 2, backgroundColor: '#fff5f5', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#7f1d1d' }}>
                    {eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked
                      ? 'The eligibility check could not be performed. This may be due to a system error, network issue, or missing information.'
                      : "The eligibility check was performed but did not confirm coverage. Please verify the patient's insurance information and try again."}
                  </Typography>
                </Box>
              )}

              {rawErrorResponse && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Technical Details:
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      backgroundColor: '#f9fafb',
                      borderRadius: 1,
                      border: '1px solid #e5e7eb',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {typeof rawErrorResponse === 'string'
                        ? rawErrorResponse
                        : JSON.stringify(rawErrorResponse, null, 2)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
            Payment Benefits
          </Typography>

          <TabContext value={currentTab}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <TabList onChange={(event, newValue) => setCurrentTab(newValue)} aria-label="benefits">
                <Tab label="Co-Pay" value="copay-tab" />
                <Tab label="Co-Insurance" value="coinsurance-tab" />
                <Tab label="Benefit Context" value="benefit-context-tab" />
              </TabList>
            </Box>
            <TabPanel value="copay-tab" sx={{ padding: 0 }}>
              <BenefitsTable benefits={copayBenefits.filter((benefit) => benefit.coverageCode === 'B')} />
            </TabPanel>
            <TabPanel value="coinsurance-tab" sx={{ padding: 0 }}>
              <BenefitsTable benefits={copayBenefits.filter((benefit) => benefit.coverageCode === 'A')} />
            </TabPanel>
            <TabPanel value="benefit-context-tab" sx={{ padding: 0 }}>
              <BenefitContextTable benefits={benefitContextRows} />
            </TabPanel>
          </TabContext>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

const BenefitsTable: FC<{ benefits: PatientPaymentBenefit[] }> = ({ benefits }): JSX.Element => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Code</TableCell>
          <TableCell>Benefit Description</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Period</TableCell>
          <TableCell>Notes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {benefits.map((benefit, index) => (
          <TableRow key={index}>
            <TableCell>{benefit.code || '—'}</TableCell>
            <TableCell>{benefit.description || 'N/A'}</TableCell>
            <TableCell>
              <Chip
                label={formatNetworkStatus(benefit.inPlanNetworkCode)}
                sx={{
                  ...networkChipColors(benefit.inPlanNetworkCode),
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                  padding: '0 9px',
                  height: '24px',
                  '& .MuiChip-label': {
                    padding: 0,
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                  },
                }}
              />
            </TableCell>
            <TableCell>{formatBenefitAmount(benefit)}</TableCell>
            <TableCell>{benefit.periodDescription}</TableCell>
            <TableCell>{valueOrDash(benefit.benefitNotes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const BenefitContextTable: FC<{ benefits: PatientPaymentBenefit[] }> = ({ benefits }): JSX.Element => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Service</TableCell>
          <TableCell>Code</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Period</TableCell>
          <TableCell>Network</TableCell>
          <TableCell>Notes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {benefits.map((benefit, index) => (
          <TableRow key={`context-${index}`}>
            <TableCell>{benefit.description || '—'}</TableCell>
            <TableCell>{benefit.code || '—'}</TableCell>
            <TableCell>{benefit.coverageDescription || '—'}</TableCell>
            <TableCell>{formatBenefitAmount(benefit)}</TableCell>
            <TableCell>{valueOrDash(benefit.periodDescription)}</TableCell>
            <TableCell>{formatNetworkStatus(benefit.inPlanNetworkCode)}</TableCell>
            <TableCell>{valueOrDash(benefit.benefitNotes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
