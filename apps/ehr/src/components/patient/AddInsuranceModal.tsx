import { Close } from '@mui/icons-material';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  useTheme,
} from '@mui/material';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import {
  coverageFieldPaths,
  InsurancePlanDTO,
  isPostalCodeValid,
  relatedPersonFieldPaths,
  REQUIRED_FIELD_ERROR_MESSAGE,
  SUBSCRIBER_RELATIONSHIP_CODE_MAP,
} from 'utils';
import { RELATIONSHIP_TO_INSURED_OPTIONS, SEX_OPTIONS, STATE_OPTIONS } from '../../constants';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField, LabeledField, Option } from '../form';
import { usePatientStore } from '../../state/patient.store';

interface AddInsuranceModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddInsuranceModal: React.FC<AddInsuranceModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const { insurancePlans, patient, addTempInsurance, insurances, tempInsurances } = usePatientStore();

  const onSubmit = (data: any): void => {
    if (!patient) return;

    // Create RelatedPerson resource
    const relatedPersonResource: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: uuid(),
      name: [
        {
          given: [
            data[relatedPersonFieldPaths.firstName],
            ...(data[relatedPersonFieldPaths.middleName] ? [data[relatedPersonFieldPaths.middleName]] : []),
          ],
          family: data[relatedPersonFieldPaths.lastName],
        },
      ],
      gender: data[relatedPersonFieldPaths.gender],
      patient: {
        reference: `Patient/${patient.id}`,
      },
      birthDate: data[relatedPersonFieldPaths.birthDate],
      relationship: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
              code: SUBSCRIBER_RELATIONSHIP_CODE_MAP[data[coverageFieldPaths.relationship]],
              display: data[coverageFieldPaths.relationship],
            },
          ],
        },
      ],
    };

    // Add address only if any address field is filled
    const hasAddressFields = [
      data[relatedPersonFieldPaths.streetAddress],
      data[relatedPersonFieldPaths.addressLine2],
      data[relatedPersonFieldPaths.city],
      data[relatedPersonFieldPaths.state],
      data[relatedPersonFieldPaths.zip],
    ].some((field) => field);

    if (hasAddressFields) {
      relatedPersonResource.address = [
        {
          line: [
            data[relatedPersonFieldPaths.streetAddress],
            ...(data[relatedPersonFieldPaths.addressLine2] ? [data[relatedPersonFieldPaths.addressLine2]] : []),
          ].filter(Boolean), // Remove empty lines
          ...(data[relatedPersonFieldPaths.city] && { city: data[relatedPersonFieldPaths.city] }),
          ...(data[relatedPersonFieldPaths.state] && { state: data[relatedPersonFieldPaths.state] }),
          ...(data[relatedPersonFieldPaths.zip] && { postalCode: data[relatedPersonFieldPaths.zip] }),
        },
      ];
    }

    // Create Coverage resource
    const countOfInsurances = insurances.length + tempInsurances.length;
    const coverageResource: Coverage = {
      resourceType: 'Coverage',
      id: uuid(),
      status: 'active',
      subscriberId: data[coverageFieldPaths.memberId],
      subscriber: {
        reference: `RelatedPerson/${relatedPersonResource.id}`,
      },
      beneficiary: {
        type: 'Patient',
        reference: `Patient/${patient.id}`,
      },
      payor: [
        {
          reference: 'Organization/65eebe57-0b68-49e5-a96d-abb1123f9aa4', // data[CoverageFieldPaths.carrier],
        },
      ],
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: SUBSCRIBER_RELATIONSHIP_CODE_MAP[data[coverageFieldPaths.relationship]],
            display: data[coverageFieldPaths.relationship],
          },
        ],
      },
      class: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                code: 'plan',
              },
            ],
          },
          value: '951',
          name: data[coverageFieldPaths.carrier],
        },
      ],
      order: countOfInsurances + 1,
      identifier: [
        {
          value: data[coverageFieldPaths.memberId],
        },
      ],
    };

    // Add extension only if additional information is provided
    if (data['Coverage/additionalInformation']) {
      coverageResource.extension = [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
          valueString: data['Coverage/additionalInformation'],
        },
      ];
    }

    addTempInsurance(coverageResource, relatedPersonResource);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { p: 2, maxWidth: 'none' } }}>
      <DialogTitle
        variant="h5"
        color="secondary.main"
        sx={{
          width: '100%',
          fontSize: '24px',
          color: theme.palette.primary.dark,
          fontWeight: '600 !important',
        }}
      >
        Add Secondary Insurance
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2} columns={9} sx={{ pt: 1 }}>
          <Grid item xs={3}>
            <LabeledField label='Insurance carrier' required error={!!errors[coverageFieldPaths.carrier]}>
              <Controller
                name={coverageFieldPaths.carrier}
                control={control}
                defaultValue={null}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value) => insurancePlans.some((option) => option.name === value),
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={insurancePlans}
                    value={(insurancePlans.find((option) => option.name === value) || null) as InsurancePlanDTO}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.name === value?.name || (!option && !value)}
                    onChange={(_, newValue) => {
                      onChange(newValue?.name || null);
                    }}
                    disableClearable
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!error}
                        required
                        placeholder="Select"
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Member ID" required error={!!errors[relatedPersonFieldPaths.firstName]}>
              <FormTextField
                variant="outlined"
                name={coverageFieldPaths.memberId}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3} />
          <Grid item xs={3}>
            <LabeledField label="Policy holder's first name" required error={!!errors[relatedPersonFieldPaths.firstName]}>
              <FormTextField
                variant="outlined"
                name={relatedPersonFieldPaths.firstName}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's middle name">
              <FormTextField
                InputLabelProps={{
                  shrink: true,
                  sx: {
                    fontWeight: 'bold',
                  },
                }}
                variant="outlined"
                name={relatedPersonFieldPaths.middleName}
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's last name" required error={!!errors[relatedPersonFieldPaths.lastName]}>
              <FormTextField
                variant="outlined"
                name={relatedPersonFieldPaths.lastName}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>  
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's date of birth" required error={!!errors[relatedPersonFieldPaths.birthDate]}>
              <DatePicker
                name={relatedPersonFieldPaths.birthDate}
                variant="outlined"
                control={control}
                required={true}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's sex" required error={!!errors[relatedPersonFieldPaths.gender]}>
              <FormSelect
                variant="outlined"
                name={relatedPersonFieldPaths.gender}
                control={control}
                defaultValue={''}
                options={SEX_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Patient’s relationship to insured" required error={!!errors[coverageFieldPaths.relationship]}>
              <FormSelect
                variant="outlined"
                name={coverageFieldPaths.relationship}
                control={control}
                defaultValue={''}
                options={RELATIONSHIP_TO_INSURED_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label='Street address' required error={!!errors[relatedPersonFieldPaths.streetAddress]}>
              <FormTextField
                placeholder="No., Street"
                variant="outlined"
                name={relatedPersonFieldPaths.streetAddress}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Address line 2">
              <FormTextField
                placeholder="No., Street"
                variant="outlined"
                name={relatedPersonFieldPaths.addressLine2}
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label='City' required error={!!errors[relatedPersonFieldPaths.city]}>
              <FormTextField
                variant="outlined"
                name={relatedPersonFieldPaths.city}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label='State' required error={!!errors[relatedPersonFieldPaths.state]}>
              <Controller
                name={relatedPersonFieldPaths.state}
                control={control}
                defaultValue={null}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value) => !value || STATE_OPTIONS.some((option) => option.value === value),
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={STATE_OPTIONS}
                    value={(STATE_OPTIONS.find((option) => option.value === value) || null) as Option}
                    getOptionLabel={(option) => option.label || ''}
                    isOptionEqualToValue={(option, value) => option?.value === value?.value || (!option && !value)}
                    onChange={(_, newValue) => {
                      onChange(newValue?.value || null);
                    }}
                    disableClearable
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        error={!!error}
                        placeholder="Select"
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label='ZIP' required error={!!errors[relatedPersonFieldPaths.zip]}>
              <FormTextField
                variant="outlined"
                name={relatedPersonFieldPaths.zip}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={9}>
            <LabeledField label="Additional insurance information">
              <FormTextField
                variant="outlined"
                name="Coverage/additionalInformation"
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="primary"
          sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
          }}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
          }}
          onClick={handleSubmit(onSubmit)}
        >
          Add Insurance
        </Button>
      </DialogActions>
    </Dialog>
  );
};
