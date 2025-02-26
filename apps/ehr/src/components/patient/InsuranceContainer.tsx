import { Autocomplete, Box, Button, Checkbox, FormControlLabel, TextField, Typography, useTheme } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  COVERAGE_ADDITIONAL_INFORMATION_URL,
  coverageFieldPaths,
  RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL,
  relatedPersonFieldPaths,
  ResourceTypeNames,
} from 'utils';
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

export const InsuranceContainer: FC<InsuranceContainerProps> = ({ insuranceId }) => {
  const theme = useTheme();
  const {
    insurances,
    dropInsurance,
    policyHolders,
    tempInsurances,
    updateTempInsurance,
    removeTempInsurance,
    insurancePlans,
    updatePatientField,
  } = usePatientStore();

  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const { control } = useFormContext();

  const allInsurances = useMemo(
    () => [
      ...insurances.map((coverage) => {
        const relatedPerson = policyHolders.find(
          (person) => person.id === coverage.subscriber?.reference?.split('/')[1]
        );
        return { coverage, relatedPerson, isTemp: false };
      }),
      ...tempInsurances,
    ],
    [insurances, policyHolders, tempInsurances]
  );

  const insurance = allInsurances.find((insurance) => insurance.coverage.id === insuranceId);

  if (!insurance) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    const baseName = name.split('_')[0];
    if (insurance.isTemp) {
      const updatedInsurance = JSON.parse(JSON.stringify(insurance));

      if (baseName.startsWith('Coverage')) {
        switch (baseName) {
          case coverageFieldPaths.carrier:
            updatedInsurance.coverage.class[0].name = value;
            updatedInsurance.coverage.payor[0].reference = value;
            break;
          case coverageFieldPaths.memberId:
            updatedInsurance.coverage.identifier[0].value = value;
            updatedInsurance.coverage.subscriberId = value;
            break;
          case coverageFieldPaths.order:
            updatedInsurance.coverage.order = parseInt(value);
            break;
          case coverageFieldPaths.relationship:
            updatedInsurance.coverage.relationship.coding[0].display = value;
            break;
          case coverageFieldPaths.additionalInformation:
            updatedInsurance.coverage.extension[0].valueString = value;
            break;
        }
      }
      // Handle RelatedPerson fields
      else if (baseName.startsWith('RelatedPerson')) {
        switch (baseName) {
          case relatedPersonFieldPaths.firstName:
            if (!updatedInsurance.relatedPerson.name[0].given) {
              updatedInsurance.relatedPerson.name[0].given = [];
            }
            updatedInsurance.relatedPerson.name[0].given[0] = value;
            break;
          case relatedPersonFieldPaths.middleName:
            if (!updatedInsurance.relatedPerson.name[0].given) {
              updatedInsurance.relatedPerson.name[0].given = [''];
            }
            updatedInsurance.relatedPerson.name[0].given[1] = value;
            break;
          case relatedPersonFieldPaths.lastName:
            updatedInsurance.relatedPerson.name[0].family = value;
            break;
          case relatedPersonFieldPaths.birthDate:
            updatedInsurance.relatedPerson.birthDate = value;
            break;
          case relatedPersonFieldPaths.gender:
            updatedInsurance.relatedPerson.gender = value;
            break;
          case relatedPersonFieldPaths.streetAddress:
            if (!updatedInsurance.relatedPerson.address[0].line) {
              updatedInsurance.relatedPerson.address[0].line = [];
            }
            updatedInsurance.relatedPerson.address[0].line[0] = value;
            break;
          case relatedPersonFieldPaths.addressLine2:
            if (!updatedInsurance.relatedPerson.address[0].line) {
              updatedInsurance.relatedPerson.address[0].line = [''];
            }
            updatedInsurance.relatedPerson.address[0].line[1] = value;
            break;
          case relatedPersonFieldPaths.city:
            updatedInsurance.relatedPerson.address[0].city = value;
            break;
          case relatedPersonFieldPaths.state:
            updatedInsurance.relatedPerson.address[0].state = value;
            break;
          case relatedPersonFieldPaths.zip:
            updatedInsurance.relatedPerson.address[0].postalCode = value;
            break;
        }
      }

      updateTempInsurance(insurance.coverage.id || '', updatedInsurance);
    } else {
      if (baseName.startsWith(ResourceTypeNames.coverage)) {
        updatePatientField(baseName, value, insurance.coverage.id);
      } else if (baseName.startsWith(ResourceTypeNames.relatedPerson)) {
        updatePatientField(baseName, value, insurance.relatedPerson?.id);
      }
    }
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
    if (insurance.isTemp) {
      removeTempInsurance(insuranceId);
    } else {
      console.log('Remove insurance', insuranceId);
      updatePatientField(coverageFieldPaths.status, 'cancelled', insuranceId);
      dropInsurance(insuranceId);
    }
  };

  return (
    <Section title="Insurance Information">
      <Row label="Type" required>
        <FormSelect
          name={`${coverageFieldPaths.order}_${insurance.coverage.id}`}
          control={control}
          options={INSURANCE_COVERAGE_OPTIONS}
          defaultValue={insurance.coverage.order?.toString()}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Insurance carrier" required>
        <Controller
          name={`${coverageFieldPaths.carrier}_${insurance.coverage.id}`}
          control={control}
          defaultValue={insurance.coverage.class?.[0].name || ''}
          rules={{
            required: true,
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
                  handleChange({
                    target: {
                      name: `${coverageFieldPaths.carrier}_${insurance.coverage.id}`,
                      value: newValue?.name || '',
                    },
                  } as any);
                }}
                disableClearable
                fullWidth
                renderInput={(params) => <TextField {...params} variant="standard" error={!!error} required />}
              />
            );
          }}
        />
      </Row>
      <Row label="Member ID" required inputId={`insurance-member-id_${insurance.coverage.id}`}>
        <FormTextField
          id={`insurance-member-id_${insurance.coverage.id}`}
          name={`${coverageFieldPaths.memberId}_${insurance.coverage.id}`}
          control={control}
          defaultValue={insurance.coverage.identifier?.[0].value}
          rules={{ required: true }}
          onChangeHandler={handleChange}
        />
      </Row>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ShowMoreButton onClick={toggleMoreInfo} isOpen={showMoreInfo} />
      </Box>
      {showMoreInfo && (
        <>
          <Row
            label="Policy holder's first name"
            required
            inputId={`policy-holder-first-name_${insurance.relatedPerson?.id}`}
          >
            <FormTextField
              id={`policy-holder-first-name_${insurance.relatedPerson?.id}`}
              name={`${relatedPersonFieldPaths.firstName}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.name?.[0]?.given?.[0]}
              rules={{ required: true }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Policy holder's middle name" inputId={`policy-holder-middle-name_${insurance.relatedPerson?.id}`}>
            <FormTextField
              id={`policy-holder-middle-name_${insurance.relatedPerson?.id}`}
              name={`${relatedPersonFieldPaths.middleName}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.name?.[0]?.given?.[1]}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row
            label="Policy holder's last name"
            required
            inputId={`policy-holder-last-name_${insurance.relatedPerson?.id}`}
          >
            <FormTextField
              id={`policy-holder-last-name_${insurance.relatedPerson?.id}`}
              name={`${relatedPersonFieldPaths.lastName}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.name?.[0]?.family || ''}
              rules={{ required: true }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Policy holder's date of birth" required>
            <DatePicker
              name={`${relatedPersonFieldPaths.birthDate}_${insurance.relatedPerson?.id}`}
              control={control}
              required={true}
              defaultValue={insurance.relatedPerson?.birthDate}
              onChange={(dateStr) => {
                updatePatientField(relatedPersonFieldPaths.birthDate, dateStr, insurance.relatedPerson?.id);
              }}
            />
          </Row>
          <Row label="Policy holder's sex" required>
            <FormSelect
              name={`${relatedPersonFieldPaths.gender}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.gender}
              options={SEX_OPTIONS}
              rules={{ required: true }}
              onChangeHandler={handleChange}
            />
          </Row>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '5px',
            }}
          >
            <Controller
              name={`${relatedPersonFieldPaths.sameAsPatientAddress}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={
                insurance.relatedPerson?.extension?.find(
                  (e: { url: string }) => e.url === RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL
                )?.valueBoolean ?? true
              }
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
          <Row label="Street address" inputId={`policy-holder-street-address_${insurance.relatedPerson?.id}`}>
            <FormTextField
              id={`policy-holder-street-address_${insurance.relatedPerson?.id}`}
              name={`${relatedPersonFieldPaths.streetAddress}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.address?.[0]?.line?.[0]}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Address line 2" inputId={`policy-holder-street-address-line2_${insurance.relatedPerson?.id}`}>
            <FormTextField
              id={`policy-holder-street-address-line2_${insurance.relatedPerson?.id}`}
              name={`${relatedPersonFieldPaths.addressLine2}_${insurance.relatedPerson?.id}`}
              control={control}
              defaultValue={insurance.relatedPerson?.address?.[0]?.line?.[1]}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="City, State, ZIP">
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormTextField
                name={`${relatedPersonFieldPaths.city}_${insurance.relatedPerson?.id}`}
                control={control}
                defaultValue={insurance.relatedPerson?.address?.[0]?.city}
                onChangeHandler={handleChange}
              />
              <FormAutocomplete
                name={`${relatedPersonFieldPaths.state}_${insurance.relatedPerson?.id}`}
                control={control}
                defaultValue={insurance.relatedPerson?.address?.[0]?.state}
                options={STATE_OPTIONS}
                rules={{
                  validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
                }}
                onChangeHandler={handleAutocompleteChange}
              />
              <FormTextField
                name={`${relatedPersonFieldPaths.zip}_${insurance.relatedPerson?.id}`}
                control={control}
                defaultValue={insurance.relatedPerson?.address?.[0]?.postalCode}
                onChangeHandler={handleChange}
              />
            </Box>
          </Row>
          <Row label="Patient’s relationship to insured" required>
            <FormSelect
              name={`${coverageFieldPaths.relationship}_${insurance.coverage?.id}`}
              control={control}
              defaultValue={insurance.coverage?.relationship?.coding?.[0]?.display}
              options={RELATIONSHIP_TO_INSURED_OPTIONS}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Additional insurance information" inputId={`insurance-information_${insurance.coverage.id}`}>
            <FormTextField
              id={`insurance-information_${insurance.coverage.id}`}
              name={`${coverageFieldPaths.additionalInformation}_${insurance.coverage.id}`}
              control={control}
              defaultValue={
                insurance.coverage.extension?.find((extension) => extension.url === COVERAGE_ADDITIONAL_INFORMATION_URL)
                  ?.valueString
              }
              onChangeHandler={handleChange}
            />
          </Row>
          {insurance.coverage.order !== 1 && (
            <Button
              onClick={handleRemoveInsurance}
              variant="text"
              sx={{
                color: theme.palette.error.main,
                textTransform: 'none',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '0',
                width: 'fit-content',
              }}
            >
              Remove This Insurance
            </Button>
          )}
        </>
      )}
    </Section>
  );
};
