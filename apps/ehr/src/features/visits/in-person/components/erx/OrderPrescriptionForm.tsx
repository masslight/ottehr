import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Button,
  FormControlLabel,
  Grid,
  InputBaseComponentProps,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { MedicationSearchResult, PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { z } from 'zod';
import { useSearchMedications, useSearchPharmacies } from '../../../shared/hooks/useErxSearch';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';

const PRESCRIBER_SPI = '7955484659004';

const isWholeNumberInRange = (value: string, min: number, max: number): boolean => {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) && number >= min && number <= max;
};

const OrderPrescriptionFormSchema = z.object({
  medicationDescription: z.string().trim().min(1, 'Required').max(105, 'Up to 105 characters'),
  ndc: z.string().regex(/^\d{11}$/, 'Must be an 11-digit NDC'),
  quantityValue: z.string().refine((value) => Number(value) > 0, 'Must be greater than 0'),
  quantityUnit: z.string().trim().min(1, 'Required'),
  daysSupply: z
    .string()
    .refine((value) => value === '' || isWholeNumberInRange(value, 1, 999), 'Must be a whole number from 1 to 999'),
  writtenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be formatted YYYY-MM-DD'),
  numberOfRefills: z
    .string()
    .refine((value) => isWholeNumberInRange(value, 0, 99), 'Must be a whole number from 0 to 99'),
  substitutionAllowed: z.boolean(),
  patientInstructions: z.string().trim().min(1, 'Required').max(1000, 'Up to 1000 characters'),
  pharmacyId: z.string().regex(/^\d{7}$/, 'Must be a 7-digit NCPDP ID'),
  pharmacyNpi: z.string().regex(/^\d{10}$/, 'Must be a 10-digit NPI'),
  pharmacyName: z.string().trim().min(1, 'Required').max(105, 'Up to 105 characters'),
  pharmacyPhone: z.string().refine((value) => value.replace(/\D/g, '').length >= 10, 'Must have at least 10 digits'),
  diagnosisCode: z.string().trim().min(1, 'Required'),
  diagnosisDescription: z.string().trim().min(1, 'Required'),
});

type OrderPrescriptionFormValues = z.infer<typeof OrderPrescriptionFormSchema>;

type TextFieldName = Exclude<keyof OrderPrescriptionFormValues, 'substitutionAllowed'>;

interface TextFieldOptions {
  helperText?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'tel';
  htmlInput?: InputBaseComponentProps;
}

const defaultValues = (): OrderPrescriptionFormValues => ({
  medicationDescription: '',
  ndc: '',
  quantityValue: '',
  quantityUnit: '',
  daysSupply: '',
  writtenDate: DateTime.local().toISODate() ?? '',
  numberOfRefills: '0',
  substitutionAllowed: true,
  patientInstructions: '',
  pharmacyId: '',
  pharmacyNpi: '',
  pharmacyName: '',
  pharmacyPhone: '',
  diagnosisCode: '',
  diagnosisDescription: '',
});

