import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddVisitPatientInformationCard } from 'src/features/visits/shared/components/staff-add-visit/AddVisitPatientInformationCard';
import {
  BOOKING_CONFIG,
  CreateAppointmentInputParams,
  CreateSlotParams,
  getAppointmentDurationFromSlot,
  GetScheduleRequestParams,
  GetScheduleResponse,
  getTimezone,
  PatientInfo,
  ScheduleType,
  ServiceMode,
  SLUG_SYSTEM,
} from 'utils';
import { createAppointment, createSlot, getLocations } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { CustomDialog } from '../components/dialogs/CustomDialog';
import LocationSelect from '../components/LocationSelect';
import SlotPicker from '../components/SlotPicker';
import { MAXIMUM_CHARACTER_LIMIT } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType } from '../types/types';

type SlotLoadingState =
  | { status: 'initial'; input: undefined }
  | { status: 'loading'; input: undefined }
  | { status: 'loaded'; input: string };

export type AddVisitFormState =
  | 'existingPatientSelected'
  | 'manuallyEnterPatientDetails'
  | 'initialPatientSearch'
  | 'displayPatientSearch';

export interface AddVisitErrorState {
  submit?: boolean;
  phone?: boolean;
  search?: boolean;
  searchEntry?: boolean;
}

export type AddVisitPatientInfo = Pick<
  PatientInfo,
  'id' | 'newPatient' | 'firstName' | 'lastName' | 'dateOfBirth' | 'sex' | 'phoneNumber'
>;
export interface LocationWithWalkinSchedule extends Location {
  walkinSchedule: Schedule | undefined;
}

