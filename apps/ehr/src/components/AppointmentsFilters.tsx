import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { VisitType } from 'config-types';
import { ReactElement, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PROVIDERS_FILTER } from 'src/shared/utils';
import { AppointmentType, BOOKING_CONFIG } from 'utils';
import { DateInput } from './input/DateInput';
import { EmployeeSelectInput } from './input/EmployeeSelectInput';
import { LocationSelectInput } from './input/LocationSelectInput';
import { SelectInput } from './input/SelectInput';

interface Props {
  s: string;
}

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

export default function AppointmentsFilters({ _s }: Props): ReactElement {
  const visitTypeToLabel = useMemo(() => getVisitTypeToLabel(), []);

  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <Paper sx={{ padding: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box style={{ flex: 1 }}>
            <LocationSelectInput name="location" label="Location" size="medium" multiple />
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
            <DateInput name="date" label="Select Date" size="medium" />
          </Box>
          <Box style={{ flex: 1 }}>
            <EmployeeSelectInput name="provider" label="Providers" filter={PROVIDERS_FILTER} size="medium" multiple />
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
