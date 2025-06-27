import { useAuth0 } from '@auth0/auth0-react';
import { Box, List, ListItem, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';
import { VisitType } from 'utils';
import { PageContainer } from '../components';
import PageForm from '../components/PageForm';
import { WaitingEstimateCard } from '../components/WaitingEstimateCard';
import { usePreserveQueryParams } from '../hooks/usePreserveQueryParams';
import { otherColors } from '../IntakeThemeProvider';
import { useBookingContext } from './BookingHome';

const GetReadyForVisit = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  const waitingMinutes = location.state && parseInt(location.state.waitingTime);
  const { slotId, visitType } = useBookingContext();
  const preserveQueryParams = usePreserveQueryParams();

  const onSubmit = async (): Promise<void> => {
    const solvedPath = generatePath(slotId, {
      slotId,
    });
    if (!isAuthenticated && slotId) {
      loginWithRedirect({
        appState: {
          target: preserveQueryParams(`${solvedPath}/patients`),
        },
      }).catch((error) => {
        throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
      });
    } else {
      navigate(`${solvedPath}/patients`);
    }
  };

  return (
    <PageContainer
      title={t('getReady.title')}
      imgWidth={150}
      topOutsideCardComponent={
        // todo: previously this only was displayed when the office was open,
        // but it seems waiting minutes shouldn't be defined in cases where the office is closed
        // so that additional check should not be needed. currently it looks like waiting minutes will never
        // be written to the location state being checked here and this will never show.
        visitType === VisitType.PreBook && waitingMinutes !== undefined ? (
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
