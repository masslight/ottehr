import {
  BarChart as BarChartIcon,
  ChevronRight as ChevronRightIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Paid as PaidIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, Collapse, Divider, Stack, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../themes/ottehr/colors';

interface ReportPlaceholder {
  id: string;
  name: string;
  purpose: string;
  cadence: string;
  ownerQuestion: string;
}

const reportPlaceholders: ReportPlaceholder[] = [
  {
    id: 'ar-aging',
    name: 'A/R Aging by Bucket',
    purpose: 'Track outstanding balances by aging windows (0-30, 31-60, 61-90, 90+ days).',
    cadence: 'Weekly',
    ownerQuestion: 'How much receivable risk is increasing month over month?',
  },
  {
    id: 'net-collections',
    name: 'Net Collections Trend',
    purpose: 'Compare collected dollars vs expected reimbursement over time.',
    cadence: 'Monthly',
    ownerQuestion: 'Are we collecting the revenue we are entitled to?',
  },
  {
    id: 'first-pass',
    name: 'First-Pass Claim Acceptance',
    purpose: 'Measure clean-claim acceptance rates before manual rework.',
    cadence: 'Daily',
    ownerQuestion: 'Are front-end claim edits reducing payer rejections?',
  },
  {
    id: 'denials-by-payer',
    name: 'Denial Rate by Payer',
    purpose: 'Break down denial volume and rate by payer and plan.',
    cadence: 'Weekly',
    ownerQuestion: 'Which payer relationships are creating the most friction?',
  },
  {
    id: 'charge-lag',
    name: 'Charge and Submission Lag',
    purpose: 'Monitor days from date of service to charge entry and claim submission.',
    cadence: 'Daily',
    ownerQuestion: 'Where are internal process bottlenecks delaying cash flow?',
  },
  {
    id: 'underpayments',
    name: 'Underpayment Opportunity',
    purpose: 'Identify claims paid below expected contracted amounts.',
    cadence: 'Weekly',
    ownerQuestion: 'What recoverable reimbursement is currently being missed?',
  },
  {
    id: 'patient-collections',
    name: 'Patient Collections Performance',
    purpose: 'Track patient-responsibility balances, collections, and collection velocity.',
    cadence: 'Monthly',
    ownerQuestion: 'Is patient A/R being converted to cash in a healthy timeframe?',
  },
  {
    id: 'write-offs',
    name: 'Adjustment and Write-Off Summary',
    purpose: 'Summarize contractual adjustments, bad debt, and manual write-offs.',
    cadence: 'Monthly',
    ownerQuestion: 'Are write-offs aligned with policy and expected benchmarks?',
  },
];

export default function Reports(): ReactElement {
  const navigate = useNavigate();
  const [showSuggested, setShowSuggested] = useState(false);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Reports
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          RCM reports for practice owner review.
        </Typography>
      </Box>

      <Box
        onClick={() => navigate('/reports/payments')}
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${otherColors.lightDivider}`,
          borderRadius: 2,
          px: 3,
          py: 2.5,
          mb: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          '&:hover': { bgcolor: otherColors.apptHover },
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'primary.dark',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <PaidIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color="primary.dark" fontWeight={600}>
              Payments Report
            </Typography>
            <Chip size="small" color="primary" variant="outlined" label="Available" sx={{ height: 20 }} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Dashboard of insurance payments from posted ERAs, grouped by payer: billed, allowed, paid, and check totals.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Button
        variant="text"
        size="small"
        onClick={() => setShowSuggested((v) => !v)}
        endIcon={showSuggested ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}
      >
        Suggested reports ({reportPlaceholders.length})
      </Button>

      <Collapse in={showSuggested}>
        <Box
          sx={{
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          {reportPlaceholders.map((report, index) => (
            <Box
              key={report.id}
              sx={{
                px: 2.5,
                py: 2,
                borderBottom:
                  index === reportPlaceholders.length - 1 ? 'none' : `1px solid ${otherColors.lightDivider}`,
                '&:hover': { bgcolor: otherColors.apptHover },
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                gap={1.5}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <BarChartIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography fontWeight={600} color="primary.dark">
                      {report.name}
                    </Typography>
                    <Chip size="small" color="default" label="Coming soon" sx={{ height: 20 }} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {report.purpose}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Owner question: {report.ownerQuestion}
                  </Typography>
                </Box>

                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip variant="outlined" size="small" label={`Cadence: ${report.cadence}`} />
                  <Button variant="text" size="small" disabled>
                    Open
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
