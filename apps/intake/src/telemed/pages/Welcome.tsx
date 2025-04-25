import LoadingButton from '@mui/lab/LoadingButton';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { CustomContainer } from '../features/common';
import { ottehrLightBlue } from '@theme/icons';
import { dataTestIds } from '../../helpers/data-test-ids';
import { PROJECT_NAME } from 'utils';
const Welcome = ({ showEmergencyBanner = true }: { showEmergencyBanner?: boolean }): JSX.Element => {
  const navigate = useNavigate();

  const onSubmit = (): void => {
    navigate(intakeFlowPageRoute.AuthPage.path);
  };

  return (
    <CustomContainer
      title={`Welcome to ${PROJECT_NAME}`}
      img={ottehrLightBlue}
      imgAlt="Ottehr icon"
      imgWidth={150}
      isFirstPage={true}
      outsideCardComponent={showEmergencyBanner ? <EmergencyBanner /> : undefined}
    >
      <Typography variant="body1">We look forward to helping you soon!</Typography>
      <Typography variant="body1" sx={{ py: 1 }}>
        Please click on Continue to proceed to a page where you will enter your phone number. We’ll verify if we have
        your information already. If we do, we will pre-fill your past information for a faster booking.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          color="primary"
          size="large"
          className="next-button"
          type="submit"
          sx={{
            mt: 2,
          }}
          onClick={onSubmit}
          data-testid={dataTestIds.continueButton}
        >
          Continue
        </LoadingButton>
      </Box>
    </CustomContainer>
  );
};

export default Welcome;
