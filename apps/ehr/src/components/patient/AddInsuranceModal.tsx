import { Close } from '@mui/icons-material';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
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
import { BasicDatePicker as DatePicker, FormSelect, FormTextField, Option } from '../form';
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
            <FormControl fullWidth>
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
                        label="Insurance carrier"
                        error={!!error}
                        required
                        placeholder="Select"
                        InputLabelProps={{
                          shrink: true,
                          sx: {
                            fontWeight: 'bold',
                          },
                        }}
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <FormTextField
              label="Member ID *"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={coverageFieldPaths.memberId}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
            />
          </Grid>
          <Grid item xs={3} />
          <Grid item xs={3}>
            <FormTextField
              label="Policy holder's first name *"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={relatedPersonFieldPaths.firstName}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <FormTextField
              label="Policy holder's middle name"
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
          </Grid>
          <Grid item xs={3}>
            <FormTextField
              label="Policy holder's last name *"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={relatedPersonFieldPaths.lastName}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <DatePicker
              name={relatedPersonFieldPaths.birthDate}
              variant="outlined"
              control={control}
              required={true}
              defaultValue={''}
              label="Policy holder's date of birth"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <FormControl fullWidth error={!!errors[relatedPersonFieldPaths.gender]}>
              <InputLabel
                shrink
                sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}
              >
                Policy holder's sex *
              </InputLabel>
              <FormSelect
                variant="outlined"
                name={relatedPersonFieldPaths.gender}
                control={control}
                defaultValue={''}
                options={SEX_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <FormControl fullWidth error={!!errors[relatedPersonFieldPaths.relationship]}>
              <InputLabel
                shrink
                sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}
              >
                Patient’s relationship to insured *
              </InputLabel>
              <FormSelect
                variant="outlined"
                name={coverageFieldPaths.relationship}
                control={control}
                defaultValue={''}
                options={RELATIONSHIP_TO_INSURED_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <FormTextField
              label="Street address *"
              placeholder="No., Street"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={relatedPersonFieldPaths.streetAddress}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <FormTextField
              label="Address line 2"
              placeholder="No., Street"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={relatedPersonFieldPaths.addressLine2}
              control={control}
              defaultValue={''}
            />
          </Grid>
          <Grid item xs={1}>
            <FormTextField
              label="City *"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name={relatedPersonFieldPaths.city}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
            />
          </Grid>
          <Grid item xs={1}>
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
                      label="State"
                      required
                      error={!!error}
                      placeholder="Select"
                      InputLabelProps={{
                        shrink: true,
                        sx: {
                          fontWeight: 'bold',
                        },
                      }}
                      helperText={error?.message}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid item xs={1}>
            <FormTextField
              variant="outlined"
              name={relatedPersonFieldPaths.zip}
              control={control}
              defaultValue={''}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
                validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
              }}
              label="ZIP *"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
            />
          </Grid>
          <Grid item xs={9}>
            <FormTextField
              label="Additional insurance information"
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 'bold',
                },
              }}
              variant="outlined"
              name="Coverage/additionalInformation"
              control={control}
              defaultValue={''}
            />
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
