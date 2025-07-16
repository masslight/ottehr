import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { ottehrLightBlue } from '@theme/icons';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { useQuery } from 'react-query';
import { generatePath, Link, useNavigate, useParams } from 'react-router-dom';
import { APIError, CreateSlotParams, isApiError, PROJECT_NAME, PROJECT_WEBSITE, ServiceMode } from 'utils';
import { ottehrApi } from '../api';
import { bookingBasePath } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

export const WalkinLanding: FC = () => {
  const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: scheduleId, name } = useParams();
  const getWalkinAvailability = ottehrApi.getWalkinAvailability;
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const locationName = name ? name.replace('_', ' ') : undefined;
  const { data, error, isLoading, isFetching, isRefetching } = useQuery(
    ['walkin-check-availability', { zambdaClient: tokenlessZambdaClient, scheduleId, locationName }],
    () =>
      tokenlessZambdaClient && (scheduleId || locationName)
        ? getWalkinAvailability({ scheduleId, locationName }, tokenlessZambdaClient)
        : null,
    {
      onSuccess: (response) => {
        console.log('Walkin availability response:', response);
      },
      enabled: Boolean(scheduleId || locationName) && Boolean(tokenlessZambdaClient),
    }
  );
  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching;

  // todo: actually check error type
  const pageNotFound = error && isRefetching === false && !isLoading && !isFetching;
  if (pageNotFound) {
    return (
      <PageContainer title={t('welcome.errors.notFound.title')}>
        <Typography variant="body1">
          {t('welcome.errors.notFound.description')} <a href={PROJECT_WEBSITE}>{t('welcome.errors.notFound.link')}</a>.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={somethingIsLoadingInSomeWay ? 'Loading...' : 'Welcome to Ottehr'} // todo: get some copy for this
      subtitle={somethingIsLoadingInSomeWay ? '' : data?.scheduleOwnerName ?? ''}
      isFirstPage
      img={ottehrLightBlue}
      imgAlt={`${PROJECT_NAME} icon`}
      imgWidth={150}
    >
      {!somethingIsLoadingInSomeWay && data ? (
        data.walkinOpen ? (
          <>
            <Typography variant="body1" marginTop={2}>
              {t('welcome.walkinOpen.title')}
            </Typography>
            <PageForm
              onSubmit={async (_) => {
                if (tokenlessZambdaClient && data.scheduleId) {
                  const createSlotInput: CreateSlotParams = {
                    scheduleId: data.scheduleId,
                    startISO: DateTime.now().toISO(),
                    serviceModality: data.serviceMode ?? ServiceMode['in-person'],
                    lengthInMinutes: 15,
                    status: 'busy-tentative',
                    walkin: true,
                  };
                  try {
                    const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
                    const basePath = generatePath(bookingBasePath, {
                      slotId: slot.id!,
                    });
                    navigate(`${basePath}/patients`);
                  } catch (error) {
                    console.error('Error creating slot:', error);
                    let errorMessage = 'Sorry, something went wrong. Please proceed to the front desk to check in.';
                    if (isApiError(error)) {
                      errorMessage = (error as APIError).message;
                    }
                    setErrorConfig({
                      title: 'Error starting virtual visit',
                      description: errorMessage,
                      closeButtonText: 'Ok',
                    });
                  }
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
              <Link to={PROJECT_WEBSITE} aria-label={`${PROJECT_NAME} website`} target="_blank">
                <Button variant="contained" color="primary" data-testid="loading-button">
                  {t('welcome.goToWebsite', { PROJECT_NAME })}
                </Button>
              </Link>
            </Box>
          </>
        )
      ) : (
        <CircularProgress />
      )}
    </PageContainer>
  );
};
