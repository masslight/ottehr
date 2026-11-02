import { Autocomplete, Box, Divider, FormHelperText, Paper, Stack, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, PathValue, useController, useForm } from 'react-hook-form';
import { createDmeQuickPick, getDmeQuickPicks, updateDmeQuickPick } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RadiologyDiagnosis } from 'src/features/radiology/components/RadiologyDiagnosisField';
import {
  PopoverBlank,
  SectionLabel,
  SelectBlank,
  Sentence,
  TextBlank,
} from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { ProcedureDiagnosesSentence } from 'src/features/visits/in-person/components/procedures/narrative/ProcedureDiagnosesSentence';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useChartData } from 'src/features/visits/shared/hooks/useChartData';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { toProviderDetails, useGetEmployeesWithDetails } from 'src/features/visits/shared/hooks/useGetEmployees';
import { useMainEncounterChartData } from 'src/features/visits/shared/hooks/useMainEncounterChartData';
import { useAppointmentData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { sortQuickPicks, useMergedDmeQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { PROVIDERS_FILTER } from 'src/shared/utils/employeeFilters';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
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
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { useCreateDmeOrder, useUpdateDmeOrder } from '../dme.queries';
import { DmeBillingCodesSentence } from './DmeBillingCodesSentence';
import {
  applyDmeQuickPick,
  buildDmeQuickPick,
  DmeOrderFormValues,
  DmeQuickPickPatch,
  normalizePhone,
  toCodeDisplay,
} from './dmeQuickPick';
import { DmeQuickPickDialogs } from './DmeQuickPickDialogs';

const DME_ITEM_NAME_MAX_LENGTH = 200;

const FULFILLMENT_OPTIONS = [
  { value: 'in-house', label: 'in-house' },
  { value: 'external', label: 'an external site / third party' },
];

/** Ten digits, optionally after a leading 1 / +1, however they are spaced or punctuated. */
const validatePhone = (value: string): true | string => {
  const digits = value.replace(/\D/g, '');
  return (
    !value.trim() ||
    isPhoneNumberValid(digits.length === 11 && digits.startsWith('1') ? `+${digits}` : digits) ||
    'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
  );
};

type OrderedBy = DmeOrderFormValues['orderedBy'];

const OrderedByBlank: React.FC<{
  value: OrderedBy;
  onChange: (value: OrderedBy) => void;
  readOnly: boolean;
  dataTestId?: string;
  invalid?: boolean;
  describedBy?: string;
}> = ({ value, onChange, readOnly, dataTestId, invalid, describedBy }) => {
  const { oystehrZambda } = useApiClients();
  const { data: employees, isLoading } = useGetEmployeesWithDetails({ enabled: !!oystehrZambda });
  const options = useMemo(
    () =>
      (employees?.nonProviders ?? [])
        .filter(PROVIDERS_FILTER)
        .map((employee) => {
          const details = toProviderDetails(employee);
          return { id: details.practitionerId, name: details.name };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );
  const name = (value && (options.find((option) => option.id === value.id)?.name ?? value.name)) || undefined;
  return (
    <PopoverBlank
      label="ordered by"
      title="Ordered by"
      value={name}
      need
      readOnly={readOnly}
      dataTestId={dataTestId}
      invalid={invalid}
      describedBy={describedBy}
    >
      {(close) => (
        <Autocomplete
          size="small"
          openOnFocus
          options={options}
          loading={isLoading}
          value={value && options.find((option) => option.id === value.id) ? value : null}
          getOptionLabel={(option) => option.name ?? option.id}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          onChange={(_event, option) => {
            if (!option) return;
            onChange(option);
            close();
          }}
          renderInput={(params) => <TextField {...params} label="Ordered by" />}
          sx={{ width: 320, maxWidth: '100%', pt: 0.5 }}
        />
      )}
    </PopoverBlank>
  );
};

const optional = (value: string): string | undefined => value.trim() || undefined;

export const buildDmeOrderFields = (values: DmeOrderFormValues): DmeOrderFields => {
  const thirdParty = {
    name: optional(values.thirdParty.name),
    address: optional(values.thirdParty.address),
    // Stored as "(xxx) xxx-xxxx", the shape the masked phone fields saved.
    phone: optional(normalizePhone(values.thirdParty.phone)),
    fax: optional(normalizePhone(values.thirdParty.fax)),
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
  const { encounter } = useAppointmentData();
  const encounterId = order?.encounterId ?? encounter?.id;
  const { isAppointmentReadOnly: isReadOnly, visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  const { chartData, setPartialChartData } = useChartData();
  const { data: mainEncounterChartData } = useMainEncounterChartData(isFollowup);
  const { mutate: saveChartData } = useSaveChartData();
  const { mutateAsync: createOrder } = useCreateDmeOrder();
  const { mutateAsync: updateOrder } = useUpdateDmeOrder(encounterId);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const { oystehrZambda } = useApiClients();
  const {
    quickPicks,
    loading: quickPicksLoading,
    refetch: refetchQuickPicks,
  } = useMergedDmeQuickPicks({ enabled: !isReadOnly });
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<DmeQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);

  const currentUser = useEvolveUser();
  const currentPractitionerId = currentUser?.profile?.split('/')[1];
  const isProvider = !!currentUser?.hasRole([RoleType.Provider]);
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const currentUserName = currentUser?.userName;
  const defaultOrderedBy = useMemo(
    () => (currentPractitionerId && isProvider ? { id: currentPractitionerId, name: currentUserName } : null),
    [currentPractitionerId, isProvider, currentUserName]
  );

  const encounterDiagnoses = useMemo(() => chartData?.diagnosis ?? [], [chartData?.diagnosis]);
  // An annotation follow-up has no assessment of its own; its orders use the main visit's diagnoses.
  const chartDiagnoses = useMemo(
    () => (isFollowup ? mainEncounterChartData?.diagnosis ?? [] : encounterDiagnoses),
    [isFollowup, mainEncounterChartData?.diagnosis, encounterDiagnoses]
  );

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

  const externalLocked = order?.status === DmeOrderStatus.dispensed;

  const onQuickPickSelect = (quickPick: DmeQuickPickData): void => {
    const patch = applyDmeQuickPick(quickPick);
    if (externalLocked) delete patch.external;
    const options = { shouldDirty: true, shouldValidate: formState.isSubmitted };
    const apply = <K extends keyof DmeQuickPickPatch>(key: K): void => {
      const value = patch[key];
      if (value !== undefined) setValue(key, value as PathValue<DmeOrderFormValues, K>, options);
    };
    (Object.keys(patch) as (keyof DmeQuickPickPatch)[]).forEach(apply);
  };

  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const commandPaletteItems = useMemo(
    () =>
      order || isReadOnly
        ? []
        : quickPicks.map((quickPick) => ({
            id: `dme-${quickPick.id ?? quickPick.name}`,
            label: quickPick.name,
            category: 'Order DME',
            keywords: quickPick.itemName ? [quickPick.itemName] : undefined,
            onSelect: () => onQuickPickSelectRef.current(quickPick),
          })),
    [order, isReadOnly, quickPicks]
  );
  useCommandPaletteSource('dme-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback((payload: DmeQuickPickData) => onQuickPickSelectRef.current(payload), []);
  usePendingQuickPick('dme', handlePendingQuickPick, !order && !isReadOnly);

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    if (!getValues('itemName').trim()) {
      enqueueSnackbar('Enter the DME name before saving a quick pick', { variant: 'error' });
      return;
    }
    try {
      const response = await getDmeQuickPicks(oystehrZambda);
      setExistingQuickPicks([...response.quickPicks].sort(sortQuickPicks));
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(quickPicks);
    }
    setQuickPickName(getValues('itemName').trim());
    setQuickPickDialogOpen(true);
  };

  const onSaveAsQuickPick = async (overwriteId?: string): Promise<void> => {
    const quickPick = buildDmeQuickPick(getValues(), quickPickName);
    if (!quickPick.name) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    if (!oystehrZambda) return;
    setQuickPickSaving(true);
    try {
      if (overwriteId) {
        await updateDmeQuickPick(oystehrZambda, overwriteId, quickPick);
        enqueueSnackbar(`Quick pick "${quickPick.name}" updated`, { variant: 'success' });
      } else {
        await createDmeQuickPick(oystehrZambda, { quickPick });
        enqueueSnackbar(`Quick pick "${quickPick.name}" created`, { variant: 'success' });
      }
      setQuickPickDialogOpen(false);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  const addAdditionalDxToEncounter = async (orderDx: RadiologyDiagnosis[]): Promise<void> => {
    const newDx = orderDx.filter((dx) => ![...chartDiagnoses, ...encounterDiagnoses].some((d) => d.code === dx.code));
    if (newDx.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      saveChartData(
        { diagnosis: newDx as DiagnosisDTO[] },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            setPartialChartData({ diagnosis: [...returnedDiagnosis, ...encounterDiagnoses] });
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

  // Third-party contacts only count when the order is fulfilled externally, as when their fields were hidden.
  const validateThirdPartyPhone = (value: string): true | string => !getValues('external') || validatePhone(value);
  // Text blanks sit straight in their sentence, so its punctuation stays on their line.
  const { field: quantityField } = useController({
    name: 'quantity',
    control,
    rules: {
      validate: (value) =>
        (/^\d+$/.test(String(value)) && Number(value) > 0) || 'Quantity dispensed must be a positive whole number',
    },
  });
  const { field: itemNameField } = useController({
    name: 'itemName',
    control,
    rules: { validate: (value) => !!value.trim() || 'DME is required' },
  });
  const { field: durationValueField } = useController({
    name: 'durationValue',
    control,
    rules: { validate: (value) => !value || Number(value) > 0 || 'Duration must be a positive number' },
  });
  const { field: thirdPartyNameField } = useController({ name: 'thirdParty.name', control });
  const { field: thirdPartyAddressField } = useController({ name: 'thirdParty.address', control });
  const { field: thirdPartyPhoneField } = useController({
    name: 'thirdParty.phone',
    control,
    rules: { validate: validateThirdPartyPhone },
  });
  const { field: thirdPartyFaxField } = useController({
    name: 'thirdParty.fax',
    control,
    rules: { validate: validateThirdPartyPhone },
  });
  const ids = dataTestIds.dmeOrders.form;
  const { errors } = formState;
  const errorIdPrefix = useId();
  const orderErrorId = `${errorIdPrefix}-order`;
  const orderedByErrorId = `${errorIdPrefix}-ordered-by`;
  const thirdPartyErrorId = `${errorIdPrefix}-third-party`;
  const invalidProps = (invalid: boolean, describedBy: string): { invalid?: boolean; describedBy?: string } =>
    invalid ? { invalid, describedBy } : {};
  const errorText = (id: string, ...messages: (string | undefined)[]): React.ReactNode => {
    const shown = messages.filter(Boolean);
    return (
      shown.length > 0 && (
        <FormHelperText id={id} error sx={{ mt: '-8px' }}>
          {shown.join(' ')}
        </FormHelperText>
      )
    );
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Paper>
          <Stack spacing={1.5} sx={{ p: 3 }}>
            {!isReadOnly && (
              <QuickPicksButton
                quickPicks={quickPicks}
                loading={quickPicksLoading}
                getLabel={(quickPick) => quickPick.name}
                onSelect={onQuickPickSelect}
                showAddOption
                isAdmin={isAdmin}
                onAddOrUpdate={() => void openQuickPickDialog()}
                searchable
              />
            )}

            <SectionLabel>Order</SectionLabel>
            <Sentence>
              {'Dispense '}
              <TextBlank
                label="Quantity dispensed"
                placeholder="#"
                kind="number"
                min={1}
                value={quantityField.value}
                onChange={quantityField.onChange}
                readOnly={isReadOnly}
                need
                dataTestId={ids.quantity}
                {...invalidProps(!!errors.quantity, orderErrorId)}
              />{' '}
              <TextBlank
                label="DME"
                value={itemNameField.value}
                onChange={(value) => itemNameField.onChange(value.slice(0, DME_ITEM_NAME_MAX_LENGTH))}
                readOnly={isReadOnly}
                need
                dataTestId={ids.item}
                {...invalidProps(!!errors.itemName, orderErrorId)}
              />
              {', '}
              <Controller
                name="laterality"
                control={control}
                render={({ field }) => (
                  <SelectBlank
                    label="laterality"
                    title="Laterality"
                    options={DME_LATERALITY_OPTIONS.map((option) => ({
                      value: option,
                      label: DME_LATERALITY_LABELS[option] ?? option,
                    }))}
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange((value as DmeLaterality | undefined) ?? null)}
                    readOnly={isReadOnly}
                    clearable
                    dataTestId={ids.laterality}
                  />
                )}
              />
              {', '}
              <Controller
                name="modifier"
                control={control}
                render={({ field }) => (
                  <SelectBlank
                    label="modifier"
                    title="Modifiers"
                    options={DME_MODIFIER_OPTIONS.map((option) => ({
                      value: option,
                      label: DME_MODIFIER_LABELS[option] ?? option,
                    }))}
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange((value as DmeModifier | undefined) ?? null)}
                    readOnly={isReadOnly}
                    clearable
                    dataTestId={ids.modifier}
                  />
                )}
              />
              {', for '}
              <TextBlank
                label="Duration of use"
                placeholder="#"
                kind="number"
                min={0}
                value={durationValueField.value}
                onChange={durationValueField.onChange}
                readOnly={isReadOnly}
                dataTestId={ids.durationValue}
                {...invalidProps(!!errors.durationValue, orderErrorId)}
              />{' '}
              <Controller
                name="durationUnit"
                control={control}
                render={({ field }) => (
                  <SelectBlank
                    label="days/weeks"
                    title="Days/Weeks"
                    options={DME_DURATION_UNITS}
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange((value as DmeDurationUnit | undefined) ?? null)}
                    readOnly={isReadOnly}
                    dataTestId={ids.durationUnit}
                  />
                )}
              />
              {' of use.'}
            </Sentence>
            {errorText(orderErrorId, errors.quantity?.message, errors.itemName?.message, errors.durationValue?.message)}
            <Box data-testid={ids.diagnoses}>
              <Controller
                name="diagnoses"
                control={control}
                render={({ field }) => (
                  <ProcedureDiagnosesSentence
                    diagnoses={field.value as DiagnosisDTO[]}
                    visitDiagnoses={chartDiagnoses}
                    readOnly={isReadOnly}
                    need={false}
                    onChange={(diagnoses) => field.onChange(diagnoses.map(toCodeDisplay))}
                  />
                )}
              />
            </Box>
            <Sentence>
              {'Ordered by '}
              <Controller
                name="orderedBy"
                control={control}
                rules={{ validate: (value) => !!value?.id || 'This field is required' }}
                render={({ field }) => (
                  <OrderedByBlank
                    value={field.value}
                    onChange={field.onChange}
                    readOnly={isReadOnly}
                    dataTestId={ids.orderedBy}
                    {...invalidProps(!!errors.orderedBy, orderedByErrorId)}
                  />
                )}
              />
              .
            </Sentence>
            {errorText(orderedByErrorId, errors.orderedBy?.message)}

            <SectionLabel>Billing</SectionLabel>
            <Controller
              name="billingCodes"
              control={control}
              render={({ field }) => (
                <DmeBillingCodesSentence
                  value={field.value}
                  onChange={field.onChange}
                  readOnly={isReadOnly}
                  dataTestId={ids.billingCodes}
                />
              )}
            />

            <SectionLabel>Fulfillment</SectionLabel>
            <Sentence>
              {external ? 'Fulfilled by ' : 'Fulfilled '}
              <Controller
                name="external"
                control={control}
                render={({ field }) => (
                  <SelectBlank
                    label="fulfilled by"
                    title="Fulfilled by"
                    options={FULFILLMENT_OPTIONS}
                    value={field.value ? FULFILLMENT_OPTIONS[1].value : FULFILLMENT_OPTIONS[0].value}
                    onChange={(value) => field.onChange(value === FULFILLMENT_OPTIONS[1].value)}
                    readOnly={isReadOnly || externalLocked}
                    dataTestId={ids.externalSwitch}
                  />
                )}
              />
              .
            </Sentence>
            {external && (
              <Sentence>
                {'Third party: '}
                <TextBlank
                  label="clinic name"
                  value={thirdPartyNameField.value}
                  onChange={thirdPartyNameField.onChange}
                  readOnly={isReadOnly}
                  dataTestId={ids.thirdPartyName}
                />
                {', '}
                <TextBlank
                  label="address"
                  value={thirdPartyAddressField.value}
                  onChange={thirdPartyAddressField.onChange}
                  readOnly={isReadOnly}
                  dataTestId={ids.thirdPartyAddress}
                />
                {', phone '}
                <TextBlank
                  label="phone"
                  value={thirdPartyPhoneField.value}
                  onChange={thirdPartyPhoneField.onChange}
                  readOnly={isReadOnly}
                  dataTestId={ids.thirdPartyPhone}
                  {...invalidProps(!!errors.thirdParty?.phone, thirdPartyErrorId)}
                />
                {', fax '}
                <TextBlank
                  label="fax"
                  value={thirdPartyFaxField.value}
                  onChange={thirdPartyFaxField.onChange}
                  readOnly={isReadOnly}
                  dataTestId={ids.thirdPartyFax}
                  {...invalidProps(!!errors.thirdParty?.fax, thirdPartyErrorId)}
                />
                .
              </Sentence>
            )}
            {external &&
              errorText(thirdPartyErrorId, errors.thirdParty?.phone?.message, errors.thirdParty?.fax?.message)}

            <SectionLabel>Instructions</SectionLabel>
            <Controller
              name="instructions"
              control={control}
              render={({ field }) => (
                <TextField
                  placeholder="Instructions (optional)"
                  inputProps={{ 'aria-label': 'Instructions' }}
                  multiline
                  rows={3}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isReadOnly}
                  data-testid={ids.instructions}
                />
              )}
            />

            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onCancel} data-testid={ids.cancelButton}>
                Cancel
              </RoundedButton>
              <RoundedButton
                type="submit"
                color="primary"
                variant="contained"
                loading={formState.isSubmitting}
                disabled={isReadOnly || !encounterId}
                data-testid={ids.submitButton}
              >
                {order ? 'Save' : 'Order'}
              </RoundedButton>
            </Box>
            {submitError && (
              <Typography color="error" sx={{ textAlign: 'right' }} data-testid={ids.error}>
                {submitError}
              </Typography>
            )}
          </Stack>
        </Paper>
      </form>
      <DmeQuickPickDialogs
        open={quickPickDialogOpen}
        name={quickPickName}
        onNameChange={setQuickPickName}
        existingQuickPicks={existingQuickPicks}
        saving={quickPickSaving}
        onClose={() => setQuickPickDialogOpen(false)}
        onSave={(overwriteId) => void onSaveAsQuickPick(overwriteId)}
      />
    </FormProvider>
  );
};
