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
import { FC, useState } from 'react';
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
  
  // Filter copay benefits for the view details popup
  // Filter by: benefit_coverage_code=B, benefit_level_code=IND, benefit_code=UC
  const copayBenefits = eligibilityCheck.copay?.filter((benefit) => {
    const isCopay = benefit.coverageCode === 'B';
    const isIndividualLevel = benefit.levelCode === 'IND';
    const isUrgentCare = benefit.code === 'UC';
    
    return isCopay && isIndividualLevel && isUrgentCare;
  }) || [];

  const hasErrors = errorDetails && errorDetails.length > 0;
  const hasFailedStatus =
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked ||
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;

  function formatName(firstName?: string, middleName?: string, lastName?: string): string {
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
            <Grid container>
              <Grid item xs={6}>
                <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
                  Subscriber
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      First name, last name
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">
                      {formatName(
                        eligibilityCheck.coverageDetails?.subscriber?.firstName,
                        eligibilityCheck.coverageDetails?.subscriber?.middleName,
                        eligibilityCheck.coverageDetails?.subscriber?.lastName
                      )}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Member ID
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.subscriber?.memberID}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      DOB
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.subscriber?.dateOfBirth}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Address
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.subscriber?.address}</Typography>
                  </Grid>
                </Grid>
                <Typography variant="h5" sx={{ color: theme.palette.primary.dark, marginTop: '30px' }}>
                  Patient
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      First name, last name
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">
                      {formatName(
                        eligibilityCheck.coverageDetails?.patient?.firstName,
                        eligibilityCheck.coverageDetails?.patient?.middleName,
                        eligibilityCheck.coverageDetails?.patient?.lastName
                      )}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      DOB
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.patient?.dateOfBirth}</Typography>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
                  Insurance/Plan
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Plan number
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.insurance?.planNumber}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Policy number
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.insurance?.policyNumber}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Insurance type
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">
                      {eligibilityCheck.coverageDetails?.insurance?.insuranceCode} -{' '}
                      {eligibilityCheck.coverageDetails?.insurance?.insuranceDescription}
                    </Typography>
                  </Grid>
                </Grid>
                <Typography variant="h5" sx={{ color: theme.palette.primary.dark, marginTop: '30px' }}>
                  Payer
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Name of the payer
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Payer ID
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.payerID}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Address
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.address}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Website
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.website}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Phone
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.phone}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ color: theme.palette.primary.dark }}>
                      Fax
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">{eligibilityCheck.coverageDetails?.payer?.fax}</Typography>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
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
                <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                  Last checked {formatDate(eligibilityCheck.dateISO)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Error Details Section */}
          {(hasErrors || hasFailedStatus) && (
            <Paper sx={{ p: 3, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
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
              </TabList>
            </Box>
            <TabPanel value="copay-tab" sx={{ padding: 0 }}>
              <BenefitsTable benefits={copayBenefits.filter((benefit) => benefit.coverageCode === 'B')} />
            </TabPanel>
            <TabPanel value="coinsurance-tab" sx={{ padding: 0 }}>
              <BenefitsTable benefits={copayBenefits.filter((benefit) => benefit.coverageCode === 'A')} />
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
          <TableCell>Benefit Description</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Period</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {benefits.map((benefit, index) => (
          <TableRow key={index}>
            <TableCell>{benefit.description || 'N/A'}</TableCell>
            <TableCell>
              <Chip
                label={benefit.inNetwork ? 'In Network' : 'Out of Network'}
                sx={{
                  backgroundColor: benefit.inNetwork ? '#C8E6C9' : '#FECDD2',
                  textTransform: 'uppercase',
                  color: benefit.inNetwork ? '#1B5E20' : '#B71C1C',
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
