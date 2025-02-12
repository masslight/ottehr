import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Location, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { PatternFormat } from 'react-number-format';
import { useNavigate } from 'react-router-dom';
import {
  getContactEmailForPatientAccount,
  getFullName,
  GetScheduleRequestParams,
  GetScheduleResponse,
  PRIVATE_EXTENSION_BASE_URL,
  ScheduleType,
  ServiceMode,
} from 'utils';
import { createAppointment, getLocations } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import DateSearch from '../components/DateSearch';
import { CustomDialog } from '../components/dialogs/CustomDialog';
import LocationSelect from '../components/LocationSelect';
import SlotPicker from '../components/SlotPicker';
import { MAXIMUM_CHARACTER_LIMIT, REASON_FOR_VISIT_OPTIONS } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import {
  CreateAppointmentParameters,
  EmailUserValue,
  getFhirAppointmentTypeForVisitType,
  PersonSex,
  VisitType,
} from '../types/types';

const mapSelectedPatientEmailUser = (selectedPatientEmailUser: string | undefined): EmailUserValue | undefined => {
  if (!selectedPatientEmailUser) {
    return undefined;
  }

  const EmailUserMapper = {
    'Patient (Self)': 'Patient (Self)',
    Patient: 'Patient (Self)',
    'Parent/Guardian': 'Parent/Guardian',
  };

  if (Object.keys(EmailUserMapper).includes(selectedPatientEmailUser)) {
    const key = selectedPatientEmailUser as keyof typeof EmailUserMapper;
    return EmailUserMapper[key] as EmailUserValue;
  }
  return undefined;
};

type SlotLoadingState =
  | { status: 'initial'; input: undefined }
  | { status: 'loading'; input: undefined }
  | { status: 'loaded'; input: string };

