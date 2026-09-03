import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Control, FieldErrors, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useUpdateVitalsAlertConfig, useVitalsAlertConfig } from 'src/hooks/useVitalsAlertConfig';
import {
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalsAlertConfig,
  VitalsAlertConfigSchema,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { DEFAULT_VITALS_ALERT_CONFIG, makeVitalAlertAgeRangeId } from 'utils/lib/utils/vitals-alert-config';

export interface VitalsAlertConfigForm {
  control: Control<VitalsAlertConfig>;
  errors: FieldErrors<VitalsAlertConfig>;
  ageRanges: VitalAlertAgeRange[];
  rowKeys: string[];
  isDirty: boolean;
  isPending: boolean;
  isError: boolean;
  isSubmitting: boolean;
  /** Populates `errors` as a side effect. */
  validate: () => Promise<boolean>;
  /** Persists the current values. Only call after {@link validate} has passed. */
  submit: () => void;
  discard: () => void;
  onAddAgeRange: () => void;
  onRemoveAgeRange: (index: number) => void;
  onMaxAgeValueEntered: (index: number) => void;
}

/**
 * Form state for the vital alert levels, which have their own resource and endpoint but are saved by
 * the progress note page's shared Save.
 */
export const useVitalsAlertConfigForm = (): VitalsAlertConfigForm => {
  const { data, isPending, isError } = useVitalsAlertConfig();
  const { mutate, isPending: isSubmitting } = useUpdateVitalsAlertConfig();

  const {
    control,
    formState: { errors, dirtyFields },
    getValues,
    setValue,
    trigger,
    reset,
  } = useForm<VitalsAlertConfig>({
    defaultValues: DEFAULT_VITALS_ALERT_CONFIG,
    resolver: zodResolver(VitalsAlertConfigSchema),
  });

  // keyName is off the default so useFieldArray's key does not shadow the age range's own `id`.
  const { fields, append, remove } = useFieldArray({ control, name: 'ageRanges', keyName: '_key' });

  // `fields` gives length and order, the watched values give live edits.
  const watchedRanges = useWatch({ control, name: 'ageRanges' });
  const ageRanges: VitalAlertAgeRange[] = fields.map((field, index) => ({
    ...(field as unknown as VitalAlertAgeRange),
    ...(watchedRanges?.[index] ?? {}),
  }));

  useEffect(() => {
    if (!data) return;
    reset(data, { keepDirtyValues: true });
  }, [data, reset]);

  const onAddAgeRange = (): void => {
    const id = makeVitalAlertAgeRangeId();
    const existing = getValues('ageRanges');
    const previous = existing[existing.length - 1];
    append({
      id,
      minAge: previous?.maxAge ?? { unit: previous?.minAge?.unit ?? 'years', value: undefined as unknown as number },
      maxAge: undefined,
    });
    VITAL_ALERT_TYPES.forEach((vital) => {
      setValue(`thresholds.${vital}.${id}`, {}, { shouldDirty: true });
    });
  };

  const onMaxAgeValueEntered = (index: number): void => {
    const range = getValues(`ageRanges.${index}`);
    if (!range?.maxAge?.unit) {
      setValue(`ageRanges.${index}.maxAge.unit`, range?.minAge?.unit ?? 'years', { shouldDirty: true });
    }
  };

  const onRemoveAgeRange = (index: number): void => {
    const removed = getValues('ageRanges')[index];

    // No other range is altered; the removed span becomes unconfigured.
    remove(index);
    if (!removed) return;

    VITAL_ALERT_TYPES.forEach((vital) => {
      const perRange = { ...(getValues(`thresholds.${vital}`) ?? {}) };
      delete perRange[removed.id];
      setValue(`thresholds.${vital}`, perRange, { shouldDirty: true });
    });
  };

  return {
    control,
    errors,
    ageRanges,
    rowKeys: fields.map((field) => field._key),
    // Not formState.isDirty: an open-ended range materializes an empty `maxAge` node absent from the
    // stored config, which makes its deep compare report dirty permanently.
    isDirty: Object.keys(dirtyFields).length > 0,
    isPending,
    isError,
    isSubmitting,
    validate: () => trigger(),
    submit: () => {
      const values = getValues();
      // Parsing strips the empty `maxAge` node an open-ended range carries in form state.
      const parsed = VitalsAlertConfigSchema.safeParse(values);
      if (!parsed.success) return;
      mutate(
        { config: parsed.data },
        {
          onSuccess: () => {
            reset(values);
          },
        }
      );
    },
    discard: () => reset(data ?? DEFAULT_VITALS_ALERT_CONFIG),
    onAddAgeRange,
    onRemoveAgeRange,
    onMaxAgeValueEntered,
  };
};
