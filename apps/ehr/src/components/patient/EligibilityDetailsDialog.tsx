import { Close } from '@mui/icons-material';
import { Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, Paper, Typography } from '@mui/material';
import { FC } from 'react';
import {
  CoverageCheckWithDetails,
  EligibilityCheckSimpleStatus,
  InsuranceEligibilityCheckStatus,
  PatientPaymentBenefit,
} from 'utils';

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
  const amountInUSD = benefit.amountInUSD;
  const percentage = benefit.percentage;

  // Match CopayWidget logic
  if (benefit.coverageCode === 'A') {
    // Coinsurance - prefer percentage
    if (typeof percentage === 'number' && percentage > 0) {
      return `${percentage}%`;
    } else if (typeof amountInUSD === 'number' && amountInUSD > 0) {
      return `$${amountInUSD.toFixed(2)}`;
    } else {
      return '0%';
    }
  } else {
    // Copay - prefer dollar amount
    if (typeof amountInUSD === 'number' && amountInUSD > 0) {
      return `$${amountInUSD.toFixed(2)}`;
    } else if (typeof percentage === 'number' && percentage > 0) {
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
  if (!eligibilityCheck) {
    return null;
  }

  const statusDisplay = getStatusDisplay(eligibilityCheck.status);
  const copayBenefits = eligibilityCheck.copay || [];

  const hasErrors = errorDetails && errorDetails.length > 0;
  const hasFailedStatus =
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked ||
    eligibilityCheck.status === InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;

  // Show benefits if we have valid benefits, regardless of eligibility status (to match CopayWidget behavior)
  const hasValidBenefits =
    copayBenefits.length > 0 &&
    copayBenefits.some(
      (benefit) =>
        benefit &&
        ((benefit.amountInUSD && typeof benefit.amountInUSD === 'number') ||
          (benefit.percentage && typeof benefit.percentage === 'number'))
    );

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
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Status Information
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                  Current Status
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, color: statusDisplay.color }}>
                  {simpleStatus || statusDisplay.text}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                  Last Checked
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {formatDate(eligibilityCheck.dateISO)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Error Details Section */}
          {(hasErrors || hasFailedStatus) && (
            <Paper sx={{ p: 3, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#dc2626' }}>
                Error Details
              </Typography>

              {hasErrors && errorDetails && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Eligibility Check Errors:
                  </Typography>
                  {errorDetails.map((error, index) => (
                    <Box key={index} sx={{ mb: 1, p: 2, backgroundColor: '#fff5f5', borderRadius: 1 }}>
                      {error.code && (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626' }}>
                          Error Code: {error.code}
                        </Typography>
                      )}
                      {error.text && (
                        <Typography variant="body2" sx={{ mt: 0.5, color: '#7f1d1d' }}>
                          {error.text}
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

          {/* Benefits Section */}
          {hasValidBenefits && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Payment Benefits
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {copayBenefits
                  .filter((benefit) => {
                    const isValid =
                      benefit && (typeof benefit.amountInUSD === 'number' || typeof benefit.percentage === 'number');
                    if (!isValid) {
                      console.log('Filtered out benefit:', benefit);
                    }
                    return isValid;
                  })
                  .map((benefit, index) => (
                    <Box key={index} sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 2 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 1 }}>
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            Type
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {benefit.coverageCode === 'B' ? 'Copay' : 'Coinsurance'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            Amount
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatBenefitAmount(benefit)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            Network
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {benefit.inNetwork ? 'In-Network' : 'Out-of-Network'}
                          </Typography>
                        </Box>
                      </Box>
                      {benefit.description && (
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            Description
                          </Typography>
                          <Typography variant="body2">{benefit.description}</Typography>
                        </Box>
                      )}
                      {benefit.coverageDescription && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            Coverage Description
                          </Typography>
                          <Typography variant="body2">{benefit.coverageDescription}</Typography>
                        </Box>
                      )}
                      {index < copayBenefits.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  ))}
              </Box>
            </Paper>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
