import { Schedule } from '@mui/icons-material';
import { Button, CircularProgress, Divider, Link, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUCZambdaClient, ErrorDialog, PageForm } from 'ui-components';
import { VisitType } from 'utils';
import { zapehrApi } from '../api';
import { intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { WaitingEstimateCard } from '../components/WaitingEstimateCard';
import { useCheckOfficeOpen } from '../hooks/useCheckOfficeOpen';
import { usePreserveQueryParams } from '../hooks/usePreserveQueryParams';
import { ottehrLightBlue } from '../telemed/assets';
import { t } from 'i18next';
import BookingHome from './Welcome';

const WalkinHome: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const [pageNotFound, setPageNotFound] = useState(false);
  if (pageNotFound) {
    return (
      <PageContainer title={t('welcome.errors.notFound.title')}>
        <Typography variant="body1">
          {t('welcome.errors.notFound.description')}{' '}
          <a href="https://ottehr.com/find-care/">{t('welcome.errors.notFound.link')}</a>.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title}
      subtitle={locationLoading ? t('welcome.loading') : `${selectedLocation?.name}`}
      subtext={locationLoading ? '' : subtext}
      isFirstPage
      img={ottehrLightBlue}
      imgAlt="ottehr icon"
      imgWidth={150}
      topOutsideCardComponent={
        visitTypeParam === VisitType.PreBook && officeOpen ? (
          <WaitingEstimateCard waitingMinutes={waitingMinutes} />
        ) : undefined
      }
    >
      {visitTypeParam === VisitType.PreBook && (
        <>
          <Schedule
            slotsLoading={locationLoading}
            slotData={allAvailableSlots.map((si) => si.slot)}
            timezone={selectedLocation?.timezone || 'America/New_York'}
            existingSelectedSlot={slotData?.find((si) => si.slot.id && si.slot.id === selectedSlot)?.slot}
            handleSlotSelected={(slot) => {
              setSelectedSlot(slot.id);
              navigate(
                preserveQueryParams(`/${scheduleType}/${slugParam}/${visitTypeParam}/${serviceTypeParam}/get-ready`),
                {
                  state: { waitingTime: waitingMinutes?.toString() },
                }
              );
            }}
            forceClosedToday={officeHasClosureOverrideToday}
            forceClosedTomorrow={officeHasClosureOverrideTomorrow}
          />
          <Divider sx={{ marginTop: 3, marginBottom: 3 }} />
          <Typography variant="h4" color={theme.palette.primary.main}>
            {t('welcome.dontSeeTime')}
          </Typography>
        </>
      )}
      {visitTypeParam === VisitType.WalkIn &&
        (!locationLoading ? (
          walkinOpen ? (
            <>
              <Typography variant="body1" marginTop={2}>
                {t('welcome.walkinOpen.title')}
              </Typography>
              <PageForm
                onSubmit={(_) => {
                  if (!isAuthenticated) {
                    // if the user is not signed in, redirect them to auth0
                    loginWithRedirect({
                      appState: {
                        target: preserveQueryParams(
                          `/${scheduleType}/${slugParam}/${visitTypeParam}/${serviceTypeParam}/patients`
                        ),
                      },
                    }).catch((error) => {
                      throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
                    });
                  } else {
                    // if the location has loaded and the user is signed in, redirect them to the landing page
                    navigate(intakeFlowPageRoute.Homepage.path);
                  }
                }}
                controlButtons={{ backButton: false }}
              />
              <ErrorDialog
                open={errorConfig != undefined}
                title={errorConfig?.title ?? ''}
                description={errorConfig?.description ?? ''}
                closeButtonText={errorConfig?.closeButtonText ?? 'OK'}
                handleClose={() => {
                  setErrorConfig(undefined);
                }}
              />
            </>
          ) : (
            <>
              <Typography variant="body1" marginTop={1}>
                {t('welcome.errors.closed.description')}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2.5 }}>
                <Link to="https://ottehr.com" aria-label="Ottehr website" target="_blank">
                  <Button variant="contained" color="primary">
                    {t('welcome.goToWebsite')}
                  </Button>
                </Link>
              </Box>
            </>
          )
        ) : (
          <CircularProgress />
        ))}
    </PageContainer>
  );
};
