import { useAuth0 } from '@auth0/auth0-react';
import { Box, List, ListItem, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageForm } from 'ui-components';
import { ServiceMode, VisitType } from 'utils';
import { BOOKING_SERVICE_MODE_PARAM, BOOKING_SLUG_PARAMS, BOOKING_VISIT_TYPE_PARAM } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { PageContainer } from '../components';
import { WaitingEstimateCard } from '../components/WaitingEstimateCard';
import { getStartingPath } from '../helpers';
import { useCheckOfficeOpen } from '../hooks/useCheckOfficeOpen';
import { usePreserveQueryParams } from '../hooks/usePreserveQueryParams';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useBookingContext } from './Welcome';

const GetReadyForVisit = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const {
    [BOOKING_SLUG_PARAMS]: slugParam,
    [BOOKING_VISIT_TYPE_PARAM]: visitTypeParam,
    [BOOKING_SERVICE_MODE_PARAM]: serviceTypeParam,
  } = useParams();
  const visitType = (visitTypeParam || VisitType.PreBook) as VisitType;
  const serviceType = (serviceTypeParam || ServiceMode['in-person']) as ServiceMode;

  const waitingMinutes = location.state && parseInt(location.state.waitingTime);
  const { selectedLocation } = useBookingContext();
  const preserveQueryParams = usePreserveQueryParams();

  const { officeOpen } = useCheckOfficeOpen(selectedLocation);

  const onSubmit = async (): Promise<void> => {
    if (!isAuthenticated) {
      loginWithRedirect({
        appState: {
          target: preserveQueryParams(`${getStartingPath(slugParam, visitType, serviceType)}/patients`),
        },
      }).catch((error) => {
        throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
      });
    } else {
      navigate(`${getStartingPath(slugParam, visitType, serviceType)}/patients`);
    }
  };

  useTrackMixpanelEvents({
    eventName: 'Get Ready For Visit',
    visitType: visitType,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  return (
    <PageContainer
      title={t('getReady.title')}
      imgWidth={150}
      topOutsideCardComponent={
        visitTypeParam === VisitType.PreBook && officeOpen ? (
          <WaitingEstimateCard waitingMinutes={waitingMinutes} />
        ) : undefined
      }
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
            {t('getReady.subtitle')}
          </Typography>
          <List sx={{ listStyleType: 'disc', marginLeft: 3 }}>
            <ListItem sx={{ display: 'list-item', paddingLeft: 0 }}>
              <Typography variant="body1">{t('getReady.body1')}</Typography>
            </ListItem>
            <ListItem sx={{ display: 'list-item', paddingLeft: 0 }}>
              <Typography variant="body1">{t('getReady.body2')}</Typography>
            </ListItem>
          </List>
        </Box>
        <Box>
          <Typography variant="body2" color={theme.palette.text.primary} marginTop={1}>
            {t('getReady.body3')}
          </Typography>
        </Box>
      </>
      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false }} />
    </PageContainer>
  );
};

export default GetReadyForVisit;
