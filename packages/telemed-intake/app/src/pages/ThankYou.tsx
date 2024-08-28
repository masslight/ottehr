import { Box, Button, Divider, Typography, useTheme } from '@mui/material';
import { EventBusyOutlined } from '@mui/icons-material';
import { useTranslation, Trans } from 'react-i18next';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { otherColors } from '../IntakeThemeProvider';
import { getSelectors } from 'ottehr-utils';
import { useAppointmentStore } from '../features/appointments';
import { DateTime } from 'luxon';
import { FinancialPolicyDialog } from '../components/FinancialPolicyDialog';
import { useState } from 'react';
import { CancelVisitDialog } from '../components';
import { ottehrThankYou } from '@theme/icons';

const ThankYou = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const { selectedSlot } = getSelectors(useAppointmentStore, ['selectedSlot']);

  const formattedDate = selectedSlot ? DateTime.fromISO(selectedSlot).toFormat('MMMM d, h:mm a') : '';
  return (
    <CustomContainer
      title={t('thankYou.title')}
      description={t('thankYou.description')}
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
    >
      <>
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', marginTop: 2, marginBottom: 2, gap: 2 }}>
          <Box>
            <img src={ottehrThankYou} alt="Clock icon" width="90px" />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle1" color="text.primary">
              {t('thankYou.checkInBookedTime')}
            </Typography>
            <Typography variant="h3" color="secondary" mt={0.5}>
              {formattedDate}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ marginBottom: 2 }} />

        {isCancelDialogOpen && <CancelVisitDialog onClose={() => setIsCancelDialogOpen(false)} />}
        <Button
          startIcon={<EventBusyOutlined color="secondary" />}
          sx={{ marginLeft: 1.5, color: theme.palette.secondary.main }}
          onClick={() => setIsCancelDialogOpen(true)}
        >
          {t('general.button.cancel')}
        </Button>

        <Typography variant="body2" marginTop={2}>
          {t('thankYou.confirmationMessage')}
        </Typography>
        <div
          style={{
            backgroundColor: otherColors.lightBlue,
            padding: 17,
            borderRadius: 8,
            marginTop: 25,
            marginBottom: 25,
          }}
        >
          <Typography variant="body2">
            {t('thankYou.insurancePolicy')}
            <span
              style={{ cursor: 'pointer', color: theme.palette.primary.main, textDecoration: 'underline' }}
              onClick={() => setIsPolicyDialogOpen(true)}
            >
              {t('thankYou.insurancePolicyLinkText')}
            </span>
            .
          </Typography>
        </div>

        <Trans i18nKey="thankYou.contactUs" />
        {isPolicyDialogOpen && <FinancialPolicyDialog onClose={() => setIsPolicyDialogOpen(false)} />}
      </>
    </CustomContainer>
  );
};

export default ThankYou;
