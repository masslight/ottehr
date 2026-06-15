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
// The tracking-board date range is kept in sessionStorage (not localStorage) so it survives
// in-app navigation but resets to today on a new browser session.
export const SESSION_STORAGE_DATE_RANGE_KEY = 'appointments.dateRange';
export const SESSION_STORAGE_DATE_KEY = 'appointments.date';

// Filter params owned by this component; any other param (e.g. `tab`) is preserved.
const FILTER_PARAM_KEYS = [
  'location',
  'visitType',
  'serviceCategory',
  'dateFrom',
  'dateTo',
  'date',
  'provider',
] as const;
const DATE_RANGE_ERROR_MESSAGE = 'Date From must be on or before Date To.';

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
  const legacyDate = searchParams.get('date');
  const dateFrom = searchParams.get('dateFrom') ?? legacyDate;
  const dateTo = searchParams.get('dateTo') ?? legacyDate;

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
      const dateFrom = isValidIsoDate(parsed.dateFrom) ? parsed.dateFrom : today;
      const dateTo = isValidIsoDate(parsed.dateTo) ? parsed.dateTo : today;
      return { dateFrom, dateTo };
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
    }
  }

  const legacyDate = sessionStorage.getItem(SESSION_STORAGE_DATE_KEY);
  if (isValidIsoDate(legacyDate)) {
    return { dateFrom: legacyDate, dateTo: legacyDate };
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

    // Rewrite a legacy `?date=` link into the `dateFrom`/`dateTo` range params it maps to.
    if (
      searchParams.has('date') &&
      !searchParams.has('dateFrom') &&
      !searchParams.has('dateTo') &&
      dateRange.dateFrom &&
      dateRange.dateTo
    ) {
      const { dateFrom, dateTo } = dateRange;

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('date');
          next.set('dateFrom', dateFrom);
          next.set('dateTo', dateTo);
          return next;
        },
        { replace: true }
      );
    }
  }, [hasTrackingBoardFilterParams, searchParams, methods, setSearchParams]);

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
          if (dateFrom || dateTo) {
            sessionStorage.setItem(SESSION_STORAGE_DATE_RANGE_KEY, JSON.stringify({ dateFrom, dateTo }));
            sessionStorage.removeItem(SESSION_STORAGE_DATE_KEY);
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
            sessionStorage.removeItem(SESSION_STORAGE_DATE_KEY);
          }
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
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
                  if (value && currentDateFrom && currentDateFrom > value) {
                    return DATE_RANGE_ERROR_MESSAGE;
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
