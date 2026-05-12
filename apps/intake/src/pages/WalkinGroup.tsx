import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { generatePath, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  APIError,
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  CreateSlotParams,
  isApiError,
  PROJECT_WEBSITE,
  ScheduleType,
  ServiceCategoryCodeSchema,
  ServiceMode,
} from 'utils';
import { ottehrApi } from '../api';
import { BOOKING_SERVICE_CATEGORY_PARAM, BOOKING_SERVICE_MODE_PARAM, bookingBasePath } from '../App';
import { getPrimaryIconContainerProps, PRIMARY_ICON_PAGE } from '../branding/primaryIconVisibility';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { useGetSchedule } from '../telemed/features/appointments/appointment.queries';
import { useOystehrAPIClient } from '../telemed/utils';

/**
 * Group walk-in landing.
 *
 * URL pattern: /walkin/<mode>?bookingOn=<group-slug>&scheduleType=group&serviceCategory=<code>&atLocation=<location-slug>
 *
 * Per FR-19/FR-22, a group walk-in is "prebook for now": stamp `start = now`,
 * skip slot feasibility, skip provider feasibility, let the front desk handle
 * assignment and capacity at check-in. The page calls get-schedule once to
 * confirm the group is reachable and to extract a member Schedule id we can
 * attach the walk-in Slot to (FHIR requires Slots reference a Schedule). If no
 * member is in working hours right now, get-schedule returns no slots and the
 * page treats the practice as closed for this service.
 */
export const WalkinGroup: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pathParams = useParams();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const apiClient = useOystehrAPIClient({ tokenless: true });
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const bookingOn = searchParams.get('bookingOn');
  const scheduleTypeFromParam = searchParams.get('scheduleType') as ScheduleType | null;
  const serviceCategoryRaw = searchParams.get(BOOKING_SERVICE_CATEGORY_PARAM);
  const serviceCategory = ServiceCategoryCodeSchema.safeParse(serviceCategoryRaw)?.data;
  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM] as ServiceMode | undefined;
  const serviceMode = serviceModeFromParam ?? ServiceMode['in-person'];

  const { data: scheduleData, isLoading } = useGetSchedule(
    apiClient,
    Boolean(apiClient) && Boolean(bookingOn) && Boolean(scheduleTypeFromParam),
    {
      slug: bookingOn ?? '',
      scheduleType: scheduleTypeFromParam ?? ScheduleType.group,
      serviceCategoryCode: serviceCategory,
    }
  );

  // Pick any slot the patient could have prebooked today; we'll reuse its
  // scheduleId as the Schedule the walk-in Slot attaches to and its
  // (end - start) as the walk-in duration (the service's configured length).
  // The walk-in Slot is created off-cadence at `now` (FR-15) so the displayed
  // start time is literally the moment the patient confirms.
  const candidateSlot = scheduleData?.available?.[0] ?? scheduleData?.telemedAvailable?.[0];
  const candidateScheduleId = candidateSlot?.slot.schedule?.reference?.split('/')[1];
  const candidateLengthInMinutes = (() => {
    if (!candidateSlot?.slot.start || !candidateSlot?.slot.end) return undefined;
    const ms =
      DateTime.fromISO(candidateSlot.slot.end).toMillis() - DateTime.fromISO(candidateSlot.slot.start).toMillis();
    return ms > 0 ? Math.round(ms / 60000) : undefined;
  })();
  const groupOpen = Boolean(candidateScheduleId);

  const handleConfirm = async (): Promise<void> => {
    if (!tokenlessZambdaClient || !candidateScheduleId) return;
    setSubmitting(true);
    try {
      const questionnaireCanonical =
        serviceMode === ServiceMode.virtual
          ? BOOKING_CONFIG.virtualQuestionnaireCanonical
          : BOOKING_CONFIG.inPersonQuestionnaireCanonical;

      const createSlotInput: CreateSlotParams = {
        scheduleId: candidateScheduleId,
        startISO: DateTime.now().toISO(),
        serviceModality: serviceMode,
        lengthInMinutes: candidateLengthInMinutes ?? 15,
        status: 'busy-tentative',
        walkin: true,
        ...(serviceCategory ? { serviceCategoryCode: serviceCategory } : {}),
        ...(questionnaireCanonical && { questionnaireCanonical }),
      };

      const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
      const basePath = generatePath(bookingBasePath, { slotId: slot.id! });
      navigate(`${basePath}/patients`);
    } catch (error) {
      console.error('Group walk-in failed:', error);
      let message = 'Sorry, something went wrong. Please proceed to the front desk to check in.';
      if (isApiError(error)) message = (error as APIError).message;
      setErrorConfig({ title: 'Walk-in error', description: message, closeButtonText: 'OK' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingOn || !scheduleTypeFromParam) {
    return (
      <PageContainer title="Welcome">
        <Typography variant="body1">This walk-in link is missing required information.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={isLoading ? 'Loading…' : 'Welcome'}
      subtitle={isLoading ? '' : scheduleData?.location?.name ?? ''}
      isFirstPage
      {...getPrimaryIconContainerProps(PRIMARY_ICON_PAGE.WALKIN_LANDING)}
    >
      {isLoading ? (
        <CircularProgress />
      ) : groupOpen ? (
        <>
          <Typography variant="body1" marginTop={2}>
            Tap below to walk in now. We'll start your visit at the current time.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2.5 }}>
            <Button variant="contained" color="secondary" onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? 'Checking in…' : 'Walk in now'}
            </Button>
          </Box>
          <ErrorDialog
            open={errorConfig !== undefined}
            title={errorConfig?.title ?? ''}
            description={errorConfig?.description ?? ''}
            closeButtonText={errorConfig?.closeButtonText ?? 'OK'}
            handleClose={() => setErrorConfig(undefined)}
          />
        </>
      ) : (
        <>
          <Typography variant="body1" marginTop={1}>
            No providers are currently available for walk-in. Please try again during open hours.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2.5 }}>
            <a href={PROJECT_WEBSITE} aria-label={`${BRANDING_CONFIG.projectName} website`} target="_blank">
              <Button variant="contained" color="secondary">
                Go to {BRANDING_CONFIG.projectName} website
              </Button>
            </a>
          </Box>
        </>
      )}
    </PageContainer>
  );
};
