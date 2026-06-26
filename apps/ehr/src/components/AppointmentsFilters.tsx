import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { VisitType } from 'config-types';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PROVIDERS_FILTER } from 'src/shared/utils';
import { AppointmentType, BOOKING_CONFIG, MAX_APPOINTMENT_SEARCH_RANGE_DAYS } from 'utils';
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
// The tracking-board date range is kept in sessionStorage (not localStorage) so it survives
// in-app navigation but resets to today on a new browser session.
export const SESSION_STORAGE_DATE_RANGE_KEY = 'appointments.dateRange';

// Filter params owned by this component; any other param (e.g. `tab`) is preserved.
const FILTER_PARAM_KEYS = ['location', 'visitType', 'serviceCategory', 'dateFrom', 'dateTo', 'provider'] as const;
const DATE_RANGE_ERROR_MESSAGE = 'Date From must be on or before Date To.';
const DATE_FROM_REQUIRED_MESSAGE = 'Date From is required.';
const DATE_TO_REQUIRED_MESSAGE = 'Date To is required.';
const DATE_RANGE_TOO_LARGE_MESSAGE = `Date range must not exceed ${MAX_APPOINTMENT_SEARCH_RANGE_DAYS} days.`;

// Mirrors the get-appointments zambda's cap so an over-broad range is caught inline instead of
// failing server-side. Both sides parse in UTC so the day count is deterministic (24h/day).
const exceedsMaxRange = (dateFrom: string, dateTo: string): boolean =>
  DateTime.fromISO(dateTo, { zone: 'utc' }).diff(DateTime.fromISO(dateFrom, { zone: 'utc' }), 'days').days >
  MAX_APPOINTMENT_SEARCH_RANGE_DAYS;

interface FilterEntity {
  id: string;
}

interface AppointmentsFilterValues {
  location: FilterEntity[];
  visitType: string[];
  serviceCategory: string[];
  dateFrom: string | null;
  dateTo: string | null;
  provider: FilterEntity[];
}

const defaultFilterValues: AppointmentsFilterValues = {
  location: [],
  visitType: [],
  serviceCategory: [],
  dateFrom: null,
  dateTo: null,
  provider: [],
};

const isValidIsoDate = (date: string | null | undefined): date is string => {
  if (!date) {
    return false;
  }

  return DateTime.fromISO(date).isValid;
};

const getDateRangeFromSearchParams = (
  searchParams: URLSearchParams
): Pick<AppointmentsFilterValues, 'dateFrom' | 'dateTo'> => {
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  return {
    dateFrom: isValidIsoDate(dateFrom) ? dateFrom : null,
    dateTo: isValidIsoDate(dateTo) ? dateTo : null,
  };
};

const getPersistedDateRange = (): Pick<AppointmentsFilterValues, 'dateFrom' | 'dateTo'> => {
  const today = DateTime.now().toISODate();
  const defaultDateRange = { dateFrom: today, dateTo: today };

  const persistedRange = sessionStorage.getItem(SESSION_STORAGE_DATE_RANGE_KEY);
  if (persistedRange) {
    try {
      const parsed = JSON.parse(persistedRange) as { dateFrom?: string | null; dateTo?: string | null };
      // Only restore a persisted range when both sides are valid. A half-cleared range is dropped
      // rather than silently completed with today, which would load a span the user never chose.
      if (isValidIsoDate(parsed.dateFrom) && isValidIsoDate(parsed.dateTo)) {
        return { dateFrom: parsed.dateFrom, dateTo: parsed.dateTo };
      }
      sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
    }
  }

  return defaultDateRange;
};

