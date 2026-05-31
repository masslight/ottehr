import LoadingButton from '@mui/lab/LoadingButton';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { getPrimaryIconContainerProps, PRIMARY_ICON_PAGE } from '../../branding/primaryIconVisibility';
import { getWelcomeTitle } from '../../branding/welcomeTitle';
import { dataTestIds } from '../../helpers/data-test-ids';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { CustomContainer } from '../features/common';
const Welcome = ({ showEmergencyBanner = true }: { showEmergencyBanner?: boolean }): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const onSubmit = (): void => {
    navigate(intakeFlowPageRoute.Homepage.path);
  };

  return (
    <CustomContainer
      title={getWelcomeTitle()}
      {...getPrimaryIconContainerProps(PRIMARY_ICON_PAGE.TELEMED_WELCOME)}
      isFirstPage={true}
      outsideCardComponent={showEmergencyBanner ? <EmergencyBanner /> : undefined}
    >
      <Typography variant="body1">{t('telemedWelcome.lookForward')}</Typography>
      <Typography variant="body1" sx={{ py: 1 }}>
        {t('telemedWelcome.intro')}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          color="secondary"
          size="large"
          className="next-button"
          type="submit"
          sx={{
            mt: 2,
          }}
          onClick={onSubmit}
          data-testid={dataTestIds.continueButton}
        >
          {t('telemedWelcome.continue')}
        </LoadingButton>
      </Box>
    </CustomContainer>
  );
};

export default Welcome;
