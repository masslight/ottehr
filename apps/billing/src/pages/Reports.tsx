import {
  AccountTree as AccountTreeIcon,
  ChevronRight as ChevronRightIcon,
  CreditCard as CreditCardIcon,
  Groups as GroupsIcon,
  Paid as PaidIcon,
  ReceiptLong as ReceiptLongIcon,
} from '@mui/icons-material';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../themes/ottehr/colors';

export default function Reports(): ReactElement {
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Reports
        </Typography>
      </Box>

      <Box
        component={ButtonBase}
        focusRipple
        onClick={() => navigate('/reports/payments')}
        sx={{
          width: '100%',
          textAlign: 'left',
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
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Dashboard of insurance payments from posted ERAs, grouped by payer: billed, allowed, paid, and check totals.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>

      <Box
        component={ButtonBase}
        focusRipple
        onClick={() => navigate('/reports/cards-on-file')}
        sx={{
          width: '100%',
          textAlign: 'left',
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
          <CreditCardIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color="primary.dark" fontWeight={600}>
              Credit Cards on File Report
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Every Stripe customer matched to their Oystehr patient: card-on-file status and last visit, filterable by
            card presence.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>

      <Box
        component={ButtonBase}
        focusRipple
        onClick={() => navigate('/reports/invoices')}
        sx={{
          width: '100%',
          textAlign: 'left',
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
          <ReceiptLongIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color="primary.dark" fontWeight={600}>
              Invoice Report
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            All due and past-due Stripe invoices, broken down by upcoming, past due without a card, and failed payments.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>

      <Box
        component={ButtonBase}
        focusRipple
        onClick={() => navigate('/reports/pipeline')}
        sx={{
          width: '100%',
          textAlign: 'left',
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
          <AccountTreeIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color="primary.dark" fontWeight={600}>
              Pipeline Report
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Overview of claims by AR stage and status across the insurance, patient, and non-insurance pipelines.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>

      <Box
        component={ButtonBase}
        focusRipple
        onClick={() => navigate('/reports/productivity')}
        sx={{
          width: '100%',
          textAlign: 'left',
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
          <GroupsIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color="primary.dark" fontWeight={600}>
              Productivity Report
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Claim actions by user: creates, updates, status changes, submits, and notes from the claim change history.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'action.disabled' }} />
      </Box>
    </Box>
  );
}
