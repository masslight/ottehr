import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Control, FieldErrors, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useUpdateVitalsAlertConfig, useVitalsAlertConfig } from 'src/hooks/useVitalsAlertConfig';
import {
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalsAlertConfig,
  VitalsAlertConfigSchema,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import {
  DEFAULT_VITALS_ALERT_CONFIG,
  getVitalsAlertConfigEngineError,
  makeVitalAlertAgeRangeId,
} from 'utils/lib/utils/vitals-alert-config';

export interface VitalsAlertConfigForm {
  control: Control<VitalsAlertConfig>;
  errors: FieldErrors<VitalsAlertConfig>;
  engineError?: string;
  ageRanges: VitalAlertAgeRange[];
  rowKeys: string[];
  isDirty: boolean;
  isPending: boolean;
  isError: boolean;
  isSubmitting: boolean;
  validate: () => Promise<boolean>;
  submit: () => void;
  discard: () => void;
  onAddAgeRange: () => void;
  onRemoveAgeRange: (index: number) => void;
  onMaxAgeValueEntered: (index: number) => void;
}

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

  const { fields, append, remove } = useFieldArray({ control, name: 'ageRanges', keyName: '_key' });

  const [engineError, setEngineError] = useState<string | undefined>(undefined);

  const checkEngineCompatibility = (): string | undefined => {
    const parsed = VitalsAlertConfigSchema.safeParse(getValues());
    const error = parsed.success ? getVitalsAlertConfigEngineError(parsed.data) : undefined;
    setEngineError(error);
    return error;
  };

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
    engineError,
    ageRanges,
    rowKeys: fields.map((field) => field._key),
    isDirty: Object.keys(dirtyFields).length > 0,
    isPending,
    isError,
    isSubmitting,
    validate: async () => {
      const schemaValid = await trigger();
      return !checkEngineCompatibility() && schemaValid;
    },
    submit: () => {
      const values = getValues();
      const parsed = VitalsAlertConfigSchema.safeParse(values);
      if (!parsed.success) return;
      if (checkEngineCompatibility()) return;
      mutate(
        { config: parsed.data },
        {
          onSuccess: () => {
            reset(values);
          },
        }
      );
    },
    discard: () => {
      setEngineError(undefined);
      reset(data ?? DEFAULT_VITALS_ALERT_CONFIG);
    },
    onAddAgeRange,
    onRemoveAgeRange,
    onMaxAgeValueEntered,
  };
};
