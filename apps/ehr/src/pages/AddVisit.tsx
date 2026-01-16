import { Paper, Typography } from '@mui/material';
import { Stack } from '@mui/system';
import { Coding, Patient, Schedule, Slot } from 'fhir/r4b';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { DateInput } from 'src/components/input/DateInput';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { RoundedButton } from 'src/components/RoundedButton';
import SlotPicker from 'src/components/SlotPicker';
import PageContainer from 'src/layout/PageContainer';
import { BOOKING_CONFIG, GetScheduleResponse, VALUE_SETS } from 'utils';

const VISIT_TYPES: Record<string, string> = {
  'in-person-walk-in': 'Walk-In In Person Visit',
  'in-person-scheduled': 'Scheduled In Person Visit',
  'telemed-on-demand': 'On Demand Virtual Visit',
  'telemed-scheduled': 'Scheduled Virtual Visit',
  'telemed-post': 'Post Telemed Lab Only',
};

const SEX: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Intersex',
};

type SlotLoadingState =
  | { status: 'initial'; input: undefined }
  | { status: 'loading'; input: undefined }
  | { status: 'loaded'; input: string };

interface LocationWithWalkinSchedule extends Location {
  walkinSchedule: Schedule | undefined;
}

interface FormState {
  visitInfo: {
    visitType?: string;
    serviceCategory?: Coding;
    location?: LocationWithWalkinSchedule;
    slot?: Slot;
    finished: boolean;
  };
  patientInfo: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    sexAtBirth?: string;
    mobilePhone?: string;
    email?: string;
    patient?: Patient;
    finished: boolean;
  };
  visitDetails: {
    reasonForVisit?: string;
    tellUsMore?: string;
    patientCompletesPaperwork?: boolean;
    finished: boolean;
  };
}

export default function AddVisit(): JSX.Element {
  const methods = useForm<FormState>({
    defaultValues: {
      visitInfo: { finished: false },
      patientInfo: { finished: false },
      visitDetails: { finished: false },
    },
  });
  const formState = methods.watch();

  const [slot, setSlot] = useState<Slot | undefined>();
  const [loadingSlotState, _setLoadingSlotState] = useState<SlotLoadingState>({ status: 'initial', input: undefined });
  const [locationWithSlotData, _setLocationWithSlotData] = useState<GetScheduleResponse | undefined>(undefined);

  const onBack = (): void => {};
  const onContinue = (): void => {};

  return (
    <PageContainer>
      <FormProvider {...methods}>
        <Stack>
          <CustomBreadcrumbs
            chain={[
              { link: '/visits', children: 'Tracing Board' },
              { link: '#', children: 'Add Visit' },
            ]}
          />
          <Typography variant="h3" marginTop={1} color={'primary.dark'}>
            Add Visit
          </Typography>

          <Paper>
            <Stack style={{ display: !formState.visitInfo.finished ? 'block' : 'none' }}>
              <Typography variant="h4" color="primary.dark">
                Visit Information
              </Typography>
              <SelectInput
                label="Visit type"
                name="visitInfo.visitType"
                options={Object.keys(VISIT_TYPES)}
                getOptionLabel={(option) => VISIT_TYPES[option]}
              />
              <SelectInput
                label="Service category"
                name="visitInfo.serviceCategory"
                options={BOOKING_CONFIG.serviceCategories}
                getOptionLabel={(option) => option.display}
              />
              <LocationSelectInput name="visitInfo.location" label="Location" />
              <SlotPicker
                slotData={
                  formState.visitInfo.visitType === 'telemed'
                    ? locationWithSlotData?.telemedAvailable?.map((si) => si.slot)
                    : locationWithSlotData?.available?.map((si) => si.slot)
                }
                slotsLoading={loadingSlotState.status === 'loading'}
                selectedLocation={location}
                timezone={locationWithSlotData?.location?.timezone || 'Undefined'}
                selectedSlot={slot}
                setSelectedSlot={setSlot}
              />
            </Stack>

            <Stack
              style={{ display: !formState.patientInfo.finished && formState.visitInfo.finished ? 'block' : 'none' }}
            >
              <Typography variant="h4" color="primary.dark">
                Patient information
              </Typography>
              <Typography color="primary.dark">
                Is this visit for a new or existing patient? Start by entering information to search for an existing
                patient (suggestions will appear below), or create a new patient.
              </Typography>
              <Stack direction="row">
                <TextInput name="patientInfo.firstName" label="First name" />
                <TextInput name="patientInfo.middleName" label="Middle name" />
                <TextInput name="patientInfo.lastName" label="Last name" />
              </Stack>
              <Stack direction="row">
                <DateInput name="patientInfo.dateOfBirth" label="Date of birth" />
                <SelectInput
                  label="Sex at birth"
                  name="patientInfo.sexAtBirth"
                  options={Object.keys(SEX)}
                  getOptionLabel={(option) => SEX[option]}
                />
              </Stack>
              <PhoneInput name="patientInfo.mobilePhone" label="Mobile phone" />
              <TextInput name="patientInfo.email" label="Email" />
            </Stack>

            <Stack
              style={{
                display: !formState.visitDetails.finished && formState.patientInfo.finished ? 'block' : 'none',
              }}
            >
              <Typography variant="h4" color="primary.dark">
                Visit details
              </Typography>
              <SelectInput
                label="Reason for visit"
                name="visitDetails.reasonForVisit"
                options={VALUE_SETS.reasonForVisitOptions.map((reason) => reason.value)}
                getOptionLabel={(option) =>
                  VALUE_SETS.reasonForVisitOptions.find((reason) => reason.value === option)?.label ?? option
                }
              />
            </Stack>

            <Stack direction="row" style={{ justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onBack}>
                Back
              </RoundedButton>
              <RoundedButton color="primary" variant="contained" onClick={onContinue}>
                Continue
              </RoundedButton>
            </Stack>
          </Paper>
        </Stack>
      </FormProvider>
    </PageContainer>
  );
}