export default function AddPatient(): JSX.Element {
  const storedLocation = localStorage?.getItem('selectedLocation');
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(
    storedLocation ? JSON.parse(storedLocation) : undefined
  );
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<DateTime | null>(null);
  const [sex, setSex] = useState<PersonSex | ''>('');
  const [mobilePhone, setMobilePhone] = useState<string>('');
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const [reasonForVisitAdditional, setReasonForVisitAdditional] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>();
  const [slot, setSlot] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ submit?: boolean; phone?: boolean; search?: boolean }>({
    submit: false,
    phone: false,
    search: false,
  });
  const [loadingSlotState, setLoadingSlotState] = useState<SlotLoadingState>({ status: 'initial', input: undefined });
  const [locationWithSlotData, setLocationWithSlotData] = useState<GetScheduleResponse | undefined>(undefined);
  const [validDate, setValidDate] = useState<boolean>(true);
  const [selectSlotDialogOpen, setSelectSlotDialogOpen] = useState<boolean>(false);
  const [validReasonForVisit, setValidReasonForVisit] = useState<boolean>(true);
  const [openSearchResults, setOpenSearchResults] = useState<boolean>(false);
  const [patients, setPatients] = useState<Patient[] | undefined>(undefined);
  const [selectedPatient, setSelectedPatient] = useState<Patient | undefined>(undefined);
  const [showFields, setShowFields] = useState<{ prefillForSelected?: boolean; forcePatientSearch?: boolean }>({
    prefillForSelected: false,
    forcePatientSearch: true,
  });

  // general variables
  const theme = useTheme();
  const navigate = useNavigate();
  const { oystehr, oystehrZambdaIntake } = useApiClients();
  const reasonForVisitErrorMessage = `Input cannot be more than ${MAXIMUM_CHARACTER_LIMIT} characters`;
  const phoneNumberErrorMessage = 'Phone number must be 10 digits';

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
    const locationSlug = selectedLocation?.identifier?.find(
      (identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug'
    )?.value;
    if (!locationSlug) {
      console.log('show some toast: location is missing slug', selectedLocation, locationSlug);
      return;
    }
    if (
      !oystehrZambdaIntake ||
      loadingSlotState.status === 'loading' ||
      (loadingSlotState.status === 'loaded' && loadingSlotState.input === locationSlug)
    ) {
      return;
    }
    void fetchLocationWithSlotData({ slug: locationSlug, scheduleType: ScheduleType.location }, oystehrZambdaIntake);
  }, [selectedLocation, loadingSlotState, oystehrZambdaIntake]);

  // handle functions
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (mobilePhone.length !== 10) {
      setErrors({ phone: true });
      return;
    } else {
      setErrors({});
    }

    if ((visitType === VisitType.PreBook || visitType === VisitType.PostTelemed) && slot === undefined) {
      setSelectSlotDialogOpen(true);
      return;
    }
    if (showFields.forcePatientSearch) {
      setErrors({ search: true });
      return;
    } else {
      setErrors({ ...errors, search: false });
    }

    if (validDate && validReasonForVisit) {
      setLoading(true);

      let selectedPatientEmail, selectedPatientEmailUser;
      if (selectedPatient) {
        selectedPatientEmailUser = mapSelectedPatientEmailUser(
          selectedPatient.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`)
            ?.valueString as any
        );
        if (selectedPatientEmailUser) {
          if (selectedPatientEmailUser !== 'Parent/Guardian') {
            selectedPatientEmail = selectedPatient.telecom?.find((telecom) => telecom.system === 'email')?.value;
          } else if (selectedPatientEmailUser === 'Parent/Guardian') {
            const guardianContact = selectedPatient.contact?.find(
              (contact) =>
                contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian')
            );
            selectedPatientEmail = guardianContact?.telecom?.find((telecom) => telecom.system === 'email')?.value;
          }
        }
      }

      const emailToUse = selectedPatientEmail;
      let emailUser = selectedPatientEmailUser;
      if (emailUser == undefined && emailToUse) {
        emailUser = 'Parent/Guardian';
      }
      if (!oystehrZambdaIntake) throw new Error('Zambda client not found');
      const zambdaParams: CreateAppointmentParameters = {
        patient: {
          id: selectedPatient?.id,
          newPatient: !selectedPatient,
          firstName: (selectedPatient?.name?.[0].given?.join(' ') || firstName)?.trim(),
          lastName: (selectedPatient?.name?.[0].family || lastName)?.trim(),
          dateOfBirth: selectedPatient?.birthDate || birthDate?.toISODate() || undefined,
          sex: (selectedPatient?.gender as PersonSex) || sex || undefined,
          phoneNumber: mobilePhone,
          email: emailToUse,
          emailUser,
          reasonForVisit: reasonForVisit,
          reasonAdditional: reasonForVisitAdditional !== '' ? reasonForVisitAdditional : undefined,
        },
        slot: slot,
        visitType: getFhirAppointmentTypeForVisitType(visitType),
        locationID: selectedLocation?.id,
        scheduleType: ScheduleType.location,
        serviceType: ServiceMode['in-person'],
      };

      let response;
      let apiErr = false;
      try {
        response = await createAppointment(oystehrZambdaIntake, zambdaParams);
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
  // console.log(slot);

  const handlePatientSearch = async (e: any): Promise<void> => {
    e.preventDefault();
    if (mobilePhone.length !== 10) {
      setErrors({ ...errors, phone: true });
      return;
    }
    setSearching(true);
    setErrors({ ...errors, search: false });
    setShowFields({ ...showFields, forcePatientSearch: false });

    if (!oystehr) {
      return;
    }
    const resources = (
      await oystehr.fhir.search<Patient | Person | RelatedPerson>({
        resourceType: 'Person',
        params: [
          {
            name: 'telecom',
            value: `+1${mobilePhone}`,
          },
          {
            name: '_include',
            value: 'Person:relatedperson',
          },
          {
            name: '_include:iterate',
            value: 'RelatedPerson:patient',
          },
        ],
      })
    ).unbundle();
    const patients = resources.filter(
      (resourceTemp): resourceTemp is Patient => resourceTemp.resourceType === 'Patient'
    );
    patients.sort(sortPatientsByName);
    setPatients(patients);
    setOpenSearchResults(true);
    setSearching(false);
  };

  const sortPatientsByName = (a: Patient, b: Patient): number => {
    const lastNameA = a?.name?.[0].family;
    const lastNameB = b?.name?.[0].family;
    const firstNameA = a?.name?.[0].given?.join(' ');
    const firstNameB = b?.name?.[0].given?.join(' ');
    if (lastNameA && lastNameB && firstNameA && firstNameB) {
      // sort by last name
      if (lastNameA < lastNameB) {
        return -1;
      } else if (lastNameA > lastNameB) {
        return 1;
      } else {
        // if same last name, sort by first name
        return firstNameA.localeCompare(firstNameB);
      }
    } else {
      return 0;
    }
  };

  const handleSelectPatient = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = patients?.find((patient) => patient.id === event.target.value);
    setSelectedPatient(selected);
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
                <Typography variant="h4" color="primary.dark">
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
                <Box>
                  <Typography variant="h4" color="primary.dark" sx={{ marginTop: 4 }}>
                    Patient information
                  </Typography>
                  <Box marginTop={2}>
                    <Grid container>
                      <Grid item xs={8}>
                        <PatternFormat
                          data-testid={dataTestIds.addPatientPage.mobilePhoneInput}
                          customInput={TextField}
                          value={mobilePhone}
                          format="(###) ###-####"
                          mask=" "
                          label="Mobile Phone"
                          variant="outlined"
                          placeholder="(XXX) XXX-XXXX"
                          fullWidth
                          required
                          error={errors.phone}
                          helperText={errors?.phone ? phoneNumberErrorMessage : ''}
                          onValueChange={(values, sourceInfo) => {
                            if (sourceInfo.source === 'event') {
                              setMobilePhone(values.value);
                              if (errors.phone && values.value.length === 10) {
                                setErrors({ ...errors, phone: false });
                              }
                            }
                          }}
                        />
                      </Grid>
                      <Grid
                        item
                        xs={4}
                        sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', padding: '0 8px' }}
                      >
                        <LoadingButton
                          data-testid={dataTestIds.addPatientPage.searchForPatientsButton}
                          variant="contained"
                          onClick={(event) => handlePatientSearch(event)}
                          loading={searching}
                          sx={{
                            borderRadius: 100,
                            textTransform: 'none',
                            fontWeight: 600,
                          }}
                        >
                          Search for Patients
                        </LoadingButton>
                      </Grid>
                    </Grid>
                  </Box>
                  <Dialog
                    open={openSearchResults}
                    onClose={() => {
                      setSelectedPatient(undefined);
                      setOpenSearchResults(false);
                    }}
                  >
                    <Box
                      sx={{ minWidth: '600px', borderRadius: '4px', p: '35px', maxHeight: '450px', overflow: 'scroll' }}
                    >
                      <Box>
                        <Typography
                          variant="h4"
                          sx={{ fontWeight: '600 !important', color: theme.palette.primary.main, marginBottom: '4px' }}
                        >
                          Select an Existing QRS Patient
                        </Typography>
                      </Box>
                      <Box>
                        <RadioGroup onChange={(e) => handleSelectPatient(e)}>
                          {patients?.map((patient) => {
                            const label = `${getFullName(patient)} (DOB: ${DateTime.fromISO(
                              patient?.birthDate || ''
                            ).toFormat('MMMM dd, yyyy')})`;
                            return (
                              <FormControlLabel key={patient.id} value={patient.id} control={<Radio />} label={label} />
                            );
                          })}
                        </RadioGroup>
                      </Box>
                      {selectedPatient && (
                        <Box sx={{ marginTop: 2 }}>
                          <Button
                            data-testid={dataTestIds.addPatientPage.prefillForButton}
                            variant="outlined"
                            sx={{
                              borderRadius: 100,
                              textTransform: 'none',
                              fontWeight: 600,
                            }}
                            onClick={() => {
                              setShowFields({ ...showFields, prefillForSelected: true });
                              setOpenSearchResults(false);
                            }}
                          >
                            Prefill for {getFullName(selectedPatient)}
                          </Button>
                        </Box>
                      )}
                      <Box sx={{ marginTop: 2 }}>
                        <Button
                          data-testid={dataTestIds.addPatientPage.patientNotFoundButton}
                          variant="contained"
                          sx={{
                            borderRadius: 100,
                            textTransform: 'none',
                            fontWeight: 600,
                          }}
                          onClick={() => {
                            setSelectedPatient(undefined);
                            setShowFields({ ...showFields, prefillForSelected: false });
                            setOpenSearchResults(false);
                          }}
                        >
                          Patient Not Found in QRS - Add Manually
                        </Button>
                      </Box>
                    </Box>
                  </Dialog>
                  {searching && (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }} marginTop={2}>
                      <CircularProgress />
                    </Box>
                  )}
                  {showFields.prefillForSelected && selectedPatient && (
                    <Box marginTop={3}>
                      <Typography
                        variant="h4"
                        color="primary.dark"
                        data-testid={dataTestIds.addPatientPage.prefilledPatientName}
                      >
                        {getFullName(selectedPatient)}
                      </Typography>
                      <Typography data-testid={dataTestIds.addPatientPage.prefilledPatientBirthday}>
                        Birthday: {DateTime.fromISO(selectedPatient?.birthDate || '').toFormat('MMMM dd, yyyy')}
                      </Typography>
                      <Typography data-testid={dataTestIds.addPatientPage.prefilledPatientBirthSex}>
                        Birth Sex: {selectedPatient.gender}
                      </Typography>
                      <Typography data-testid={dataTestIds.addPatientPage.prefilledPatientEmail}>
                        Email: {getContactEmailForPatientAccount(selectedPatient) ?? 'not found'}
                      </Typography>
                    </Box>
                  )}
                  {!showFields.forcePatientSearch && !showFields.prefillForSelected && !searching && (
                    <Box marginTop={2}>
                      <Box>
                        <Grid container direction="row" justifyContent="space-between">
                          <Grid item xs={5.85}>
                            <TextField
                              data-testid={dataTestIds.addPatientPage.firstNameInput}
                              label="First Name"
                              variant="outlined"
                              required
                              fullWidth
                              value={firstName.trimStart()}
                              onChange={(event) => {
                                setFirstName(event.target.value);
                              }}
                            ></TextField>
                          </Grid>
                          <Grid item xs={5.85}>
                            <TextField
                              data-testid={dataTestIds.addPatientPage.lastNameInput}
                              label="Last Name"
                              variant="outlined"
                              required
                              fullWidth
                              value={lastName.trimStart()}
                              onChange={(event) => {
                                setLastName(event.target.value);
                              }}
                            ></TextField>
                          </Grid>
                        </Grid>
                      </Box>

                      <Box marginTop={2}>
                        <Grid container direction="row" justifyContent="space-between">
                          <Grid item xs={5.85}>
                            <DateSearch
                              date={birthDate}
                              setDate={setBirthDate}
                              defaultValue={null}
                              label="Date of birth"
                              required
                              setIsValidDate={setValidDate}
                            ></DateSearch>
                          </Grid>
                          <Grid item xs={5.85}>
                            <FormControl fullWidth>
                              <InputLabel id="sex-at-birth-label">Sex at birth *</InputLabel>
                              <Select
                                data-testid={dataTestIds.addPatientPage.sexAtBirthDropdown}
                                labelId="sex-at-birth-label"
                                id="sex-at-birth-select"
                                value={sex}
                                label="Sex at birth *"
                                required
                                onChange={(event) => {
                                  setSex(event.target.value as PersonSex);
                                }}
                              >
                                <MenuItem value={PersonSex.Male}>Male</MenuItem>
                                <MenuItem value={PersonSex.Female}>Female</MenuItem>
                                <MenuItem value={PersonSex.Intersex}>Intersex</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Visit Information */}
                {!showFields.forcePatientSearch && !searching && (
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
                          {REASON_FOR_VISIT_OPTIONS.map((reason) => (
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
                            ? locationWithSlotData?.telemedAvailable
                            : locationWithSlotData?.available
                        }
                        slotsLoading={loadingSlotState.status === 'loading'}
                        timezone={locationWithSlotData?.location.timezone || 'Undefined'}
                        selectedSlot={slot}
                        setSelectedSlot={setSlot}
                      />
                    )}
                  </Box>
                )}

                {showFields.forcePatientSearch && (
                  <Box marginTop={4}>
                    <Typography variant="body1" color="primary.dark">
                      Please enter the mobile number and search for existing patients before proceeding.
                    </Typography>
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
                    loading={loading || searching}
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
