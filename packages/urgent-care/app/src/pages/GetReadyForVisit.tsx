import { useAuth0 } from '@auth0/auth0-react';
import { Box, List, ListItem, Typography, useTheme } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { CustomContainer } from '../components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { safelyCaptureException } from '../helpers/sentry';
import { PageForm } from 'ui-components';
import { WaitingEstimateCard } from '../components/WaitingEstimateCard';

const GetReadyForVisit = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const waitingMinutes = location.state && parseInt(location.state.waitingTime);

  const onSubmit = async (): Promise<void> => {
    if (!isAuthenticated) {
      loginWithRedirect().catch((error) => {
        safelyCaptureException(error);
        throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
      });
    } else {
      navigate(IntakeFlowPageRoute.WelcomeBack.path);
    }
  };

  useEffect(() => {
    mixpanel.track('GetReadyForVisit');
  }, []);

  const bgVariant = IntakeFlowPageRoute.WelcomeType.path;

  return (
    <CustomContainer
      title="Get ready for your visit"
      imgWidth={150}
      bgVariant={bgVariant}
      outsideCardComponent={<WaitingEstimateCard waitingMinutes={waitingMinutes} />}
    >
      <>
        <Box
          sx={{
            backgroundColor: otherColors.lightBlue,
            color: theme.palette.secondary.main,
            padding: 2,
            marginBottom: 3,
            borderRadius: '8px',
          }}
        >
          <Typography variant="h3" color={theme.palette.primary.main}>
            Booking your check-in saves you time!
          </Typography>
          <List sx={{ listStyleType: 'disc', marginLeft: 3, color: 'text.primary' }}>
            <ListItem sx={{ display: 'list-item', paddingLeft: 0 }}>
              <Typography variant="body1">
                This process allows you to complete registration in advance, from the comfort of home.
              </Typography>
            </ListItem>
            <ListItem sx={{ display: 'list-item', paddingLeft: 0 }}>
              <Typography variant="body1">
                While your check-in should not be viewed as an appointment, we make every effort to see patients as
                close to the time selected as possible.
              </Typography>
            </ListItem>
          </List>
        </Box>
        <Box>
          <Typography variant="body2" color={theme.palette.text.primary} marginTop={1}>
            {t('readyForVisit.bookingConfirmation.descriptionBodyOne')}
          </Typography>
          <Typography variant="body2" color={theme.palette.text.primary} marginTop={1}>
            {t('readyForVisit.bookingConfirmation.descriptionBodyTwo')}
          </Typography>
        </Box>
      </>
      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false }} />
    </CustomContainer>
  );
};

export default GetReadyForVisit;
