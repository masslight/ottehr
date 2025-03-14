import { Autocomplete, Box, Button, Checkbox, FormControlLabel, TextField, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { isPostalCodeValid, relatedPersonFieldPaths, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { BasicDatePicker as DatePicker, FormAutocomplete, FormSelect, FormTextField } from '../../components/form';
import {
  INSURANCE_COVERAGE_OPTIONS,
  RELATIONSHIP_TO_INSURED_OPTIONS,
  SEX_OPTIONS,
  STATE_OPTIONS,
} from '../../constants';
import { Row, Section } from '../layout';
import ShowMoreButton from './ShowMoreButton';
import { InsurancePlanDTO, usePatientStore } from '../../state/patient.store';

type InsuranceContainerProps = {
  insuranceId: string;
};

const FormFields = {
  insurancePriority: { key: 'insurance-priority', type: 'String' },
  insuranceCarrier: { key: 'insurance-carrier', type: 'Reference' },
  memberId: { key: 'insurance-member-id', type: 'String' },
  firstName: { key: 'policy-holder-first-name', type: 'String' },
  middleName: { key: 'policy-holder-middle-name', type: 'String' },
  lastName: { key: 'policy-holder-last-name', type: 'String' },
  birthDate: { key: 'policy-holder-date-of-birth', type: 'String' },
  birthSex: { key: 'policy-holder-birth-sex', type: 'String' },
  streetAddress: { key: 'policy-holder-address', type: 'String' },
  addressLine2: { key: 'policy-holder-address-additional-line', type: 'String' },
  city: { key: 'policy-holder-city', type: 'String' },
  state: { key: 'policy-holder-state', type: 'String' },
  zip: { key: 'policy-holder-zip', type: 'String' },
  relationship: { key: 'patient-relationship-to-insured', type: 'String' },
  additionalInformation: { key: 'insurance-additional-information', type: 'String' },
};

export const InsuranceContainer: FC<InsuranceContainerProps> = ({ insuranceId }) => {
  console.log('insuranceId', insuranceId);
  const theme = useTheme();
  const { insurancePlans } = usePatientStore();

  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const { control, trigger } = useFormContext();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>, insurancePlan?: InsurancePlanDTO): void => {
    console.log('event', event);
    console.log('insurancePlan', insurancePlan);
  };

  const handleAutocompleteChange = (name: string, value: string): void => {
    handleChange({
      target: {
        name,
        value,
      },
    } as any);
  };

  const toggleMoreInfo = (): void => {
    setShowMoreInfo((prev) => !prev);
  };

  const handleRemoveInsurance = (): void => {
    console.log('remove insurance');
  };

  return (
    <Section title="Insurance Information">
      <Row label="Type" required>
        <FormSelect
          name={FormFields.insurancePriority.key}
          control={control}
          options={INSURANCE_COVERAGE_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Insurance carrier" required>
        <Controller
          name={FormFields.insuranceCarrier.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) => insurancePlans.some((option) => option.name === value),
          }}
          render={({ field: { onChange, value }, fieldState: { error } }) => {
            const isLoading = insurancePlans.length === 0;
            const selectedOption = insurancePlans.find((option) => option.name === value);
            return (
              <Autocomplete
                options={insurancePlans}
                loading={isLoading}
                loadingText={'Loading...'}
                value={isLoading ? ({} as InsurancePlanDTO) : selectedOption || ({} as InsurancePlanDTO)}
                getOptionLabel={(option) => option.name || ''}
                onChange={(_, newValue) => {
                  onChange(newValue?.name || '');
                  handleChange(
                    {
                      target: {
                        name: FormFields.insuranceCarrier.key,
                        value: newValue?.name || '',
                      },
                    } as any,
                    newValue
                  );
                  void trigger(FormFields.insuranceCarrier.key);
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
          onChangeHandler={handleChange}
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
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Policy holder's middle name" inputId={FormFields.middleName.key}>
            <FormTextField
              id={FormFields.middleName.key}
              name={FormFields.middleName.key}
              control={control}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Policy holder's last name" required inputId={FormFields.lastName.key}>
            <FormTextField
              id={FormFields.lastName.key}
              name={FormFields.lastName.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Policy holder's date of birth" required>
            <DatePicker name={FormFields.birthDate.key} control={control} required={true} />
          </Row>
          <Row label="Policy holder's sex" required>
            <FormSelect
              name={FormFields.birthSex.key}
              control={control}
              options={SEX_OPTIONS}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <Controller
              name={relatedPersonFieldPaths.sameAsPatientAddress}
              control={control}
              render={({ field: { onChange, value, ...field } }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={!value}
                      onChange={(e) => {
                        const newActiveValue = !e.target.checked;
                        onChange(newActiveValue);
                        handleChange({
                          ...e,
                          target: {
                            ...e.target,
                            name: relatedPersonFieldPaths.sameAsPatientAddress,
                            checked: newActiveValue,
                          },
                        });
                      }}
                    />
                  }
                  label={<Typography>Policy holder address is the same as patient's address</Typography>}
                />
              )}
            />
          </Box>
          <Row label="Street address" inputId={FormFields.streetAddress.key} required>
            <FormTextField
              id={FormFields.streetAddress.key}
              name={FormFields.streetAddress.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Address line 2" inputId={FormFields.addressLine2.key}>
            <FormTextField
              id={FormFields.addressLine2.key}
              name={FormFields.addressLine2.key}
              control={control}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="City, State, ZIP" required>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormTextField
                name={FormFields.city.key}
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                onChangeHandler={handleChange}
              />
              <FormAutocomplete
                name={FormFields.state.key}
                control={control}
                options={STATE_OPTIONS}
                rules={{
                  validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                onChangeHandler={handleAutocompleteChange}
              />
              <FormTextField
                name={FormFields.zip.key}
                control={control}
                rules={{
                  validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                onChangeHandler={handleChange}
              />
            </Box>
          </Row>
          <Row label="Patient’s relationship to insured" required>
            <FormSelect
              name={FormFields.relationship.key}
              control={control}
              options={RELATIONSHIP_TO_INSURED_OPTIONS}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Additional insurance information" inputId={FormFields.additionalInformation.key}>
            <FormTextField
              id={FormFields.additionalInformation.key}
              name={FormFields.additionalInformation.key}
              control={control}
              onChangeHandler={handleChange}
            />
          </Row>
          <Button
            onClick={handleRemoveInsurance}
            variant="text"
            sx={{
              color: theme.palette.error.main,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: '0',
              width: 'fit-content',
            }}
          >
            Remove This Insurance
          </Button>
        </>
      )}
    </Section>
  );
};
