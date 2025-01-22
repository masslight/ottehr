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
  MenuItem,
  Select,
  TextField,
  useTheme,
} from '@mui/material';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import { coverageFieldPaths, InsurancePlanDTO, relatedPersonFieldPaths, SUBSCRIBER_RELATIONSHIP_CODE_MAP } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { otherColors } from '../../CustomThemeProvider';
import { BasicDatePicker as DatePicker, Option } from '../form';
import { RELATIONSHIP_TO_INSURED } from '../../rcm/utils/resources.helper';
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
                  required: true,
                  validate: (value) => insurancePlans.some((option) => option.name === value),
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={insurancePlans}
                    value={(insurancePlans.find((option) => option.name === value) || null) as InsurancePlanDTO}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.name === value?.name || (!option && !value)}
                    onChange={(_, newValue) => {
                      console.log(newValue);
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
                      />
                    )}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <Controller
              name={coverageFieldPaths.memberId}
              control={control}
              defaultValue={''}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Member ID"
                  error={!!errors[coverageFieldPaths.memberId]}
                  required
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={3} />
          <Grid item xs={3}>
            <Controller
              name={relatedPersonFieldPaths.firstName}
              control={control}
              defaultValue={''}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Policy holder's first name"
                  required
                  error={!!errors[relatedPersonFieldPaths.firstName]}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={3}>
            <Controller
              name={relatedPersonFieldPaths.middleName}
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Policy holder's middle name"
                  error={!!errors[relatedPersonFieldPaths.middleName]}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={3}>
            <Controller
              name={relatedPersonFieldPaths.lastName}
              control={control}
              defaultValue={''}
              rules={{ required: true }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  label="Policy holder's last name"
                  required
                  error={!!error}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
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
                id="gender-label"
                shrink
                sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}
              >
                Policy holder's sex *
              </InputLabel>
              <Controller
                name={relatedPersonFieldPaths.gender}
                control={control}
                defaultValue={''}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId="gender-label"
                    label="Policy holder's sex"
                    displayEmpty
                    renderValue={(selected) => {
                      const selectedOption = genderOptions.find((option) => option.value === selected);
                      return selectedOption ? (
                        selectedOption.label
                      ) : (
                        <span style={{ color: otherColors.disabled }}>Select</span>
                      );
                    }}
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  >
                    {genderOptions.map((option) =>
                      option.value === 'placeholder' ? (
                        <MenuItem key={option.value} value={option.value} disabled />
                      ) : (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      )
                    )}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <FormControl fullWidth error={!!errors[coverageFieldPaths.relationship]}>
              <InputLabel
                shrink
                sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}
              >
                Patient’s relationship to insured *
              </InputLabel>
              <Controller
                name={coverageFieldPaths.relationship}
                control={control}
                defaultValue={''}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Patient’s relationship to insured"
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                    displayEmpty
                    renderValue={(selected) => {
                      const selectedOption = relationshipOptions.find((option) => option.value === selected);
                      return selectedOption ? (
                        selectedOption.label
                      ) : (
                        <span style={{ color: otherColors.disabled }}>Select</span>
                      );
                    }}
                  >
                    {relationshipOptions.map((option) =>
                      option.value === 'placeholder' ? (
                        <MenuItem key={option.value} value={option.value} disabled />
                      ) : (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      )
                    )}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <Controller
              name={relatedPersonFieldPaths.streetAddress}
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Street address"
                  fullWidth
                  placeholder="No., Street"
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={3}>
            <Controller
              name={relatedPersonFieldPaths.addressLine2}
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Address line 2"
                  fullWidth
                  placeholder="No., Street"
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={1}>
            <Controller
              name={relatedPersonFieldPaths.city}
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="City"
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={1}>
            <Controller
              name={relatedPersonFieldPaths.state}
              control={control}
              defaultValue={null}
              rules={{
                required: false,
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
                      error={!!error}
                      placeholder="Select"
                      InputLabelProps={{
                        shrink: true,
                        sx: {
                          fontWeight: 'bold',
                        },
                      }}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid item xs={1}>
            <Controller
              name={relatedPersonFieldPaths.zip}
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="ZIP"
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={9}>
            <Controller
              name="Coverage/additionalInformation"
              control={control}
              defaultValue={''}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Additional insurance information"
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      fontWeight: 'bold',
                    },
                  }}
                  fullWidth
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              )}
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

const genderOptions = [
  { value: 'placeholder', label: 'Select' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'intersex', label: 'Intersex' },
];

const relationshipOptions = [
  { value: 'placeholder', label: 'Select' },
  ...RELATIONSHIP_TO_INSURED.map((option) => ({ value: option, label: option })),
];
