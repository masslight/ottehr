import { LoadingButton } from '@mui/lab';
import { Box, Button, FormControlLabel, Grid, Paper, Switch, Typography, useTheme } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RadiologyDiagnosis, RadiologyDiagnosisField } from 'src/features/radiology/components/RadiologyDiagnosisField';
import { useChartData } from 'src/features/visits/shared/hooks/useChartData';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { PROVIDERS_FILTER } from 'src/shared/utils/employeeFilters';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { CPTCodeDTO, DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  DME_DURATION_UNITS,
  DME_LATERALITY_LABELS,
  DME_LATERALITY_OPTIONS,
  DME_MODIFIER_LABELS,
  DME_MODIFIER_OPTIONS,
  DmeDurationUnit,
  DmeLaterality,
  DmeModifier,
  DmeOrderDTO,
  DmeOrderFields,
  DmeOrderStatus,
} from 'utils/lib/types/api/dme.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { useCreateDmeOrder, useUpdateDmeOrder } from '../dme.queries';
import { DmeBillingCodesField } from './DmeBillingCodesField';

const DME_ITEM_NAME_MAX_LENGTH = 200;

const DURATION_UNIT_LABELS: Record<DmeDurationUnit, string> = { days: 'Days', weeks: 'Weeks' };

export interface DmeOrderFormValues {
  itemName: string;
  diagnoses: RadiologyDiagnosis[];
  quantity: string;
  laterality: DmeLaterality | null;
  modifier: DmeModifier | null;
  durationValue: string;
  durationUnit: DmeDurationUnit | null;
  orderedBy: { id: string; name?: string } | null;
  instructions: string;
  billingCodes: CPTCodeDTO[];
  external: boolean;
  thirdParty: { name: string; address: string; phone: string; fax: string };
}

const toCodeDisplay = ({ code, display }: { code: string; display: string }): { code: string; display: string } => ({
  code,
  display,
});

const optional = (value: string): string | undefined => value.trim() || undefined;

export const buildDmeOrderFields = (values: DmeOrderFormValues): DmeOrderFields => {
  const thirdParty = {
    name: optional(values.thirdParty.name),
    address: optional(values.thirdParty.address),
    phone: optional(values.thirdParty.phone),
    fax: optional(values.thirdParty.fax),
  };
  return {
    itemName: values.itemName.trim(),
    diagnoses: values.diagnoses.map(toCodeDisplay),
    quantity: Number(values.quantity),
    billingCodes: values.billingCodes.map(toCodeDisplay),
    laterality: values.laterality ?? undefined,
    modifier: values.modifier ?? undefined,
    duration:
      values.durationValue && values.durationUnit
        ? { value: Number(values.durationValue), unit: values.durationUnit }
        : undefined,
    orderedByPractitionerId: values.orderedBy?.id ?? '',
    instructions: optional(values.instructions),
    external: values.external,
    thirdParty: values.external && Object.values(thirdParty).some(Boolean) ? thirdParty : undefined,
  };
};

const orderToFormValues = (order: DmeOrderDTO): DmeOrderFormValues => ({
  itemName: order.itemName,
  diagnoses: order.diagnoses.map(toCodeDisplay),
  quantity: String(order.quantity),
  laterality: order.laterality ?? null,
  modifier: order.modifier ?? null,
  durationValue: order.duration ? String(order.duration.value) : '',
  durationUnit: order.duration?.unit ?? 'days',
  orderedBy: order.orderedBy.practitionerId ? { id: order.orderedBy.practitionerId, name: order.orderedBy.name } : null,
  instructions: order.instructions ?? '',
  billingCodes: order.billingCodes.map(toCodeDisplay),
  external: order.external,
  thirdParty: {
    name: order.thirdParty?.name ?? '',
    address: order.thirdParty?.address ?? '',
    phone: order.thirdParty?.phone ?? '',
    fax: order.thirdParty?.fax ?? '',
  },
});

const primaryFirst = (diagnoses: DiagnosisDTO[]): RadiologyDiagnosis[] =>
  [...diagnoses].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary)).map(toCodeDisplay);

