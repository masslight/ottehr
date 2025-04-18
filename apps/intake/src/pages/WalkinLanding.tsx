// import { Schedule } from '@mui/icons-material';
import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUCZambdaClient, ErrorDialog, PageForm, ErrorDialogConfig } from 'ui-components';
import { zapehrApi } from '../api';
import { PageContainer } from '../components';
import { ottehrLightBlue } from '../telemed/assets';
import { t } from 'i18next';
import { useQuery } from 'react-query';

export const WalkinLanding: FC = () => {
  // const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const scheduleId = useParams().id;
  const getWalkinAvailability = zapehrApi.getWalkinAvailability;
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      {!somethingIsLoadingInSomeWay ? (
        data?.walkinOpen ? (
          <>
            <Typography variant="body1" marginTop={2}>
              {t('welcome.walkinOpen.title')}
            </Typography>
            <PageForm
              onSubmit={(_) => {
                /*if (!isAuthenticated) {
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
            }*/
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
      )}
    </PageContainer>
  );
};