export default function AddPatient(): JSX.Element {
  const storedLocation = localStorage?.getItem('selectedLocation');
  const [selectedLocation, setSelectedLocation] = useState<LocationWithWalkinSchedule | undefined>(
    storedLocation ? JSON.parse(storedLocation) : undefined
  );
  const [birthDate, setBirthDate] = useState<DateTime | null>(null); // i would love to not have to handle this state but i think the date search component would have to change and i dont want to touch that right now
  const [patientInfo, setPatientInfo] = useState<AddVisitPatientInfo | undefined>(undefined);
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const [reasonForVisitAdditional, setReasonForVisitAdditional] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>();
  const [slot, setSlot] = useState<Slot | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<AddVisitErrorState>({
    submit: false,
    phone: false,
    search: false,
    searchEntry: false,
  });
  const [loadingSlotState, setLoadingSlotState] = useState<SlotLoadingState>({ status: 'initial', input: undefined });
  const [locationWithSlotData, setLocationWithSlotData] = useState<GetScheduleResponse | undefined>(undefined);
  const [validDate, setValidDate] = useState<boolean>(true);
  const [selectSlotDialogOpen, setSelectSlotDialogOpen] = useState<boolean>(false);
  const [validReasonForVisit, setValidReasonForVisit] = useState<boolean>(true);
  const [showFields, setShowFields] = useState<AddVisitFormState>('initialPatientSearch');

  // console.log('slot', slot);

  // general variables
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const reasonForVisitErrorMessage = `Input cannot be more than ${MAXIMUM_CHARACTER_LIMIT} characters`;

  const handleAdditionalReasonForVisitChange = (newValue: string): void => {
    setValidReasonForVisit(newValue.length <= MAXIMUM_CHARACTER_LIMIT);
    setReasonForVisitAdditional(newValue);
  };

  useEffect(() => {
    const fetchLocationWithSlotData = async (params: GetScheduleRequestParams, client: Oystehr): Promise<void> => {
      setLoadingSlotState({ status: 'loading', input: undefined });
      try {
        const locationResponse = await getLocations(client, params);
        setLocationWithSlotData(locationResponse);
      } catch (e) {
        console.error('error loading location with slot data', e);
      } finally {
        setLoadingSlotState({ status: 'loaded', input: `${params.slug}` });
      }
    };
    const locationSlug = selectedLocation?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)
      ?.value;
    if (!locationSlug) {
      // console.log('show some toast: location is missing slug', selectedLocation, locationSlug);
      return;
    }
    if (
      !oystehrZambda ||
      loadingSlotState.status === 'loading' ||
      (loadingSlotState.status === 'loaded' && loadingSlotState.input === locationSlug)
    ) {
      return;
    }
    void fetchLocationWithSlotData({ slug: locationSlug, scheduleType: ScheduleType.location }, oystehrZambda);
  }, [selectedLocation, loadingSlotState, oystehrZambda]);

  // handle functions
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!patientInfo) {
      setErrors({ search: true });
      return;
    }

    if (!patientInfo?.phoneNumber || patientInfo.phoneNumber.length !== 10) {
      setErrors({ phone: true });
      return;
    } else {
      setErrors({});
    }

    if ((visitType === VisitType.PreBook || visitType === VisitType.PostTelemed) && slot === undefined) {
      setSelectSlotDialogOpen(true);
      return;
    }
    if (showFields.includes('PatientSearch')) {
      setErrors({ search: true });
      return;
    } else {
      setErrors({ ...errors, search: false });
    }

    if (validDate && validReasonForVisit) {
      setLoading(true);

      console.log('slot', slot);
      if (!oystehrZambda) throw new Error('Zambda client not found');
      let createSlotInput: CreateSlotParams;
      if (visitType === VisitType.WalkIn) {
        if (!selectedLocation) {
          enqueueSnackbar('Please select a location', { variant: 'error' });
          setLoading(false);
          return;
        }
        const timezone = getTimezone(selectedLocation?.walkinSchedule ?? selectedLocation);
        createSlotInput = {
          scheduleId: selectedLocation?.walkinSchedule?.id ?? '',
          startISO: DateTime.now().setZone(timezone).toISO() ?? '',
          lengthInMinutes: 15,
          serviceModality: ServiceMode['in-person'],
          walkin: true,
        };
      } else {
        if (!slot) {
          enqueueSnackbar('Please select a time slot', { variant: 'error' });
          setLoading(false);
          return;
        }
        const scheduleId = slot?.schedule?.reference?.split('/')?.[1] ?? '';
        createSlotInput = {
          scheduleId: scheduleId,
          startISO: slot?.start ?? '',
          lengthInMinutes: getAppointmentDurationFromSlot(slot),
          serviceModality: ServiceMode['in-person'],
          walkin: false,
          postTelemedLabOnly: visitType === VisitType.PostTelemed,
        };
      }
      console.log('slot input: ', createSlotInput);
      const persistedSlot = await createSlot(createSlotInput, oystehrZambda);
      const zambdaParams: CreateAppointmentInputParams = {
        patient: {
          ...patientInfo,
          dateOfBirth: patientInfo?.dateOfBirth || birthDate?.toISODate() || undefined,
          reasonForVisit: reasonForVisit,
          reasonAdditional: reasonForVisitAdditional !== '' ? reasonForVisitAdditional : undefined,
        },
        slotId: persistedSlot.id!,
      };

      let response;
      let apiErr = false;
      try {
        response = await createAppointment(oystehrZambda, zambdaParams);
      } catch (error) {
        console.error(`Failed to add patient: ${error}`);
        apiErr = true;
      } finally {
        setLoading(false);
        if (response && !apiErr) {
          navigate('/visits');
        } else {
          setErrors({ submit: true });
        }
      }
    }
  };

  return (
    <PageContainer>
      <Grid container direction="row">
        <Grid item xs={3.5} />
        <Grid item xs={5}>
          <CustomBreadcrumbs
            chain={[
              { link: '/visits', children: 'In Person' },
              { link: '#', children: 'Add Patient' },
            ]}
          />

          {/* page title */}

          <Typography variant="h3" marginTop={1} color={'primary.dark'}>
            Add Patient
          </Typography>

          {/* form content */}
          <Paper>
            <form onSubmit={(e) => handleFormSubmit(e)}>
              <Box padding={3} marginTop={2}>
                {/* Location Select */}
                <Typography variant="h4" color="primary.dark" data-testid={dataTestIds.addPatientPage.locationHeader}>
                  Location
                </Typography>

                {/* location search */}
                <Box sx={{ marginTop: 2 }}>
                  <LocationSelect
                    location={selectedLocation}
                    setLocation={setSelectedLocation}
                    updateURL={false}
                    required
                    renderInputProps={{ disabled: false }}
                  />
                </Box>

                {/* Patient information */}
                <AddVisitPatientInformationCard
                  patientInfo={patientInfo}
                  setPatientInfo={setPatientInfo}
                  showFields={showFields}
                  setShowFields={setShowFields}
                  setValidDate={setValidDate}
                  errors={errors}
                  setErrors={setErrors}
                  birthDate={birthDate}
                  setBirthDate={setBirthDate}
                />

                {/* Visit Information */}
                {showFields !== 'initialPatientSearch' && (
                  <Box marginTop={4}>
                    <Typography variant="h4" color="primary.dark">
                      Visit information
                    </Typography>
                    <Box marginTop={2}>
                      <FormControl fullWidth>
                        <InputLabel id="reason-for-visit-label">Reason for visit *</InputLabel>
                        <Select
                          data-testid={dataTestIds.addPatientPage.reasonForVisitDropdown}
                          labelId="reason-for-visit-label"
                          id="reason-for-visit-select"
                          value={reasonForVisit || ''}
                          label="Reason for visit *"
                          required
                          onChange={(event) => setReasonForVisit(event.target.value)}
                        >
                          {BOOKING_CONFIG.reasonForVisitOptions.map((reason) => (
                            <MenuItem key={reason} value={reason}>
                              {reason}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box marginTop={2}>
                      <FormControl fullWidth>
                        <TextField
                          label="Tell us more (optional)"
                          id="reason-additional-text"
                          value={reasonForVisitAdditional}
                          aria-describedby="reason-additional-helper-text"
                          onChange={(e) => handleAdditionalReasonForVisitChange(e.target.value.trimStart())}
                          maxRows={2}
                          multiline={true}
                          error={!validReasonForVisit}
                        />
                        {reasonForVisitAdditional.length > 100 && (
                          <Typography
                            variant="caption"
                            color={validReasonForVisit ? 'text.secondary' : 'error'}
                            sx={{ marginTop: 1 }}
                          >
                            {`${reasonForVisitAdditional.length} / ${MAXIMUM_CHARACTER_LIMIT}${
                              !validReasonForVisit ? ` - ${reasonForVisitErrorMessage}` : ''
                            }`}
                          </Typography>
                        )}
                      </FormControl>
                    </Box>
                    <Box marginTop={2}>
                      <FormControl fullWidth>
                        <InputLabel id="visit-type-label">Visit type *</InputLabel>
                        <Select
                          data-testid={dataTestIds.addPatientPage.visitTypeDropdown}
                          labelId="visit-type-label"
                          id="visit-type-select"
                          value={visitType || ''}
                          label="Visit type *"
                          required
                          onChange={(event) => {
                            setSlot(undefined);
                            setVisitType(event.target.value as VisitType);
                          }}
                        >
                          <MenuItem value={VisitType.WalkIn}>Walk-in In Person Visit</MenuItem>
                          <MenuItem value={VisitType.PreBook}>Pre-booked In Person Visit</MenuItem>
                          <MenuItem value={VisitType.PostTelemed}>Post Telemed Lab Only</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    {(visitType === VisitType.PreBook || visitType === VisitType.PostTelemed) && (
                      <SlotPicker
                        slotData={
                          visitType === VisitType.PostTelemed
                            ? locationWithSlotData?.telemedAvailable?.map((si) => si.slot)
                            : locationWithSlotData?.available?.map((si) => si.slot)
                        }
                        slotsLoading={loadingSlotState.status === 'loading'}
                        selectedLocation={selectedLocation}
                        timezone={locationWithSlotData?.location?.timezone || 'Undefined'}
                        selectedSlot={slot}
                        setSelectedSlot={setSlot}
                      />
                    )}
                  </Box>
                )}

                {/* form buttons */}
                <Box marginTop={4}>
                  {errors.submit && (
                    <Typography color="error" variant="body2" mb={2}>
                      Failed to add patient. Please try again.
                    </Typography>
                  )}
                  {errors.search && (
                    <Typography color="error" variant="body2" mb={2}>
                      Please search for patients before adding
                    </Typography>
                  )}
                  <LoadingButton
                    data-testid={dataTestIds.addPatientPage.addButton}
                    variant="contained"
                    type="submit"
                    loading={loading}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginRight: 1,
                    }}
                  >
                    Add {visitType}
                  </LoadingButton>
                  <Button
                    data-testid={dataTestIds.addPatientPage.cancelButton}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      navigate('/visits');
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </form>
            <CustomDialog
              open={selectSlotDialogOpen}
              title="Please select a date and time"
              description="To continue, please select an available appointment."
              closeButtonText="Close"
              handleClose={() => setSelectSlotDialogOpen(false)}
            />
          </Paper>
        </Grid>

        <Grid item xs={3.5} />
      </Grid>
    </PageContainer>
  );
}