export interface DmeOrderFormProps {
  /** edit mode when set */
  order?: DmeOrderDTO;
  onFinished: (deviceRequestId: string) => void;
  onCancel: () => void;
}

export const DmeOrderForm: React.FC<DmeOrderFormProps> = ({ order, onFinished, onCancel }) => {
  const theme = useTheme();
  const { encounter } = useAppointmentData();
  const encounterId = order?.encounterId ?? encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { chartData, setPartialChartData } = useChartData();
  const { mutate: saveChartData } = useSaveChartData();
  const { mutateAsync: createOrder } = useCreateDmeOrder();
  const { mutateAsync: updateOrder } = useUpdateDmeOrder(encounterId);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const currentUser = useEvolveUser();
  const currentPractitionerId = currentUser?.profile?.split('/')[1];
  const isProvider = !!currentUser?.hasRole([RoleType.Provider]);
  const currentUserName = currentUser?.userName;
  const defaultOrderedBy = useMemo(
    () => (currentPractitionerId && isProvider ? { id: currentPractitionerId, name: currentUserName } : null),
    [currentPractitionerId, isProvider, currentUserName]
  );

  const chartDiagnoses = useMemo(() => chartData?.diagnosis ?? [], [chartData?.diagnosis]);

  const methods = useForm<DmeOrderFormValues>({
    defaultValues: order
      ? orderToFormValues(order)
      : {
          itemName: '',
          diagnoses: primaryFirst(chartDiagnoses),
          quantity: '1',
          laterality: null,
          modifier: null,
          durationValue: '',
          durationUnit: 'days',
          orderedBy: defaultOrderedBy,
          instructions: '',
          billingCodes: [],
          external: false,
          thirdParty: { name: '', address: '', phone: '', fax: '' },
        },
  });
  const { control, watch, setValue, getValues, getFieldState, handleSubmit, formState } = methods;
  const external = watch('external');

  // chart data and the user's profile can arrive after the form mounts
  useEffect(() => {
    if (order || !chartDiagnoses.length || getFieldState('diagnoses').isDirty || getValues('diagnoses').length) return;
    setValue('diagnoses', primaryFirst(chartDiagnoses));
  }, [order, chartDiagnoses, getFieldState, getValues, setValue]);

  useEffect(() => {
    if (order || !defaultOrderedBy || getFieldState('orderedBy').isDirty || getValues('orderedBy')) return;
    setValue('orderedBy', defaultOrderedBy);
  }, [order, defaultOrderedBy, getFieldState, getValues, setValue]);

  const addAdditionalDxToEncounter = async (orderDx: RadiologyDiagnosis[]): Promise<void> => {
    const newDx = orderDx.filter((dx) => !chartDiagnoses.some((d) => d.code === dx.code));
    if (newDx.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      saveChartData(
        { diagnosis: newDx as DiagnosisDTO[] },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            setPartialChartData({ diagnosis: [...returnedDiagnosis, ...chartDiagnoses] });
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  };

  const onSubmit = async (values: DmeOrderFormValues): Promise<void> => {
    if (!encounterId) return;
    setSubmitError(undefined);
    try {
      await addAdditionalDxToEncounter(values.diagnoses);
      const fields = buildDmeOrderFields(values);
      if (order) {
        await updateOrder({ action: 'update', deviceRequestId: order.id, fields });
        onFinished(order.id);
      } else {
        const response = await createOrder({ ...fields, encounterId });
        onFinished(response.deviceRequestId);
      }
    } catch (error) {
      console.error('Error saving DME order:', error);
      setSubmitError(
        getApiError({ error, defaultError: 'There was an error saving the DME order. Please try again.' })
      );
    }
  };

  const ids = dataTestIds.dmeOrders.form;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
                Order Details
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextInput
                name="itemName"
                label="DME"
                required
                inputProps={{ maxLength: DME_ITEM_NAME_MAX_LENGTH }}
                validate={(value) => !!value?.trim() || 'DME is required'}
                dataTestId={ids.item}
              />
            </Grid>
            <Grid item xs={12} data-testid={ids.diagnoses}>
              <Controller
                name="diagnoses"
                control={control}
                render={({ field }) => (
                  <RadiologyDiagnosisField
                    label="Associated Dx"
                    value={field.value}
                    onChange={field.onChange}
                    quickPickOptions={chartDiagnoses.map(toCodeDisplay)}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <TextInput
                name="quantity"
                label="Quantity Dispensed"
                type="number"
                required
                inputProps={{ min: 1, step: 1 }}
                validate={(value) =>
                  (/^\d+$/.test(String(value)) && Number(value) > 0) ||
                  'Quantity dispensed must be a positive whole number'
                }
                dataTestId={ids.quantity}
              />
            </Grid>
            <Grid item xs={6}>
              <SelectInput<DmeLaterality>
                name="laterality"
                label="Laterality"
                options={[...DME_LATERALITY_OPTIONS]}
                getOptionLabel={(option) => DME_LATERALITY_LABELS[option] ?? option}
                dataTestId={ids.laterality}
              />
            </Grid>
            <Grid item xs={6}>
              <SelectInput<DmeModifier>
                name="modifier"
                label="Modifiers"
                options={[...DME_MODIFIER_OPTIONS]}
                getOptionLabel={(option) => DME_MODIFIER_LABELS[option] ?? option}
                dataTestId={ids.modifier}
              />
            </Grid>
            <Grid item xs={3}>
              <TextInput
                name="durationValue"
                label="Duration of use"
                type="number"
                inputProps={{ min: 0 }}
                validate={(value) => !value || Number(value) > 0 || 'Duration must be a positive number'}
                dataTestId={ids.durationValue}
              />
            </Grid>
            <Grid item xs={3}>
              <SelectInput<DmeDurationUnit>
                name="durationUnit"
                label="Days/Weeks"
                options={[...DME_DURATION_UNITS]}
                getOptionLabel={(option) => DURATION_UNIT_LABELS[option] ?? option}
                validate={(value) => !getValues('durationValue') || !!value || 'Select a unit'}
                dataTestId={ids.durationUnit}
              />
            </Grid>
            <Grid item xs={12}>
              <EmployeeSelectInput
                name="orderedBy"
                label="Ordered by"
                required
                filter={PROVIDERS_FILTER}
                dataTestId={ids.orderedBy}
              />
            </Grid>
            <Grid item xs={12}>
              <TextInput name="instructions" label="Instructions" multiline dataTestId={ids.instructions} />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="billingCodes"
                control={control}
                render={({ field }) => (
                  <DmeBillingCodesField value={field.value} onChange={field.onChange} dataTestId={ids.billingCodes} />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="external"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        disabled={order?.status === DmeOrderStatus.dispensed}
                        onChange={(_e, checked) => field.onChange(checked)}
                        inputProps={
                          { 'data-testid': ids.externalSwitch } as React.InputHTMLAttributes<HTMLInputElement>
                        }
                      />
                    }
                    label={<Typography variant="body2">Fulfilled by External Site / Third Party</Typography>}
                  />
                )}
              />
            </Grid>
            {external && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.dark }}>
                    Third Party Information
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextInput name="thirdParty.name" label="Clinic name" dataTestId={ids.thirdPartyName} />
                </Grid>
                <Grid item xs={12}>
                  <TextInput name="thirdParty.address" label="Address" dataTestId={ids.thirdPartyAddress} />
                </Grid>
                <Grid item xs={6}>
                  <PhoneInput name="thirdParty.phone" label="Phone" dataTestId={ids.thirdPartyPhone} />
                </Grid>
                <Grid item xs={6}>
                  <PhoneInput name="thirdParty.fax" label="Fax" dataTestId={ids.thirdPartyFax} />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  data-testid={ids.cancelButton}
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={formState.isSubmitting}
                  disabled={isReadOnly || !encounterId}
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  data-testid={ids.submitButton}
                >
                  {order ? 'Save' : 'Order'}
                </LoadingButton>
              </Box>
            </Grid>
            {submitError && (
              <Grid item xs={12} sx={{ textAlign: 'right' }}>
                <Typography color="error" data-testid={ids.error}>
                  {submitError}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      </form>
    </FormProvider>
  );
};
