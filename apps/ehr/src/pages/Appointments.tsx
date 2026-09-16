import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import AppointmentsFilters from 'src/components/AppointmentsFilters';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useStopAmbientScribeOnLeave } from 'src/features/visits/shared/hooks/useStopAmbientScribeOnLeave';
import { TRACKING_BOARD_QUERY_KEY, TrackingBoardFilters, useGetTrackingBoard } from 'src/hooks/useGetTrackingBoard';
import { emptyOrdersForTrackingBoardTable } from 'utils/lib/helpers/tracking-board';
import { APIErrorCode } from 'utils/lib/types/errors';
import AppointmentTabs from '../components/AppointmentTabs';
import CreateDemoVisits from '../components/CreateDemoVisits';
import { adjustTopForBannerHeight } from '../helpers/misc.helper';
import PageContainer from '../layout/PageContainer';

const splitParam = (value: string | null): string[] => value?.split(',') ?? [];

const EMPTY_ORDERS = emptyOrdersForTrackingBoardTable();

export default function Appointments(): ReactElement {
  const queryClient = useQueryClient();
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [searchParams] = useSearchParams();
  // Mobile appointment rows host the Ambient Scribe recorder; continue across rotation, save on leave.
  const { pathname } = useLocation();
  useStopAmbientScribeOnLeave({ hostKey: pathname });

  const locationParam = searchParams.get('location');
  const visitTypeParam = searchParams.get('visitType');
  const serviceCategoryParam = searchParams.get('serviceCategory');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const providerParam = searchParams.get('provider');

  const filters = useMemo<TrackingBoardFilters>(
    () => ({
      dateFrom: dateFromParam,
      dateTo: dateToParam,
      locationIds: splitParam(locationParam),
      providerIds: splitParam(providerParam),
      serviceCategories: splitParam(serviceCategoryParam),
      visitType: splitParam(visitTypeParam),
    }),
    [dateFromParam, dateToParam, locationParam, providerParam, serviceCategoryParam, visitTypeParam]
  );

  // One request per tick returns the appointments, the order icons and the abnormal vitals together. Polling
  // pauses while a comment is being edited (a refresh would clobber the draft) and while the tab is hidden.
  const { data, isFetching, error } = useGetTrackingBoard(filters, { enabled: !editingComment });

  useEffect(() => {
    if (!error) return;
    console.error('error fetching appointments', error);
    const sdkError = error as unknown as Oystehr.OystehrSdkError;
    const message =
      sdkError?.code === APIErrorCode.APPOINTMENT_SEARCH_TOO_BROAD
        ? sdkError.message
        : 'Failed to load visits. Please try again in a moment.';
    enqueueSnackbar(message, { variant: 'error', preventDuplicate: true });
  }, [error]);

  const updateAppointments = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [TRACKING_BOARD_QUERY_KEY] });
  }, [queryClient]);

  return (
    <form>
      <PageContainer>
        <>
          <Box
            sx={{
              position: { xs: 'static', sm: 'sticky' },
              top: adjustTopForBannerHeight(80),
              zIndex: 1,
              backgroundColor: '#F9FAFB',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <AppointmentsFilters />
            {/* only displayed on mobile */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
              <Link to="/visits/add">
                <Button
                  sx={{
                    borderRadius: 100,
                    textTransform: 'none',
                    fontWeight: 600,
                    width: '100%',
                  }}
                  color="primary"
                  variant="contained"
                >
                  <AddIcon />
                  <Typography fontWeight="bold">Visit</Typography>
                </Button>
              </Link>
            </Box>
          </Box>
          <Box
            sx={{
              marginTop: '24px',
              width: '100%',
            }}
          >
            <AppointmentTabs
              showSelectFiltersMessage={!locationParam && !providerParam && !serviceCategoryParam}
              preBookedAppointments={data?.preBooked ?? []}
              cancelledAppointments={data?.cancelled ?? []}
              completedAppointments={data?.completed ?? []}
              inOfficeAppointments={data?.inOffice ?? []}
              orders={data?.orders ?? EMPTY_ORDERS}
              vitals={data?.vitals}
              loading={isFetching}
              updateAppointments={updateAppointments}
              setEditingComment={setEditingComment}
            />
          </Box>
          {FEATURE_FLAGS.DEMO_VISITS_ENABLED && <CreateDemoVisits />}
        </>
      </PageContainer>
    </form>
  );
}
