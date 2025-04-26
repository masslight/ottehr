// import { Schedule } from '@mui/icons-material';
import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { generatePath, Link, useNavigate, useParams } from 'react-router-dom';
import { useUCZambdaClient, ErrorDialog, PageForm, ErrorDialogConfig } from 'ui-components';
import { ottehrApi } from '../api';
import { PageContainer } from '../components';
import { t } from 'i18next';
import { useQuery } from 'react-query';
import { CreateSlotParams, ServiceMode } from 'utils';
import { DateTime } from 'luxon';
import { bookingBasePath } from '../App';
import { ottehrLightBlue } from '@theme/icons';

export const WalkinLanding: FC = () => {
  const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const scheduleId = useParams().id;
  const getWalkinAvailability = ottehrApi.getWalkinAvailability;
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const { data, error, isLoading, isFetching, isRefetching } = useQuery(
    ['walkin-check-availability', { zambdaClient: tokenlessZambdaClient, scheduleId }],
    () => (tokenlessZambdaClient && scheduleId ? getWalkinAvailability({ scheduleId }, tokenlessZambdaClient) : null),
    {
      onSuccess: (response) => {
        console.log('Walkin availability response:', response);
      },
      enabled: Boolean(scheduleId) && Boolean(tokenlessZambdaClient),
    }
  );
  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching;

  if (!somethingIsLoadingInSomeWay) {
    console.log('Walkin availability data:', data);
  }

  // todo: actuallly check error type
  const pageNotFound = error && isRefetching === false && !isLoading && !isFetching;
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
      title={"Hi I'm Walkin Home"}
      subtitle={somethingIsLoadingInSomeWay ? t('welcome.loading') : `SOME NAME TBD`}
      subtext={somethingIsLoadingInSomeWay ? '' : 'SOME TEXT TBD'}
      isFirstPage
      img={ottehrLightBlue}
      imgAlt="ottehr icon"
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
                if (tokenlessZambdaClient && scheduleId) {
                  const createSlotInput: CreateSlotParams = {
                    scheduleId,
                    startISO: DateTime.now().toISO(),
                    serviceModality: data.serviceMode as ServiceMode,
                    lengthInMinutes: 15,
                    status: 'busy-tentative',
                    walkin: true,
                  };
                  try {
                    const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
                    console.log('createSlotResponse', slot);
                    const basePath = generatePath(bookingBasePath, {
                      slotId: slot.id!,
                    });
                    navigate(`${basePath}/patients`);
                  } catch (error) {
                    console.error('Error creating slot:', error);
                    // todo: handle error
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
              <Link to="https://ottehr.com" aria-label="Ottehr website" target="_blank">
                <Button variant="contained" color="primary" data-testid="loadin-button">
                  {t('welcome.goToWebsite')}
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
