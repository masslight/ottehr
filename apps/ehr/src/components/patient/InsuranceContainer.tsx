import { Autocomplete, Box, Checkbox, TextField, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../../components/form';
import {
  INSURANCE_COVERAGE_OPTIONS,
  InsurancePriorityOptions,
  PatientIdentifyingFields,
  RELATIONSHIP_TO_INSURED_OPTIONS,
  SEX_OPTIONS,
  STATE_OPTIONS,
} from '../../constants';
import { Row, Section } from '../layout';
import ShowMoreButton from './ShowMoreButton';
import { InsurancePlanDTO, usePatientStore } from '../../state/patient.store';
import { PatientAddressFields } from '../../constants';
import { FormFields as AllFormFields } from '../../constants';
import { LoadingButton } from '@mui/lab';

type InsuranceContainerProps = {
  ordinal: number;
  removeInProgress?: boolean;
  handleRemoveClick?: () => void;
};

export const InsuranceContainer: FC<InsuranceContainerProps> = ({ ordinal, removeInProgress, handleRemoveClick }) => {
  //console.log('insuranceId', insuranceId);
  const theme = useTheme();
  const { insurancePlans } = usePatientStore();

  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [sameAsPatientAddress, setSameAsPatientAddress] = useState(false);

  const { control, setValue, watch } = useFormContext();

  const { FormFields, LocalAddressFields, LocalIdentifyingFields } = useMemo(() => {
    const FormFields = AllFormFields.insurance[ordinal - 1];

    const LocalAddressFields = [
      FormFields.streetAddress.key,
      FormFields.addressLine2.key,
      FormFields.city.key,
      FormFields.state.key,
      FormFields.zip.key,
    ];

    const LocalIdentifyingFields = [
      FormFields.firstName.key,
      FormFields.middleName.key,
      FormFields.lastName.key,
      FormFields.birthDate.key,
      FormFields.birthSex.key,
    ];
    return { FormFields, LocalAddressFields, LocalIdentifyingFields };
  }, [ordinal]);

  const patientAddressData = watch(PatientAddressFields);
  const patientIdentifyingData = watch(PatientIdentifyingFields);
  const localAddressData = watch(LocalAddressFields);
  const localIdentifyingData = watch(LocalIdentifyingFields);
  const selfSelected = watch(FormFields.relationship.key) === 'Self';

  useEffect(() => {
    if (sameAsPatientAddress || selfSelected) {
      for (let i = 0; i < localAddressData.length; i++) {
        if (patientAddressData[i] && localAddressData[i] !== patientAddressData[i]) {
          setValue(LocalAddressFields[i], patientAddressData[i]);
        }
      }
      if (selfSelected) {
        for (let i = 0; i < localIdentifyingData.length; i++) {
          if (patientIdentifyingData[i] && localIdentifyingData[i] !== patientIdentifyingData[i]) {
            setValue(LocalIdentifyingFields[i], patientIdentifyingData[i]);
          }
        }
      }
    }
  }, [
    LocalAddressFields,
    LocalIdentifyingFields,
    localAddressData,
    localIdentifyingData,
    patientAddressData,
    patientIdentifyingData,
    sameAsPatientAddress,
    selfSelected,
    setValue,
  ]);

  const toggleMoreInfo = (): void => {
    setShowMoreInfo((prev) => !prev);
  };

  const handleRemoveInsurance = (): void => {
    handleRemoveClick?.();
  };

  return (
    <Section title="Insurance information">
      <Row label="Type" required>
        <FormSelect
          name={FormFields.insurancePriority.key}
          control={control}
          defaultValue={ordinal === 1 ? 'Primary' : 'Secondary'}
          options={INSURANCE_COVERAGE_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value, ctxt) => {
              // todo: this validation concept would be good to lift into the paperwork validation engine
              const otherGroupKey = InsurancePriorityOptions.find((key) => key !== FormFields.insuranceCarrier.key);
              let otherGroupValue: 'Primary' | 'Secondary' | undefined;
              if (otherGroupKey) {
                otherGroupValue = ctxt[otherGroupKey];
              }
              if (otherGroupValue === value) {
                return `Account may not have two ${value.toLowerCase()} insurance plans`;
              }
              return true;
            },
          }}
        />
      </Row>
      <Row label="Insurance carrier" required>
        <Controller
          name={FormFields.insuranceCarrier.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) => insurancePlans.some((option) => `InsurancePlan/${option.id}` === value?.reference),
          }}
          render={({ field: { value }, fieldState: { error } }) => {
            const isLoading = insurancePlans.length === 0;

            const selectedOption = insurancePlans.find((option) => `InsurancePlan/${option.id}` === value?.reference);
            return (
              <Autocomplete
                options={insurancePlans}
                loading={isLoading}
                loadingText={'Loading...'}
                value={selectedOption ?? ({} as InsurancePlanDTO)}
                isOptionEqualToValue={(option, value) => {
                  return option?.id === value?.id;
                }}
                getOptionLabel={(option) => option.name || ''}
                onChange={(_, newValue) => {
                  if (newValue) {
                    setValue(
                      FormFields.insuranceCarrier.key,
                      { reference: `InsurancePlan/${newValue.id}`, display: newValue.name },
                      { shouldDirty: true }
                    );
                  } else {
                    setValue(FormFields.insuranceCarrier.key, null);
                  }
                }}
                disableClearable
                fullWidth
                renderInput={(params) => (
                  <TextField {...params} variant="standard" error={!!error} required helperText={error?.message} />
                )}
              />
            );
          }}
        />
      </Row>
      <Row label="Member ID" required inputId={FormFields.memberId.key}>
        <FormTextField
          id={FormFields.memberId.key}
          name={FormFields.memberId.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        />
      </Row>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ShowMoreButton onClick={toggleMoreInfo} isOpen={showMoreInfo} />
      </Box>
      {showMoreInfo && (
        <>
          <Row label="Policy holder's first name" required inputId={FormFields.firstName.key}>
            <FormTextField
              id={FormFields.firstName.key}
              name={FormFields.firstName.key}
              disabled={selfSelected}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row label="Policy holder's middle name" inputId={FormFields.middleName.key}>
            <FormTextField
              id={FormFields.middleName.key}
              name={FormFields.middleName.key}
              control={control}
              disabled={selfSelected}
            />
          </Row>
          <Row label="Policy holder's last name" required inputId={FormFields.lastName.key}>
            <FormTextField
              id={FormFields.lastName.key}
              name={FormFields.lastName.key}
              disabled={selfSelected}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row label="Policy holder's date of birth" required>
            <DatePicker name={FormFields.birthDate.key} control={control} required={true} disabled={selfSelected} />
          </Row>
          <Row label="Policy holder's sex" required>
            <FormSelect
              name={FormFields.birthSex.key}
              control={control}
              options={SEX_OPTIONS}
              disabled={selfSelected}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
              <Checkbox
                checked={sameAsPatientAddress || selfSelected}
                onChange={() => {
                  setSameAsPatientAddress((currentVal) => !currentVal);
                }}
                disabled={selfSelected}
              />
              <Typography>Policy holder address is the same as patient's address</Typography>
            </Box>
          </Box>
          <Row label="Street address" inputId={FormFields.streetAddress.key} required>
            <FormTextField
              id={FormFields.streetAddress.key}
              name={FormFields.streetAddress.key}
              disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[0])}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row label="Address line 2" inputId={FormFields.addressLine2.key}>
            <FormTextField
              id={FormFields.addressLine2.key}
              name={FormFields.addressLine2.key}
              disabled={sameAsPatientAddress || selfSelected}
              control={control}
            />
          </Row>
          <Row label="City, State, ZIP" required>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormTextField
                name={FormFields.city.key}
                disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[2])}
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
              <Controller
                name={FormFields.state.key}
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                render={({ field: { value }, fieldState: { error } }) => {
                  return (
                    <Autocomplete
                      options={STATE_OPTIONS.map((option) => option.value)}
                      disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[3])}
                      value={value ?? ''}
                      onChange={(_, newValue) => {
                        if (newValue) {
                          setValue(FormFields.state.key, newValue);
                        } else {
                          setValue(FormFields.state.key, '');
                        }
                      }}
                      disableClearable
                      fullWidth
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="standard"
                          error={!!error}
                          required
                          helperText={error?.message}
                        />
                      )}
                    />
                  );
                }}
              />
              <FormTextField
                name={FormFields.zip.key}
                control={control}
                disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[4])}
                rules={{
                  validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </Box>
          </Row>
          <Row label="Patient’s relationship to insured" required>
            <FormSelect
              name={FormFields.relationship.key}
              control={control}
              options={RELATIONSHIP_TO_INSURED_OPTIONS}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row label="Additional insurance information" inputId={FormFields.additionalInformation.key}>
            <FormTextField
              id={FormFields.additionalInformation.key}
              name={FormFields.additionalInformation.key}
              control={control}
            />
          </Row>
          <LoadingButton
            onClick={handleRemoveInsurance}
            variant="text"
            loading={removeInProgress}
            sx={{
              color: theme.palette.error.main,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 500,
              display: handleRemoveClick !== undefined ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: '0',
              width: 'fit-content',
            }}
          >
            Remove This Insurance
          </LoadingButton>
        </>
      )}
    </Section>
  );
};