export default function AppointmentsFilters(): ReactElement {
  const visitTypeToLabel = useMemo(() => getVisitTypeToLabel(), []);

  const methods = useForm<AppointmentsFilterValues>({ defaultValues: defaultFilterValues, mode: 'onChange' });
  const [searchParams, setSearchParams] = useSearchParams();
  const hasTrackingBoardFilterParams = FILTER_PARAM_KEYS.some((key) => searchParams.has(key));
  const dateFrom = methods.watch('dateFrom');
  const dateTo = methods.watch('dateTo');

  useEffect(() => {
    if (!hasTrackingBoardFilterParams) {
      return;
    }

    const dateRange = getDateRangeFromSearchParams(searchParams);

    // Mirror the URL into the form only when it carries filters; otherwise let the restore effect recover them.
    const values = {
      location:
        searchParams
          .get('location')
          ?.split(',')
          .map((id) => ({ id })) ?? [],
      visitType: searchParams.get('visitType')?.split(',') ?? [],
      serviceCategory: searchParams.get('serviceCategory')?.split(',') ?? [],
      ...dateRange,
      provider:
        searchParams
          .get('provider')
          ?.split(',')
          .map((id) => ({ id })) ?? [],
    };
    methods.reset({ ...defaultFilterValues, ...values });
  }, [hasTrackingBoardFilterParams, searchParams, methods]);

  useEffect(() => {
    void methods.trigger(['dateFrom', 'dateTo']);
  }, [dateFrom, dateTo, methods]);

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
            const fieldKey = key as keyof AppointmentsFilterValues;
            const fieldValue = values[fieldKey];
            const serializedValue: string | null = Array.isArray(fieldValue)
              ? fieldValue.map((val) => (typeof val === 'string' ? val : val.id)).join(',')
              : fieldValue;
            if (serializedValue) {
              next.set(key, serializedValue);
            }
          }
          return next;
        });
        if (values) {
          const { dateFrom, dateTo, ...rest } = values;
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(rest));
          if (dateFrom && dateTo) {
            // Persist only a complete range; a half-cleared range is invalid for the board, so it is
            // dropped here (and on restore) rather than stored and silently completed with today.
            sessionStorage.setItem(SESSION_STORAGE_DATE_RANGE_KEY, JSON.stringify({ dateFrom, dateTo }));
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
          }
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
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

    const persistedDateRange = getPersistedDateRange();
    const defaultValues = {
      visitType: Object.keys(visitTypeToLabel),
      ...persistedDateRange,
    };

    const persistedValues = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);

    if (!persistedValues) {
      methods.reset({ ...defaultFilterValues, ...defaultValues });
      return;
    }

    try {
      const parsed = JSON.parse(persistedValues);
      methods.reset({
        ...defaultFilterValues,
        ...parsed,
        ...persistedDateRange,
        visitType: parsed.visitType ?? defaultValues.visitType,
      });
    } catch {
      // Corrupt/legacy localStorage: drop it and fall back to defaults instead of crashing.
      localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
      methods.reset({ ...defaultFilterValues, ...defaultValues });
    }
  }, [hasTrackingBoardFilterParams, methods, searchParams, visitTypeToLabel]);

  return (
    <FormProvider {...methods}>
      <Paper sx={{ padding: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, width: '100%' }}>
              <SelectInput
                name="visitType"
                label="Visit Type"
                options={Object.keys(visitTypeToLabel)}
                getOptionLabel={(option) => {
                  return (visitTypeToLabel as Record<string, string>)[option];
                }}
                size="medium"
                multiple
              />
            </Box>
            <Link to="/visits/add" style={{ display: 'contents' }}>
              <Button
                data-testid={dataTestIds.dashboard.addPatientButton}
                sx={{
                  borderRadius: 100,
                  textTransform: 'none',
                  fontWeight: 600,
                  marginTop: '8px',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
                color="primary"
                variant="contained"
              >
                <AddIcon />
                <Typography fontWeight="bold">Visit</Typography>
              </Button>
            </Link>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, width: '100%' }}>
              <LocationSelectInput
                name="location"
                label="Location"
                size="medium"
                dataTestId={dataTestIds.dashboard.locationSelect}
                multiple
              />
            </Box>
            <Box sx={{ flex: 1, width: '100%' }}>
              <SelectInput
                name="serviceCategory"
                label="Service Category"
                options={BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code)}
                getOptionLabel={(option) =>
                  BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === option)?.category.display ??
                  'Unknown'
                }
                size="medium"
                multiple
              />
            </Box>
            <Box sx={{ flex: 0.75, width: '100%' }}>
              <DateInput
                name="dateFrom"
                label="Date From"
                size="medium"
                showTodayButton
                dataTestId={dataTestIds.dashboard.dateFromFilter}
                validate={(value) => {
                  const currentDateTo = methods.getValues('dateTo');
                  // Required as a pair: a half-cleared range is one the tracking board treats as
                  // invalid (it won't refetch), so surface it instead of leaving stale results.
                  if (!value && currentDateTo) {
                    return DATE_FROM_REQUIRED_MESSAGE;
                  }
                  if (value && currentDateTo && value > currentDateTo) {
                    return DATE_RANGE_ERROR_MESSAGE;
                  }

                  return true;
                }}
              />
            </Box>
            <Box sx={{ flex: 0.75, width: '100%' }}>
              <DateInput
                name="dateTo"
                label="Date To"
                size="medium"
                showTodayButton
                dataTestId={dataTestIds.dashboard.dateToFilter}
                validate={(value) => {
                  const currentDateFrom = methods.getValues('dateFrom');
                  // Required as a pair: a half-cleared range is one the tracking board treats as
                  // invalid (it won't refetch), so surface it instead of leaving stale results.
                  if (!value && currentDateFrom) {
                    return DATE_TO_REQUIRED_MESSAGE;
                  }
                  if (value && currentDateFrom && currentDateFrom > value) {
                    return DATE_RANGE_ERROR_MESSAGE;
                  }
                  if (value && currentDateFrom && exceedsMaxRange(currentDateFrom, value)) {
                    return DATE_RANGE_TOO_LARGE_MESSAGE;
                  }

                  return true;
                }}
              />
            </Box>
            <Box sx={{ flex: 1, width: '100%' }}>
              <EmployeeSelectInput
                name="provider"
                label="Provider"
                filter={PROVIDERS_FILTER}
                includeScheduleOwners
                size="medium"
                multiple
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
