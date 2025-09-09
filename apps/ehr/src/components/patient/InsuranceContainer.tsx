import { LoadingButton } from '@mui/lab';
import { Autocomplete, Box, Checkbox, FormControlLabel, TextField, Typography, useTheme } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { FC, ReactElement, useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  chooseJson,
  CoverageCheckWithDetails,
  EligibilityCheckSimpleStatus,
  InsurancePlanDTO,
  InsurancePlanType,
  InsurancePlanTypes,
  isPostalCodeValid,
  mapEligibilityCheckResultToSimpleStatus,
  PatientPaymentBenefit,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../../components/form';
import {
  FormFields as AllFormFields,
  INSURANCE_COVERAGE_OPTIONS,
  InsurancePriorityOptions,
  PatientAddressFields,
  PatientIdentifyingFields,
  RELATIONSHIP_TO_INSURED_OPTIONS,
  SEX_OPTIONS,
  STATE_OPTIONS,
} from '../../constants';
import { dataTestIds } from '../../constants/data-test-ids';
import { usePatientStore } from '../../state/patient.store';
import { Row, Section } from '../layout';
import { RefreshableStatusChip, StatusStyleObject } from '../RefreshableStatusWidget';
import { CopayWidget } from './CopayWidget';
import ShowMoreButton from './ShowMoreButton';

type InsuranceContainerProps = {
  ordinal: number;
  patientId: string;
  initialEligibilityCheck?: CoverageCheckWithDetails;
  removeInProgress?: boolean;
  handleRemoveClick?: () => void;
};

export const STATUS_TO_STYLE_MAP: Record<EligibilityCheckSimpleStatus, StatusStyleObject> = {
  ELIGIBLE: {
    bgColor: '#C8E6C9',
    textColor: '#1B5E20',
  },
  'NOT ELIGIBLE': {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
  UNKNOWN: {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
};

function mapInitialStatus(
  initialCheckResult: CoverageCheckWithDetails | undefined
): SimpleStatusCheckWithDate | undefined {
  if (initialCheckResult) {
    const status = mapEligibilityCheckResultToSimpleStatus(initialCheckResult);
    return {
      status: status.status,
      dateISO: status.dateISO,
      copay: initialCheckResult.copay,
    };
  }
  return undefined;
}

interface SimpleStatusCheckWithDate {
  status: EligibilityCheckSimpleStatus;
  dateISO: string;
  copay?: PatientPaymentBenefit[];
}

export const InsuranceContainer: FC<InsuranceContainerProps> = ({
  ordinal,
  patientId,
  removeInProgress,
  initialEligibilityCheck,
  handleRemoveClick,
}) => {
  //console.log('insuranceId', insuranceId);
  const theme = useTheme();
  const { insurancePlans } = usePatientStore();

  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const [eligibilityStatus, setEligibilityStatus] = useState<SimpleStatusCheckWithDate | undefined>(
    mapInitialStatus(initialEligibilityCheck)
  );

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
  const insurancePriority = watch(FormFields.insurancePriority.key);
  const sameAsPatientAddress = watch(FormFields.policyHolderAddressAsPatient.key, false);

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

  const { oystehrZambda } = useApiClients();

  const recheckEligibility = useMutation({
    mutationFn: async () => {
      // todo: show an alert when form has unsaved changes?
      const coverageToCheck = insurancePriority?.toLowerCase();
      try {
        return oystehrZambda?.zambda
          .execute({
            id: 'get-eligibility',
            patientId,
            coverageToCheck: coverageToCheck,
          })
          .then((res) => {
            console.log('eligibility check result');
            const json = chooseJson(res);
            if (coverageToCheck === 'secondary') {
              return mapEligibilityCheckResultToSimpleStatus(json.secondary);
            } else {
              return mapEligibilityCheckResultToSimpleStatus(json.primary);
            }
          });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
  });

  const handleRecheckEligibility = async (): Promise<void> => {
    console.log('recheck eligibility', recheckEligibility);
    try {
      const result = await recheckEligibility.mutateAsync();
      if (result) {
        setEligibilityStatus(result);
      } else {
        console.error('Error rechecking eligibility:', 'No result returned');
      }
      console.log('Eligibility check result:', result);
    } catch (error) {
      console.error('Error rechecking eligibility:', error);
    }
  };

  const TitleWidget = (): ReactElement => {
    return (
      <RefreshableStatusChip
        status={eligibilityStatus?.status ?? 'UNKNOWN'}
        lastRefreshISO={eligibilityStatus?.dateISO ?? ''}
        styleMap={STATUS_TO_STYLE_MAP}
        isRefreshing={recheckEligibility.isPending}
        handleRefresh={handleRecheckEligibility}
      />
    );
  };

  const copayBenefits = eligibilityStatus?.copay ?? [];

  return (
    <Section title="Insurance information" dataTestId="insuranceContainer" titleWidget={<TitleWidget />}>
      <Box
        sx={{
          marginLeft: '12px',
          marginTop: 2,
        }}
      >
        <CopayWidget copay={copayBenefits} />
      </Box>
      <Row label="Type" required dataTestId={dataTestIds.insuranceContainer.type}>
        <FormSelect
          name={FormFields.insurancePriority.key}
          control={control}
          defaultValue={ordinal === 1 ? 'Primary' : 'Secondary'}
          options={INSURANCE_COVERAGE_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value, context) => {
              // todo: this validation concept would be good to lift into the paperwork validation engine
              const otherGroupKey = InsurancePriorityOptions.find((key) => key !== FormFields.insurancePriority.key);
              let otherGroupValue: 'Primary' | 'Secondary' | undefined;
              if (otherGroupKey) {
                otherGroupValue = context[otherGroupKey];
              }
              if (otherGroupValue === value) {
                return `Account may not have two ${value.toLowerCase()} insurance plans`;
              }
              return true;
            },
          }}
        />
      </Row>
      <Row label="Insurance carrier" required dataTestId={dataTestIds.insuranceContainer.insuranceCarrier}>
        <Controller
          name={FormFields.insuranceCarrier.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) => insurancePlans.some((option) => `Organization/${option.id}` === value?.reference),
          }}
          render={({ field: { value }, fieldState: { error } }) => {
            const isLoading = insurancePlans.length === 0;

            const selectedOption = insurancePlans.find((option) => `Organization/${option.id}` === value?.reference);
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
                      { reference: `Organization/${newValue.id}`, display: newValue.name },
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
      <Row label="Insurance Type" required dataTestId={dataTestIds.insuranceContainer.insurancePlanType}>
        <Controller
          name={FormFields.insurancePlanType.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) => InsurancePlanTypes.some((option) => option.candidCode === value),
          }}
          render={({ field: { value }, fieldState: { error } }) => {
            const selectedOption = InsurancePlanTypes.find((option) => option.candidCode === `${value}`);
            return (
              <Autocomplete
                options={InsurancePlanTypes}
                value={selectedOption ?? ({} as InsurancePlanType)}
                isOptionEqualToValue={(option, value) => option?.candidCode === value?.candidCode}
                getOptionLabel={(option) =>
                  option.candidCode || option.label ? `${option.candidCode} - ${option.label}` : ''
                }
                onChange={(_, newValue) => {
                  if (newValue) {
                    setValue(FormFields.insurancePlanType.key, newValue.candidCode, { shouldDirty: true });
                  } else {
                    setValue(FormFields.insurancePlanType.key, null);
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
      <Row
        label="Member ID"
        required
        inputId={FormFields.memberId.key}
        dataTestId={dataTestIds.insuranceContainer.memberId}
      >
        <FormTextField
          id={FormFields.memberId.key}
          name={FormFields.memberId.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        />
      </Row>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ShowMoreButton
          onClick={toggleMoreInfo}
          isOpen={showMoreInfo}
          dataTestId={dataTestIds.insuranceContainer.showMoreButton}
        />
      </Box>
      {showMoreInfo && (
        <>
          <Row
            label="Policy holder's first name"
            required
            inputId={FormFields.firstName.key}
            dataTestId={dataTestIds.insuranceContainer.policyHoldersFirstName}
          >
            <FormTextField
              id={FormFields.firstName.key}
              name={FormFields.firstName.key}
              disabled={selfSelected}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row
            label="Policy holder's middle name"
            inputId={FormFields.middleName.key}
            dataTestId={dataTestIds.insuranceContainer.policyHoldersMiddleName}
          >
            <FormTextField
              id={FormFields.middleName.key}
              name={FormFields.middleName.key}
              control={control}
              disabled={selfSelected}
            />
          </Row>
          <Row
            label="Policy holder's last name"
            required
            inputId={FormFields.lastName.key}
            dataTestId={dataTestIds.insuranceContainer.policyHoldersLastName}
          >
            <FormTextField
              id={FormFields.lastName.key}
              name={FormFields.lastName.key}
              disabled={selfSelected}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row
            label="Policy holder's date of birth"
            required
            dataTestId={dataTestIds.insuranceContainer.policyHoldersDateOfBirth}
          >
            <DatePicker
              name={FormFields.birthDate.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              disabled={selfSelected}
            />
          </Row>
          <Row label="Policy holder's sex" required dataTestId={dataTestIds.insuranceContainer.policyHoldersSex}>
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
              <Controller
                key={sameAsPatientAddress}
                name={FormFields.policyHolderAddressAsPatient.key}
                control={control}
                render={({ field: { value, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        data-testid={dataTestIds.insuranceContainer.policyHolderAddressCheckbox}
                        checked={value}
                        onChange={(e) => {
                          const checked = (e.target as HTMLInputElement).checked;
                          setValue(FormFields.policyHolderAddressAsPatient.key, checked, { shouldDirty: true });
                        }}
                        disabled={selfSelected}
                      />
                    }
                    label={<Typography>Policy holder address is the same as patient's address</Typography>}
                  />
                )}
              />
            </Box>
          </Box>
          <Row
            label="Street address"
            inputId={FormFields.streetAddress.key}
            required
            dataTestId={dataTestIds.insuranceContainer.streetAddress}
          >
            <FormTextField
              id={FormFields.streetAddress.key}
              name={FormFields.streetAddress.key}
              disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[0])}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row
            label="Address line 2"
            inputId={FormFields.addressLine2.key}
            dataTestId={dataTestIds.insuranceContainer.addressLine2}
          >
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
                data-testid={dataTestIds.insuranceContainer.city}
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
                          data-testid={dataTestIds.insuranceContainer.state}
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
                data-testid={dataTestIds.insuranceContainer.zip}
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
          <Row
            label="Patient’s relationship to insured"
            required
            dataTestId={dataTestIds.insuranceContainer.relationship}
          >
            <FormSelect
              name={FormFields.relationship.key}
              control={control}
              options={RELATIONSHIP_TO_INSURED_OPTIONS}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            />
          </Row>
          <Row
            label="Additional insurance information"
            inputId={FormFields.additionalInformation.key}
            dataTestId={dataTestIds.insuranceContainer.additionalInformation}
          >
            <FormTextField
              id={FormFields.additionalInformation.key}
              name={FormFields.additionalInformation.key}
              control={control}
            />
          </Row>
          <LoadingButton
            data-testid={dataTestIds.insuranceContainer.removeButton}
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