export const OrderPrescriptionForm: FC = () => {
  const { patient, encounter } = useAppointmentData();
  const user = useEvolveUser();
  const { mutateAsync: orderPrescription, isPending } = useOrderPrescription();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrderPrescriptionFormValues>({
    resolver: zodResolver(OrderPrescriptionFormSchema),
    defaultValues: defaultValues(),
  });

  const isDisabled = isPending;

  const [medicationQuery, setMedicationQuery] = useState('');
  const [pharmacyQuery, setPharmacyQuery] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<MedicationSearchResult | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacySearchResult | null>(null);

  const resetForm = (): void => {
    reset(defaultValues());
    setMedicationQuery('');
    setPharmacyQuery('');
    setSelectedMedication(null);
    setSelectedPharmacy(null);
  };

  const { data: medications = [], isFetching: isSearchingMedications } = useSearchMedications(medicationQuery);
  const { data: pharmacies = [], isFetching: isSearchingPharmacies } = useSearchPharmacies(pharmacyQuery);

  const textField = (
    name: TextFieldName,
    label: string,
    { helperText, required = true, type, htmlInput }: TextFieldOptions = {}
  ): JSX.Element => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          fullWidth
          size="small"
          label={label}
          type={type}
          required={required}
          InputLabelProps={type === 'date' ? { shrink: true } : undefined}
          inputProps={htmlInput}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
          disabled={isDisabled}
        />
      )}
    />
  );

  const onSubmit = async (values: OrderPrescriptionFormValues): Promise<void> => {
    const practitionerId = user?.profileResource?.id;
    if (!patient?.id || !encounter?.id || !practitionerId) {
      enqueueSnackbar('The patient, encounter or provider could not be determined. Please reload and try again.', {
        variant: 'error',
      });
      return;
    }

    const input: OrderPrescriptionInput = {
      patientId: patient.id,
      practitionerId,
      prescriberSpi: PRESCRIBER_SPI,
      encounterId: encounter.id,
      ndc: values.ndc,
      medicationDescription: values.medicationDescription.trim(),
      quantityValue: Number(values.quantityValue),
      quantityUnit: values.quantityUnit.trim(),
      ...(values.daysSupply ? { daysSupply: Number(values.daysSupply) } : {}),
      writtenDate: values.writtenDate,
      substitutionAllowed: values.substitutionAllowed,
      numberOfRefills: Number(values.numberOfRefills),
      patientInstructions: values.patientInstructions.trim(),
      pharmacyId: values.pharmacyId,
      pharmacyNpi: values.pharmacyNpi,
      pharmacyName: values.pharmacyName.trim(),
      pharmacyPhone: values.pharmacyPhone,
      diagnosisCode: values.diagnosisCode.trim(),
      diagnosisDescription: values.diagnosisDescription.trim(),
    };

    try {
      await orderPrescription(input);
      enqueueSnackbar('Prescription sent', { variant: 'success' });
      resetForm();
    } catch (error) {
      console.error(`Error ordering prescription: ${error}`);
      enqueueSnackbar(
        error instanceof Error && error.message
          ? error.message
          : 'An error occurred while sending the prescription. Please try again.',
        { variant: 'error' }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2">Medication</Typography>
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={medications}
              loading={isSearchingMedications}
              filterOptions={(options) => options}
              getOptionLabel={(option) => `${option.description} (${option.ndc})`}
              inputValue={medicationQuery}
              onInputChange={(_event, value) => setMedicationQuery(value)}
              value={selectedMedication}
              isOptionEqualToValue={(option, value) => option.ndc === value.ndc}
              onChange={(_event, option) => {
                setSelectedMedication(option);
                setValue('medicationDescription', option?.description ?? '', { shouldValidate: true });
                setValue('ndc', option?.ndc ?? '', { shouldValidate: true });
              }}
              disabled={isDisabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Medication"
                  required
                  error={!!errors.medicationDescription || !!errors.ndc}
                  helperText={errors.medicationDescription || errors.ndc ? 'Select a medication' : undefined}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            {textField('quantityValue', 'Quantity', { type: 'number', htmlInput: { min: 0, step: 'any' } })}
          </Grid>
          <Grid item xs={12} sm={3}>
            {textField('quantityUnit', 'Quantity unit')}
          </Grid>
          <Grid item xs={12} sm={3}>
            {textField('daysSupply', 'Days supply (optional)', {
              required: false,
              type: 'number',
              htmlInput: { min: 1, max: 999, step: 1 },
            })}
          </Grid>
          <Grid item xs={12} sm={3}>
            {textField('numberOfRefills', 'Refills', { type: 'number', htmlInput: { min: 0, max: 99, step: 1 } })}
          </Grid>
          <Grid item xs={12} sm={4}>
            {textField('writtenDate', 'Written date', { type: 'date' })}
          </Grid>
          <Grid item xs={12} sm={8}>
            <Controller
              name="substitutionAllowed"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      disabled={isDisabled}
                    />
                  }
                  label="Substitution allowed"
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="patientInstructions"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  label="Patient instructions (SIG)"
                  required
                  inputProps={{ maxLength: 1000 }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={isDisabled}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2">Diagnosis</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            {textField('diagnosisCode', 'ICD-10 code')}
          </Grid>
          <Grid item xs={12} sm={8}>
            {textField('diagnosisDescription', 'Diagnosis description')}
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2">Pharmacy</Typography>
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={pharmacies}
              loading={isSearchingPharmacies}
              filterOptions={(options) => options}
              getOptionLabel={(option) => `${option.name} - ${option.address}`}
              inputValue={pharmacyQuery}
              onInputChange={(_event, value) => setPharmacyQuery(value)}
              value={selectedPharmacy}
              isOptionEqualToValue={(option, value) => option.ncpdpId === value.ncpdpId}
              onChange={(_event, option) => {
                setSelectedPharmacy(option);
                setValue('pharmacyName', option?.name ?? '', { shouldValidate: true });
                setValue('pharmacyPhone', option?.phone ?? '', { shouldValidate: true });
                setValue('pharmacyId', option?.ncpdpId ?? '', { shouldValidate: true });
                setValue('pharmacyNpi', option?.npi ?? '', { shouldValidate: true });
              }}
              disabled={isDisabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Pharmacy"
                  required
                  error={!!errors.pharmacyName || !!errors.pharmacyId || !!errors.pharmacyNpi || !!errors.pharmacyPhone}
                  helperText={
                    errors.pharmacyName || errors.pharmacyId || errors.pharmacyNpi || errors.pharmacyPhone
                      ? 'Select a pharmacy'
                      : undefined
                  }
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <Button type="button" onClick={resetForm} disabled={isDisabled}>
                Clear
              </Button>
              <LoadingButton type="submit" variant="contained" loading={isPending}>
                Send prescription
              </LoadingButton>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    </form>
  );
};
