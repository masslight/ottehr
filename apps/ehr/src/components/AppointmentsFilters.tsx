import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { VisitType } from 'config-types';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PROVIDERS_FILTER } from 'src/shared/utils';
import { AppointmentType, BOOKING_CONFIG } from 'utils';
import { DateInput } from './input/DateInput';
import { EmployeeSelectInput } from './input/EmployeeSelectInput';
import { LocationSelectInput } from './input/LocationSelectInput';
import { SelectInput } from './input/SelectInput';

// keys are the appointment-type strings get-appointments uses:
// `${'in-person' | 'virtual'}-${AppointmentType}`
const ALL_VISIT_TYPE_LABELS = {
  'in-person-walk-in': 'Walk-in In Person Visit',
  'in-person-pre-booked': 'Pre-booked In Person Visit',
  'in-person-post-telemed': 'Post Telemed Lab Only',
  'virtual-walk-in': 'On-demand Telemed',
  'virtual-pre-booked': 'Pre-booked Telemed',
} as const satisfies Partial<Record<`${'in-person' | 'virtual'}-${AppointmentType}`, string>>;
type VisitTypeFilterKey = keyof typeof ALL_VISIT_TYPE_LABELS;

// this map bridges visit and appointment types so we can filter only the options configured for the
// project
const FILTER_KEY_TO_BOOKING_OPTION_ID: Record<VisitTypeFilterKey, VisitType> = {
  'in-person-walk-in': VisitType.InPersonWalkIn,
  'in-person-pre-booked': VisitType.InPersonPreBook,
  'in-person-post-telemed': VisitType.InPersonPostTelemed,
  'virtual-walk-in': VisitType.VirtualOnDemand,
  'virtual-pre-booked': VisitType.VirtualScheduled,
};

const getVisitTypeToLabel = (): Partial<typeof ALL_VISIT_TYPE_LABELS> => {
  const enabledBookingOptionIds = new Set(BOOKING_CONFIG.ehrBookingOptions.map((opt) => opt.id));
  return Object.fromEntries(
    (Object.entries(ALL_VISIT_TYPE_LABELS) as [VisitTypeFilterKey, string][]).filter(([key]) =>
      enabledBookingOptionIds.has(FILTER_KEY_TO_BOOKING_OPTION_ID[key])
    )
  );
};

export const LOCAL_STORAGE_FILTERS_KEY = 'appointments.filters';
// `date` is kept in sessionStorage (not localStorage) so it survives in-app navigation but resets
// to today on a new browser session — closing/reopening the window must not restore a stale date.
export const SESSION_STORAGE_DATE_KEY = 'appointments.date';

// Filter params owned by this component; any other param (e.g. `tab`) is preserved.
const FILTER_PARAM_KEYS = ['location', 'visitType', 'serviceCategory', 'date', 'provider'] as const;

export default function AppointmentsFilters(): ReactElement {
  const visitTypeToLabel = useMemo(() => getVisitTypeToLabel(), []);

  const methods = useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasTrackingBoardFilterParams = FILTER_PARAM_KEYS.some((key) => searchParams.has(key));

  useEffect(() => {
    if (!hasTrackingBoardFilterParams) {
      return;
    }

    // Mirror the URL into the form only when it carries filters; otherwise let the restore effect recover them.
    const values = {
      location:
        searchParams
          .get('location')
          ?.split(',')
          .map((id) => ({ id })) ?? [],
      visitType: searchParams.get('visitType')?.split(',') ?? [],
      serviceCategory: searchParams.get('serviceCategory')?.split(',') ?? [],
      date: searchParams.get('date'),
      provider:
        searchParams
          .get('provider')
          ?.split(',')
          .map((id) => ({ id })) ?? [],
    };
    methods.reset(values);
  }, [hasTrackingBoardFilterParams, searchParams, methods]);

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        setSearchParams((prev) => {
          // Rewrite filter params while preserving any other param (e.g. `tab`).
          const next = new URLSearchParams(prev);
          FILTER_PARAM_KEYS.forEach((key) => next.delete(key));
          for (const key in values) {
            const value = Array.isArray(values[key])
              ? values[key].map((val) => val.id ?? val).join(',')
              : values[key]?.id ?? values[key];
            if (value) {
              next.set(key, value);
            }
          }
          return next;
        });
        if (values) {
          const { date, ...rest } = values;
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(rest));
          if (date) {
            sessionStorage.setItem(SESSION_STORAGE_DATE_KEY, date);
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_DATE_KEY);
          }
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_DATE_KEY);
        }
      },
    });
    return () => callback();
  }, [methods, setSearchParams]);

  useEffect(() => {
    // Restore persisted filters when the URL carries none (e.g. only `?tab=` after an approval).
    if (hasTrackingBoardFilterParams) {
      return;
    }

    // Defer seeding until AppointmentTabs has written `?tab=`. AppointmentsFilters is only
    // mounted on the tracking board page alongside AppointmentTabs, which writes the tab on
    // mount — this guard keeps the two siblings' URL writes deterministic.
    if (!searchParams.has('tab')) {
      return;
    }

    const date = sessionStorage.getItem(SESSION_STORAGE_DATE_KEY) || DateTime.now().toISODate();
    const defaultValues = {
      visitType: Object.keys(visitTypeToLabel),
      date,
    };

    const persistedValues = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);

    if (!persistedValues) {
      methods.reset(defaultValues);
      return;
    }

    try {
      const parsed = JSON.parse(persistedValues);
      methods.reset({ ...parsed, date });
    } catch {
      // Corrupt/legacy localStorage: drop it and fall back to defaults instead of crashing.
      localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
      methods.reset(defaultValues);
    }
  }, [hasTrackingBoardFilterParams, methods, searchParams, visitTypeToLabel]);

  return (
    <FormProvider {...methods}>
      <Paper sx={{ padding: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box style={{ flex: 1 }}>
            <LocationSelectInput
              name="location"
              label="Location"
              size="medium"
              dataTestId={dataTestIds.dashboard.locationSelect}
              multiple
            />
          </Box>
          <Box style={{ flex: 1.5 }}>
            <SelectInput
              name="visitType"
              label="Visit type"
              options={Object.keys(visitTypeToLabel)}
              getOptionLabel={(option) => {
                return (visitTypeToLabel as Record<string, string>)[option];
              }}
              size="medium"
              multiple
            />
          </Box>
          <Box style={{ flex: 1 }}>
            <SelectInput
              name="serviceCategory"
              label="Service category"
              options={BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code)}
              getOptionLabel={(option) =>
                BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === option)?.category.display ??
                'Unknown'
              }
              size="medium"
              multiple
            />
          </Box>
          <Box style={{ flex: 0.75 }}>
            <DateInput name="date" label="Select Date" size="medium" showTodayButton />
          </Box>
          <Box style={{ flex: 1 }}>
            <EmployeeSelectInput
              name="provider"
              label="Providers"
              filter={PROVIDERS_FILTER}
              includeScheduleOwners
              size="medium"
              multiple
            />
          </Box>
          <Link to="/visits/add">
            <Button
              data-testid={dataTestIds.dashboard.addPatientButton}
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
                marginTop: '8px',
              }}
              color="primary"
              variant="contained"
            >
              <AddIcon />
              <Typography fontWeight="bold">Visit</Typography>
            </Button>
          </Link>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
