import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { FC, useEffect, useMemo, useState } from 'react';
import { generatePath, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  APIError,
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  CreateSlotParams,
  isApiError,
  PROJECT_WEBSITE,
  ServiceMode,
} from 'utils';
import { ottehrApi } from '../api';
import { bookingBasePath } from '../App';
import { getPrimaryIconContainerProps, PRIMARY_ICON_PAGE } from '../branding/primaryIconVisibility';
import { getWelcomeTitle } from '../branding/welcomeTitle';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import { useServiceCategories } from '../hooks/useServiceCategories';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

export const WalkinLanding: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceCategory = searchParams.get('serviceCategory');
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: scheduleId, name } = useParams();
  const getWalkinAvailability = ottehrApi.getWalkinAvailability;
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const locationName = name ? name.replaceAll('_', ' ') : undefined;
  const { data, error, isLoading, isFetching, isRefetching } = useQuery({
    queryKey: ['walkin-check-availability', scheduleId, locationName],
    queryFn: () =>
      tokenlessZambdaClient && (scheduleId || locationName)
        ? getWalkinAvailability({ scheduleId, locationName }, tokenlessZambdaClient)
        : null,
    enabled: Boolean(scheduleId || locationName) && Boolean(tokenlessZambdaClient),
  });

  // Service-category routing. Three outcomes once the catalog loads:
  //   - 0 walk-in-capable categories → fall through (legacy behavior: create
  //     the slot without a category so the schedule isn't broken until the
  //     admin configures one)
  //   - 1 walk-in-capable category → auto-select silently at slot creation
  //   - 2+ → redirect to the picker child route so the patient chooses
  // Skip the fetch + decision entirely when the URL already carries a
  // serviceCategory (the picker just sent us back here, or the EHR put it on
  // the link).
  const { serviceCategories, isLoading: isCategoriesLoading } = useServiceCategories({});
  const walkinCapableCategories = useMemo(
    () => (serviceCategories ?? []).filter((sc) => (sc.visitTypes ?? ['prebook']).includes('walk-in')),
    [serviceCategories]
  );
  const categoryDecisionNeeded = !serviceCategory;
  const waitingForCategoryDecision = categoryDecisionNeeded && isCategoriesLoading;
  const resolvedServiceCategory =
    serviceCategory ?? (walkinCapableCategories.length === 1 ? walkinCapableCategories[0].category.code : undefined);
  const needsPickerRedirect = categoryDecisionNeeded && !isCategoriesLoading && walkinCapableCategories.length >= 2;

  useEffect(() => {
    if (!needsPickerRedirect) return;
    // Mirror the entry URL shape so the picker's destination calculation
    // (strip `/select-service-category`, append `?serviceCategory=<code>`)
    // brings the patient back to this same page.
    const basePath = scheduleId
      ? `/walkin/schedule/${scheduleId}/select-service-category`
      : name
      ? `/walkin/location/${name}/select-service-category`
      : null;
    if (!basePath) return;
    // Preserve any other query params already on the URL (analytics, etc.).
    const query = searchParams.toString();
    navigate(`${basePath}${query ? `?${query}` : ''}`, { replace: true });
  }, [needsPickerRedirect, scheduleId, name, searchParams, navigate]);

  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || waitingForCategoryDecision;

  // todo: actually check error type
  const pageNotFound = error && isRefetching === false && !isLoading && !isFetching;
  if (pageNotFound) {
    return (
      <PageContainer title={t('welcome.errors.notFound.title')}>
        <Typography variant="body1">
          {t('welcome.errors.notFound.description', { PROJECT_NAME: BRANDING_CONFIG.projectName })}{' '}
          <a href={PROJECT_WEBSITE}>{t('welcome.errors.notFound.link')}</a>.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={somethingIsLoadingInSomeWay ? 'Loading...' : getWelcomeTitle()}
      subtitle={somethingIsLoadingInSomeWay ? '' : data?.scheduleOwnerName ?? ''}
      isFirstPage
      {...getPrimaryIconContainerProps(PRIMARY_ICON_PAGE.WALKIN_LANDING)}
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
                  const serviceMode = data.serviceMode ?? ServiceMode['in-person'];
                  // Use test questionnaire canonical if injected via config (for e2e test isolation)
                  const questionnaireCanonical =
                    serviceMode === ServiceMode.virtual
                      ? BOOKING_CONFIG.virtualQuestionnaireCanonical
                      : BOOKING_CONFIG.inPersonQuestionnaireCanonical;
                  const createSlotInput: CreateSlotParams = {
                    scheduleId: data.scheduleId,
                    startISO: DateTime.now().toISO(),
                    serviceModality: serviceMode,
                    lengthInMinutes: 15,
                    status: 'busy-tentative',
                    walkin: true,
                    ...(resolvedServiceCategory ? { serviceCategoryCode: resolvedServiceCategory } : {}),
                    ...(questionnaireCanonical && { questionnaireCanonical }),
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
              <Link to={PROJECT_WEBSITE} aria-label={`${BRANDING_CONFIG.projectName} website`} target="_blank">
                <Button variant="contained" color="secondary" data-testid="loading-button">
                  {t('welcome.goToWebsite', { PROJECT_NAME: BRANDING_CONFIG.projectName })}
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
