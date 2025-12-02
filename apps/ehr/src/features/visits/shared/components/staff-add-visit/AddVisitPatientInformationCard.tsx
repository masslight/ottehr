import { LoadingButton } from '@mui/lab';
import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  TextFieldProps,
  Typography,
} from '@mui/material';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import DateSearch from 'src/components/DateSearch';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { AddVisitErrorState, AddVisitFormState, AddVisitPatientInfo } from 'src/pages/AddPatient';
import { getFirstName, getLastName, getMiddleName, PersonSex } from 'utils';
import { AddVisitPatientSearchDialog } from './AddVisitPatientSearchDialog';
import { AddVisitPatientSearchFields } from './AddVisitPatientSearchFields';

interface AddVisitPatientInformationCardProps {
  patientInfo: AddVisitPatientInfo | undefined;
  setPatientInfo: (info: AddVisitPatientInfo) => void;
  showFields: AddVisitFormState;
  setShowFields: (formState: AddVisitFormState) => void;
  setValidDate: (isValid: boolean) => void;
  errors: AddVisitErrorState;
  setErrors: (errorState: AddVisitErrorState) => void;
  birthDate: DateTime | null;
  setBirthDate: (dateTime: DateTime | null) => void;
}
export const AddVisitPatientInformationCard: FC<AddVisitPatientInformationCardProps> = ({
  patientInfo,
  setPatientInfo,
  showFields,
  setShowFields,
  setValidDate,
  errors,
  setErrors,
  birthDate,
  setBirthDate,
}) => {
  const { oystehr } = useApiClients();
  const defaultSearchFilters = { givenNames: '', lastName: '', phone: '' };

  const [openSearchResults, setOpenSearchResults] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<AddVisitPatientInfo | undefined>(undefined);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchFilters, setSearchFilters] = useState(defaultSearchFilters);
  const [patients, setPatients] = useState<AddVisitPatientInfo[]>([]);

  // consts
  const formattedDOB = patientInfo?.dateOfBirth
    ? DateTime.fromISO(patientInfo.dateOfBirth).toFormat('MMMM dd, yyyy')
    : '';
  const readOnlyTextFieldProps: TextFieldProps = {
    InputProps: {
      readOnly: true,
      sx: {
        pointerEvents: 'none',
      },
    },
  };

  // helpers
  const setSearchField = useCallback(
    ({ field, value }: { field: keyof typeof defaultSearchFilters; value: string }): void => {
      setSearchFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [setSearchFilters]
  );
  const resetFilters = (): void => setSearchFilters(defaultSearchFilters);
  const searchResources = async (): Promise<void> => {
    if (!oystehr) {
      throw new Error('oystehr client not available');
    }
    const params = [
      {
        name: '_revinclude:iterate',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:link', // user resource
      },
      {
        name: '_sort',
        value: 'family,name',
      },
    ];
    if (searchFilters.lastName) {
      params.push({
        name: 'family',
        value: searchFilters.lastName,
      });
    }
    if (searchFilters.givenNames) {
      params.push({
        name: 'name',
        value: searchFilters.givenNames,
      });
    }
    if (searchFilters.phone) {
      params.push({
        // the number really represents the users number
        name: '_has:RelatedPerson:patient:_has:Person:link:telecom',
        value: `+1${searchFilters.phone}`,
      });
    } else {
      params.push({
        // do not return patients without users
        name: '_has:RelatedPerson:patient:_has:Person:link:_id:missing',
        value: 'false',
      });
    }
    console.log('check the params', JSON.stringify(params));
    const resources = (
      await oystehr.fhir.search<Patient | Person | RelatedPerson>({
        resourceType: 'Patient',
        params,
      })
    ).unbundle();
    const parsedPatients: AddVisitPatientInfo[] = [];
    // todo this can probably be done better / quicker with reduce
    resources.forEach((resource) => {
      if (resource.resourceType === 'Patient') {
        const fhirPatient = resource;
        const relatedPerson = resources.find(
          (resource) =>
            resource.resourceType === 'RelatedPerson' &&
            resource.patient.reference === `Patient/${fhirPatient.id}` &&
            resource.relationship?.some((rel) => rel.coding?.some((c) => c.code === 'user-relatedperson'))
        );
        if (relatedPerson) {
          const user = resources.find(
            (resource) =>
              resource.resourceType === 'Person' &&
              resource.link?.some((link) => link.target.reference === `RelatedPerson/${relatedPerson.id}`)
          );
          if (user) {
            const formattedPatientInfo: AddVisitPatientInfo = {
              id: fhirPatient.id,
              newPatient: false,
              firstName: getFirstName(fhirPatient),
              middleName: getMiddleName(fhirPatient),
              lastName: getLastName(fhirPatient),
              dateOfBirth: fhirPatient.birthDate,
              sex: fhirPatient.gender,
              phoneNumber: user.telecom?.find((telecom) => telecom.system === 'phone')?.value?.replace('+1', ''),
            };
            parsedPatients.push(formattedPatientInfo);
          }
        }
      }
    });

    setPatients(parsedPatients);
    setOpenSearchResults(true);
  };

  // handlers
  const handlePatientSearch = async (): Promise<void> => {
    if (!searchFilters.phone && !searchFilters.givenNames && !searchFilters.lastName) {
      setErrors({ searchEntry: true });
      return;
    } else {
      setErrors({ ...errors, searchEntry: false });
    }
    if (searchFilters.phone && searchFilters.phone.length !== 10) {
      setErrors({ phone: true });
      return;
    } else {
      setErrors({ ...errors, phone: false });
    }
    setSelectedPatient(undefined);
    try {
      setSearching(true);
      await searchResources();
    } catch (e) {
      console.log('error search resources: ', e);
      console.log(JSON.stringify(e));
      enqueueSnackbar('Error searching for patient', { variant: 'error' });
    }
    setSearching(false);
  };
  const handleManuallyEnterPatientDetails = (): void => {
    setPatientInfo({
      newPatient: true,
      phoneNumber: searchFilters?.phone,
      firstName: searchFilters?.givenNames,
      lastName: searchFilters?.lastName,
    });
    setShowFields('manuallyEnterPatientDetails');
    setOpenSearchResults(false);
    resetFilters();
  };
  const handleSelectExistingPatient = (): void => {
    if (selectedPatient) {
      setPatientInfo({
        id: selectedPatient.id,
        newPatient: false,
        dateOfBirth: selectedPatient?.dateOfBirth,
        phoneNumber: selectedPatient?.phoneNumber?.replace('+1', ''),
        firstName: selectedPatient?.firstName,
        lastName: selectedPatient?.lastName,
        sex: selectedPatient?.sex as PersonSex,
      });
      setShowFields('existingPatientSelected');
      setOpenSearchResults(false);
    } else {
      enqueueSnackbar('Please select a patient or "Other patient / Add manually', { variant: 'error' });
    }
    resetFilters();
  };
  const handleResetSearch = (): void => {
    resetFilters();
    setSelectedPatient(undefined);
    setBirthDate(null);
    setShowFields('displayPatientSearch');
  };

  return (
    <>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item>
          <Typography variant="h4" color="primary.dark">
            Patient information
          </Typography>
        </Grid>
        {showFields === 'displayPatientSearch' || showFields === 'initialPatientSearch' ? (
          <>
            <Grid item>
              <Typography variant="body1">
                Please enter name or phone to search for existing patients before proceeding.
              </Typography>
            </Grid>
            <Grid item>
              <Grid container spacing={2}>
                <AddVisitPatientSearchFields
                  lastName={{
                    displayPlaceholder: true,
                    required: false,
                    value: searchFilters.lastName,
                    onChange: (e) => setSearchField({ field: 'lastName', value: e.target.value }),
                  }}
                  firstName={{
                    displayPlaceholder: true,
                    required: false,
                    value: searchFilters.givenNames,
                    onChange: (e) => setSearchField({ field: 'givenNames', value: e.target.value }),
                  }}
                  phoneNumber={{
                    displayPlaceholder: true,
                    required: false,
                    value: searchFilters.phone,
                    error: !!errors.phone,
                    onValueChange: (values, sourceInfo) => {
                      if (sourceInfo.source === 'event') {
                        setSearchField({ field: 'phone', value: values.value });
                        if (errors.phone && values.value.length === 10) {
                          setErrors({ ...errors, phone: false });
                        }
                      }
                    },
                    dataTestId: dataTestIds.addPatientPage.mobilePhoneInput,
                  }}
                />
                <Grid item xs={12} display="flex" justifyContent="flex-end">
                  <LoadingButton
                    data-testid={dataTestIds.addPatientPage.searchForPatientsButton}
                    loading={searching}
                    variant="outlined"
                    color="primary"
                    sx={{ borderRadius: 28, p: '8px 22px', textTransform: 'none' }}
                    onClick={async () => await handlePatientSearch()}
                  >
                    Search for Patients
                  </LoadingButton>
                </Grid>
              </Grid>
            </Grid>
          </>
        ) : (
          patientInfo && (
            <Grid item xs={12}>
              <Grid container spacing={2}>
                {showFields === 'existingPatientSelected' && (
                  <>
                    <AddVisitPatientSearchFields
                      lastName={{
                        displayPlaceholder: false,
                        required: false,
                        value: patientInfo.lastName,
                        additionalProps: readOnlyTextFieldProps,
                        // dataTestId: dataTestIds.addPatientPage.prefilledPatientName, // maybe fix?
                      }}
                      firstName={{
                        displayPlaceholder: false,
                        required: false,
                        value: patientInfo.firstName,
                        additionalProps: readOnlyTextFieldProps,
                        // dataTestId: dataTestIds.addPatientPage.prefilledPatientName, // maybe fix?
                      }}
                      phoneNumber={{
                        displayPlaceholder: false,
                        required: false,
                        value: patientInfo?.phoneNumber || '',
                        error: !!errors.phone,
                        inputProps: readOnlyTextFieldProps.InputProps,
                      }}
                    />
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Date of birth"
                        value={formattedDOB}
                        {...readOnlyTextFieldProps}
                        data-testid={dataTestIds.addPatientPage.prefilledPatientBirthday}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Sex at birth"
                        value={
                          patientInfo.sex
                            ? `${patientInfo.sex.charAt(0).toUpperCase() + patientInfo.sex.slice(1)}`
                            : undefined
                        }
                        {...readOnlyTextFieldProps}
                        data-testid={dataTestIds.addPatientPage.prefilledPatientBirthSex}
                      />
                    </Grid>
                  </>
                )}
                {showFields === 'manuallyEnterPatientDetails' && (
                  <>
                    <AddVisitPatientSearchFields
                      lastName={{
                        displayPlaceholder: true,
                        required: true,
                        value: patientInfo.lastName,
                        onChange: (e) => setPatientInfo({ ...patientInfo, lastName: e.target.value }),
                        additionalProps: { required: true },
                        dataTestId: dataTestIds.addPatientPage.lastNameInput,
                      }}
                      firstName={{
                        displayPlaceholder: true,
                        required: true,
                        value: patientInfo.firstName,
                        onChange: (e) => setPatientInfo({ ...patientInfo, firstName: e.target.value }),
                        additionalProps: { required: true },
                        dataTestId: dataTestIds.addPatientPage.firstNameInput,
                      }}
                      phoneNumber={{
                        displayPlaceholder: true,
                        required: true,
                        value: patientInfo?.phoneNumber || '',
                        error: !!errors.phone,
                        onValueChange: (values, sourceInfo) => {
                          if (sourceInfo.source === 'event') {
                            setPatientInfo({ ...patientInfo, phoneNumber: values.value });
                            if (errors.phone && values.value.length === 10) {
                              setErrors({ ...errors, phone: false });
                            }
                          }
                        },
                      }}
                    />
                    <Grid item xs={12} sm={6}>
                      <DateSearch
                        date={birthDate}
                        setDate={setBirthDate}
                        defaultValue={null}
                        label="Date of birth"
                        required
                        setIsValidDate={setValidDate}
                      ></DateSearch>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel id="sex-at-birth-label">Sex at birth *</InputLabel>
                        <Select
                          data-testid={dataTestIds.addPatientPage.sexAtBirthDropdown}
                          labelId="sex-at-birth-label"
                          id="sex-at-birth-select"
                          value={patientInfo.sex || ''}
                          label="Sex at birth *"
                          required
                          onChange={(event) => {
                            const selectedSex = event.target.value as PersonSex;
                            setPatientInfo({ ...patientInfo, sex: selectedSex });
                          }}
                        >
                          <MenuItem value={PersonSex.Male}>Male</MenuItem>
                          <MenuItem value={PersonSex.Female}>Female</MenuItem>
                          <MenuItem value={PersonSex.Intersex}>Intersex</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} display="flex" justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    color="primary"
                    type="submit"
                    sx={{ borderRadius: 28, p: '8px 22px', textTransform: 'none' }}
                    onClick={handleResetSearch}
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          )
        )}
      </Grid>

      {errors.searchEntry && (
        <Typography color="error" variant="body2" mb={2}>
          Please enter at least one search term
        </Typography>
      )}

      {/* Patient Search Results Dialog */}
      <AddVisitPatientSearchDialog
        openSearchResults={openSearchResults}
        setOpenSearchResults={setOpenSearchResults}
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        patients={patients}
        handleSelectExistingPatient={handleSelectExistingPatient}
        handleManuallyEnterPatientDetails={handleManuallyEnterPatientDetails}
      />
    </>
  );
};
