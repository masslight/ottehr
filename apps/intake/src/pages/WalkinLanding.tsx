import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { FC, useEffect, useMemo, useState } from 'react';
import { generatePath, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ottehrApi from 'src/api/ottehrApi';
import { PageContainer } from 'src/components/CustomContainer';
import { serviceCategorySupportsContext } from 'utils/lib/config-helpers/booking';
import { BOOKING_CONFIG } from 'utils/lib/ottehr-config/booking';
import { BRANDING_CONFIG, PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { CreateSlotParams } from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';
import { ServiceMode } from 'utils/lib/types/common';
import { APIError, APIErrorCode, isApiError } from 'utils/lib/types/errors';
import { WALKIN_SERVICE_MODE_QUERY_PARAM } from 'utils/lib/utils/scheduleUtils';
import { bookingBasePath } from '../App';
import { getPrimaryIconContainerProps, PRIMARY_ICON_PAGE } from '../branding/primaryIconVisibility';
import { getWelcomeTitle } from '../branding/welcomeTitle';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import { useServiceCategories } from '../hooks/useServiceCategories';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

export const WalkinLanding: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceCategory = searchParams.get('serviceCategory');
  const serviceModeParam = searchParams.get(WALKIN_SERVICE_MODE_QUERY_PARAM);
  const requestedServiceMode = Object.values(ServiceMode).find((mode) => mode === serviceModeParam);
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: scheduleId, name } = useParams();
  const getWalkinAvailability = ottehrApi.getWalkinAvailability;
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const locationName = name ? name.replaceAll('_', ' ') : undefined;
  const { data, error, isLoading, isFetching, isRefetching } = useQuery({
    queryKey: ['walkin-check-availability', scheduleId, locationName, requestedServiceMode],
    queryFn: () =>
      tokenlessZambdaClient && (scheduleId || locationName)
        ? getWalkinAvailability(
            { scheduleId, locationName, ...(requestedServiceMode ? { serviceMode: requestedServiceMode } : {}) },
            tokenlessZambdaClient
          )
        : null,
    enabled: Boolean(scheduleId || locationName) && Boolean(tokenlessZambdaClient),
  });

  // Branches when serviceCategory isn't in the URL: 0 walk-in-capable cats →
  // fall through (slot has no category; legacy zambda default kicks in);
  // 1 → silent auto-select; 2+ → redirect to picker. Closed location skips
  // all of this and goes straight to the "closed" message.
  const { serviceCategories, isLoading: isCategoriesLoading } = useServiceCategories({});

  const serviceMode = requestedServiceMode ?? data?.serviceMode ?? ServiceMode['in-person'];

  const walkinCapableCategories = useMemo(
    () => (serviceCategories ?? []).filter((sc) => serviceCategorySupportsContext(sc, serviceMode, 'walk-in')),
    [serviceCategories, serviceMode]
  );

  const categoryDecisionNeeded = !serviceCategory;
  const walkinIsOpen = data?.walkinOpen === true;
  const waitingForCategoryDecision = categoryDecisionNeeded && isCategoriesLoading && walkinIsOpen;

  const resolvedServiceCategory =
    serviceCategory ?? (walkinCapableCategories.length === 1 ? walkinCapableCategories[0].category.code : undefined);

  const needsPickerRedirect =
    categoryDecisionNeeded && !isCategoriesLoading && walkinCapableCategories.length >= 2 && walkinIsOpen;

  useEffect(() => {
    if (!needsPickerRedirect) return;

    // Mirror the entry URL shape so the picker's strip-and-return lands back here.
    const basePath = scheduleId
      ? `/walkin/schedule/${scheduleId}/select-service-category`
      : name
      ? `/walkin/location/${name}/select-service-category`
      : null;

    if (!basePath) return;

    // Pin the resolved mode so the picker filters categories for the same mode this page will book.
    const query = new URLSearchParams(searchParams);

    query.set(WALKIN_SERVICE_MODE_QUERY_PARAM, serviceMode);
    navigate(`${basePath}?${query.toString()}`, { replace: true });
  }, [needsPickerRedirect, scheduleId, name, searchParams, navigate, serviceMode]);

  // `needsPickerRedirect` is in here so PageForm doesn't briefly mount
  // before the useEffect navigation runs (race that would let a fast click
  // create a slot without picking a category).
  const somethingIsLoadingInSomeWay =
    isLoading || isFetching || isRefetching || waitingForCategoryDecision || needsPickerRedirect;

  // todo: actually check error type
  const pageNotFound = error && isRefetching === false && !isLoading && !isFetching;
  if (pageNotFound) {
    const unsupportedModeMessage =
      isApiError(error) && (error as APIError).code === APIErrorCode.SERVICE_MODE_NOT_AVAILABLE
        ? (error as APIError).message
        : undefined;

    return (
      <PageContainer title={t('welcome.errors.notFound.title')}>
        <Typography variant="body1">
          {unsupportedModeMessage ?? (
            <>
              {t('welcome.errors.notFound.description', { PROJECT_NAME: BRANDING_CONFIG.projectName })}{' '}
              <a href={PROJECT_WEBSITE}>{t('welcome.errors.notFound.link')}</a>.
            </>
          )}
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
