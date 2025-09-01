import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  // MenuItem,
  // Select,
  TextField,
  Typography,
  // InputLabel,
} from '@mui/material';
import { Address, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { PatternFormat } from 'react-number-format';
import { AllStatesToVirtualLocationLabels, standardizePhoneNumber } from 'utils';
import { EMAIL_REGEX, ZIP_REGEX } from '../../constants';
import { useAppointmentData, useEditPatientInformationMutation } from '../../telemed/state';
import DateSearch from '../DateSearch';
import { RoundedButton } from '../RoundedButton';

interface EditPatientDialogProps {
  modalOpen: boolean;
  onClose: () => void;
}

interface FormInputs {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  // suffix?: string;
  dateOfBirth: DateTime | null;
  primaryPhoneNumber?: string;
  secondaryPhoneNumber?: string;
  primaryEmail?: string;
  secondaryEmail?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const createPatientResourcePatchData = (patient: Patient, data: FormInputs): Patient => {
  const patientData: Patient = {
    ...patient,
    resourceType: 'Patient',
    id: patient.id,
    name: [
      {
        use: 'official',
        family: data.lastName,
        given: [data.firstName!],
        // suffix: [],
      },
    ],
    telecom: [],
    birthDate: data.dateOfBirth!.toISODate()!,
  };
  if (data.middleName) {
    patientData.name![0].given?.push(data.middleName);
  }
  if (data.preferredName) {
    patientData.name?.push({
      use: 'nickname',
      given: [data.preferredName],
    });
  }
  // if (data.suffix && data.suffix.length > 0) {
  //   patientData.name![0].suffix?.push(data.suffix);
  // }

  // patient's Phones
  if (data.primaryPhoneNumber) {
    patientData.telecom!.push({
      system: 'phone',
      use: 'mobile',
      rank: 1,
      value: data.primaryPhoneNumber,
    });
  }
  if (data.secondaryPhoneNumber) {
    patientData.telecom!.push({
      system: 'phone',
      use: 'mobile',
      rank: 2,
      value: data.secondaryPhoneNumber,
    });
  }

  // patient's Emails
  if (data.primaryEmail) {
    patientData.telecom!.push({
      system: 'email',
      rank: 1,
      value: data.primaryEmail,
    });
  }
  if (data.secondaryEmail) {
    patientData.telecom!.push({
      system: 'email',
      rank: 2,
      value: data.secondaryEmail,
    });
  }

  // patient's Address
  const addressEntry: Address = { ...(patient?.address?.[0] ?? {}) };
  if (data.addressLineOne) {
    const addressLines = [];
    addressLines.push(data.addressLineOne);
    addressEntry.line = addressLines;
  }
  if (data.addressLineTwo) {
    const addressLines = [...(addressEntry.line ?? [])];
    addressLines.push(data.addressLineTwo);
    addressEntry.line = addressLines;
  }
  if (data.city) {
    addressEntry.city = data.city;
  }
  if (data.state) {
    addressEntry.state = data.state;
  }
  if (data.zipCode) {
    addressEntry.postalCode = data.zipCode;
  }

  if (Object.keys(addressEntry).length !== 0) {
    patientData.address = [addressEntry];
  }

  return patientData;
};

const isValidPhoneNumber = (phoneNumber: string): boolean => {
  return phoneNumber.length === 10;
};

const isValidEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

const isValidZipCode = (zipCode: string): boolean => {
  return ZIP_REGEX.test(zipCode);
};

const EditPatientDialog = ({ modalOpen, onClose }: EditPatientDialogProps): ReactElement => {
  const {
    register,
    handleSubmit,
    formState,
    control,
    setError: setFormError,
    resetField,
    setValue,
    getValues,
  } = useForm<FormInputs>();
  const [error, setError] = useState(false);
  const { patient, appointmentSetState: setState } = useAppointmentData();
  const [isSavingData, setSavingData] = useState<boolean>(false);
  const possibleUsStates = Object.keys(AllStatesToVirtualLocationLabels);
  const statesDropdownOptions: string[] = [...possibleUsStates.map((usState) => usState)];
  const phoneNumberErrorMessage = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
  const emailErrorMessage = 'Email is not valid';
  const zipCodeErrorMessage = 'ZIP Code must be 5 numbers';

  useEffect(() => {
    setValue('dateOfBirth', patient?.birthDate ? DateTime.fromISO(patient?.birthDate) : null);
    const nameEntryOfficial = patient?.name?.find((nameEntry) => nameEntry.use === 'official');
    const nameEntryNickname = patient?.name?.find((nameEntry) => nameEntry.use === 'nickname');
    setValue('firstName', nameEntryOfficial?.given?.[0]);
    setValue('middleName', nameEntryOfficial?.given?.[1]);
    setValue('lastName', nameEntryOfficial?.family);
    setValue('preferredName', nameEntryNickname?.given?.[0]);
    // setValue('suffix', nameEntry?.suffix?.[0]);

    const telecomEntry = patient?.telecom || [];
    const phoneNumbers = telecomEntry.filter((element) => element?.system?.toLowerCase() === 'phone');
    const masterPrimaryPhone = standardizePhoneNumber(
      phoneNumbers.find((element) => element.rank === 1)?.value ?? phoneNumbers?.[0]?.value
    );
    const masterSecondaryPhone = standardizePhoneNumber(phoneNumbers.find((element) => element.rank === 2)?.value);
    setValue('primaryPhoneNumber', masterPrimaryPhone);
    setValue('secondaryPhoneNumber', masterSecondaryPhone);

    const emails = telecomEntry.filter((element) => element?.system?.toLowerCase() === 'email');
    const masterPrimaryEmail = emails.find((element) => element.rank === 1)?.value ?? emails?.[0]?.value;
    const masterSecondaryEmail = emails.find((element) => element.rank === 2)?.value;
    setValue('primaryEmail', masterPrimaryEmail);
    setValue('secondaryEmail', masterSecondaryEmail);

    const addressEntry = patient?.address?.[0];

    const masterAddressLineOne = addressEntry?.line?.[0];
    const masterAddressLineTwo = addressEntry?.line?.[1];
    setValue('addressLineOne', masterAddressLineOne);
    setValue('addressLineTwo', masterAddressLineTwo);

    const city = addressEntry?.city;
    const state = addressEntry?.state;
    const zipCode = addressEntry?.postalCode;

    setValue('city', city);
    setValue('state', state);
    setValue('zipCode', zipCode);
  }, [patient, setValue]);

  // const suffixOptions = ['II', 'III', 'IV', 'Jr', 'Sr'];
  const editPatient = useEditPatientInformationMutation();

  const onSubmit = useCallback(
    async (data: FormInputs): Promise<void> => {
      try {
        if (!patient?.id) {
          throw new Error('Patient reference not provided');
        }

        setSavingData(true);

        const patchedPatientData = createPatientResourcePatchData(patient, data);

        // Updates Patient's master record
        await editPatient.mutateAsync({ originalPatientData: patient, updatedPatientData: patchedPatientData });

        setState({
          patient: { ...patchedPatientData },
        });

        onClose();
      } catch (error) {
        setError(true);
        console.error('Error while editing patient information: ', error);
      } finally {
        setSavingData(false);
      }
    },
    [patient, editPatient, onClose, setState]
  );

  return (
    <Dialog
      open={modalOpen}
      onClose={onClose}
      fullWidth
      disableScrollLock
      sx={{ '.MuiPaper-root': { padding: 1, width: '512px', height: '800px', maxWidth: 'initial' } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle
          variant="h4"
          color="primary.dark"
          sx={{ width: '100%', py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}
        >
          Edit Patient Information
          <IconButton onClick={onClose} aria-label="close" sx={{ mr: -3, mt: -3 }}>
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'auto' }}>
          <FormControl fullWidth required sx={{ mt: 1 }}>
            <TextField
              {...register('firstName', { required: true })}
              id="first-name"
              label="First Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.firstName}
              required
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              {...register('middleName')}
              id="middle-name"
              label="Middle Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.middleName}
            />
          </FormControl>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('lastName', { required: true })}
              id="last-name"
              label="Last Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.lastName}
              required
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              {...register('preferredName')}
              id="preferred-name"
              label="Preferred name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.preferredName}
            />
          </FormControl>
          {/* <FormControl fullWidth sx={{ mt: 2 }}>
            <Controller
              name={'suffix'}
              control={control}
              render={({ field: { value } }) => (
                <>
                  <InputLabel>Suffix</InputLabel>
                  <Select
                    value={value}
                    label="Suffix"
                    variant="outlined"
                    fullWidth
                    error={!!formState.errors.suffix}
                    defaultValue=""
                    onChange={(event) => {
                      const selectedSuffix = event.target.value;
                      const valueToSet = selectedSuffix && selectedSuffix.length > 0 ? selectedSuffix : '';
                      resetField('suffix');
                      setValue('suffix', valueToSet);
                    }}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {suffixOptions.map((suffix, index) => (
                      <MenuItem key={index} value={suffix}>
                        {suffix}
                      </MenuItem>
                    ))}
                  </Select>
                </>
              )}
            />
          </FormControl> */}
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <Controller
              name={'dateOfBirth'}
              control={control}
              render={({ field: { value } }) => (
                <DateSearch
                  date={value || null}
                  setDate={(date) => setValue('dateOfBirth', date)}
                  setIsValidDate={(valid) => {
                    if (valid) {
                      const val = getValues('dateOfBirth');
                      resetField('dateOfBirth');
                      setValue('dateOfBirth', val);
                    } else {
                      setFormError('dateOfBirth', { message: 'Date of birth is not valid' });
                    }
                  }}
                  defaultValue={null}
                  label="Date of birth"
                  required
                ></DateSearch>
              )}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }} required>
            <Controller
              name={'primaryPhoneNumber'}
              control={control}
              render={({ field: { value } }) => (
                <PatternFormat
                  customInput={TextField}
                  value={value}
                  format="(###) ###-####"
                  mask=" "
                  label="Primary phone"
                  variant="outlined"
                  placeholder="(XXX) XXX-XXXX"
                  required
                  fullWidth
                  error={!!formState.errors.primaryPhoneNumber}
                  helperText={formState.errors.primaryPhoneNumber ? phoneNumberErrorMessage : ''}
                  onValueChange={(values, sourceInfo) => {
                    if (sourceInfo.source === 'event') {
                      const enteredPhoneNumber = values.value;
                      const isNoValueSet = !enteredPhoneNumber || enteredPhoneNumber.length === 0;
                      if (isNoValueSet || isValidPhoneNumber(enteredPhoneNumber)) {
                        resetField('primaryPhoneNumber');
                        setValue('primaryPhoneNumber', enteredPhoneNumber);
                      } else {
                        setFormError('primaryPhoneNumber', { message: phoneNumberErrorMessage });
                      }
                    }
                  }}
                />
              )}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Controller
              name={'secondaryPhoneNumber'}
              control={control}
              render={({ field: { value } }) => (
                <PatternFormat
                  customInput={TextField}
                  value={value}
                  format="(###) ###-####"
                  mask=" "
                  label="Secondary phone"
                  variant="outlined"
                  placeholder="(XXX) XXX-XXXX"
                  fullWidth
                  error={!!formState.errors.secondaryPhoneNumber}
                  helperText={formState.errors.secondaryPhoneNumber ? phoneNumberErrorMessage : ''}
                  onValueChange={(values, sourceInfo) => {
                    if (sourceInfo.source === 'event') {
                      const enteredPhoneNumber = values.value;
                      const isNoValueSet = !enteredPhoneNumber || enteredPhoneNumber.length === 0;
                      if (isNoValueSet || isValidPhoneNumber(enteredPhoneNumber)) {
                        resetField('secondaryPhoneNumber');
                        setValue('secondaryPhoneNumber', enteredPhoneNumber);
                      } else {
                        setFormError('secondaryPhoneNumber', { message: phoneNumberErrorMessage });
                      }
                    }
                  }}
                />
              )}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }} required>
            <Controller
              name={'primaryEmail'}
              control={control}
              render={({ field: { value } }) => (
                <TextField
                  label="Primary email"
                  value={value}
                  variant="outlined"
                  error={!!formState.errors.primaryEmail}
                  helperText={formState.errors.primaryEmail ? emailErrorMessage : ''}
                  type="email"
                  fullWidth
                  required
                  onChange={(event) => {
                    const enteredEmail = event.target.value;
                    const isValueEntered = enteredEmail && enteredEmail.length !== 0;
                    resetField('primaryEmail');
                    setValue('primaryEmail', enteredEmail);
                    if (isValueEntered && !isValidEmail(enteredEmail)) {
                      setFormError('primaryEmail', { message: emailErrorMessage });
                    }
                  }}
                />
              )}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Controller
              name={'secondaryEmail'}
              control={control}
              render={({ field: { value } }) => (
                <TextField
                  label="Secondary email"
                  value={value}
                  variant="outlined"
                  error={!!formState.errors.secondaryEmail}
                  helperText={formState.errors.secondaryEmail ? emailErrorMessage : ''}
                  type="email"
                  fullWidth
                  onChange={(event) => {
                    const enteredEmail = event.target.value;
                    const isValueEntered = enteredEmail && enteredEmail.length !== 0;
                    resetField('secondaryEmail');
                    setValue('secondaryEmail', enteredEmail);
                    if (isValueEntered && !isValidEmail(enteredEmail)) {
                      setFormError('secondaryEmail', { message: emailErrorMessage });
                    }
                  }}
                />
              )}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }} required>
            <TextField
              {...register('addressLineOne')}
              id="address-one"
              label="Address"
              variant="outlined"
              fullWidth
              required
              error={!!formState.errors.addressLineOne}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              {...register('addressLineTwo')}
              id="address-two"
              label="Address 2"
              variant="outlined"
              fullWidth
              error={!!formState.errors.addressLineTwo}
            />
          </FormControl>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4} md={4}>
              <FormControl fullWidth required>
                <TextField
                  {...register('city')}
                  id="city"
                  label="City"
                  variant="outlined"
                  fullWidth
                  required
                  error={!!formState.errors.city}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={4}>
              <FormControl fullWidth required>
                <Controller
                  name={'state'}
                  control={control}
                  render={({ field: { value } }) => (
                    <Autocomplete
                      value={value}
                      onChange={(event, selectedState) => {
                        setValue('state', selectedState ? selectedState : undefined);
                      }}
                      getOptionLabel={(state) => state || 'Unknown'}
                      isOptionEqualToValue={(option, tempValue) => option === tempValue}
                      options={statesDropdownOptions}
                      renderOption={(props, option) => {
                        return (
                          <li {...props} key={option}>
                            {option}
                          </li>
                        );
                      }}
                      fullWidth
                      disableClearable={true}
                      renderInput={(params) => <TextField name="state" {...params} label="State" required />}
                    />
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={4}>
              <FormControl fullWidth required>
                <Controller
                  name={'zipCode'}
                  control={control}
                  render={({ field: { value } }) => (
                    <TextField
                      sx={{
                        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                          display: 'none',
                        },
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                      }}
                      label="ZIP"
                      type="number"
                      value={value}
                      variant="outlined"
                      error={!!formState.errors.zipCode}
                      helperText={formState.errors.zipCode ? zipCodeErrorMessage : ''}
                      fullWidth
                      required
                      onChange={(event) => {
                        const enteredZipCode = event.target.value;
                        resetField('zipCode');
                        setValue('zipCode', enteredZipCode);
                        if (!isValidZipCode(enteredZipCode)) {
                          setFormError('zipCode', { message: zipCodeErrorMessage });
                        }
                      }}
                    />
                  )}
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <RoundedButton
            sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, ml: 1, mb: 1 }}
            onClick={onClose}
            color="primary"
          >
            Cancel
          </RoundedButton>
          <LoadingButton
            loading={isSavingData}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, mr: 2, mb: 1, px: 4 }}
            disabled={!formState.isValid}
          >
            Save
          </LoadingButton>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error editing this patient, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};

export default EditPatientDialog;
