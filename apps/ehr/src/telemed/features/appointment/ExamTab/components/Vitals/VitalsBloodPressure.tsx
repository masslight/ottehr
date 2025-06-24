import { Box, Typography } from '@mui/material';
import { FC, useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { getQuestionnaireResponseByLinkId } from 'utils';
import { getSelectors } from '../../../../../../shared/store/getSelectors';
import { useDebounce } from '../../../../../hooks';
import { useAppointmentStore, useUpdatePaperwork } from '../../../../../state';
import { updateQuestionnaireResponse } from '../../../../../utils';
import { NumberInput } from '../NumberInput';

type VitalsBloodPressureProps = {
  validate: (value: string) => string | undefined;
};

export const VitalsBloodPressure: FC<VitalsBloodPressureProps> = (props) => {
  const { validate } = props;

  const { appointment, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'questionnaireResponse',
  ]);
  const defaultValue = getQuestionnaireResponseByLinkId('vitals-bp', questionnaireResponse)?.answer?.[0]?.valueString;
  const { control, handleSubmit, watch, setValue, getValues } = useForm<{
    'vitals-bp': string;
  }>({
    defaultValues: {
      'vitals-bp': (defaultValue === 'N/A' ? '' : defaultValue) || '',
    },
  });
  const { mutate } = useUpdatePaperwork();
  const { debounce, clear } = useDebounce(1000);
  const [_bp, setBp] = useState(getValues('vitals-bp') ?? '/');

  const onSubmit = useCallback(
    (value: { 'vitals-bp': string }): void => {
      debounce(() => {
        mutate(
          {
            appointmentID: appointment!.id!,
            paperwork: {
              'vitals-bp': value['vitals-bp'] || 'N/A',
            },
          },
          {
            onSuccess: () => {
              updateQuestionnaireResponse(questionnaireResponse, 'vitals-bp', value['vitals-bp'] || 'N/A');
            },
          }
        );
      });
    },
    [debounce, mutate, appointment, questionnaireResponse]
  );

  useEffect(() => {
    const subscription = watch(() => handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [handleSubmit, watch, onSubmit]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1.5 }}>
      <Controller
        name="vitals-bp"
        control={control}
        rules={{
          validate: (value) => {
            const result = validate(value);
            if (result) {
              clear();
              return result;
            }
            return;
          },
        }}
        render={({ field: { value, onChange }, fieldState: { error } }) => {
          const [systolic, diastolic] = value.split('/');
          const systolicError = error?.message?.startsWith('Systolic ');
          const systolicErrorMessage = systolicError && error?.message?.split('Systolic ')[1];
          const diastolicError = error?.message?.startsWith('Diastolic ');
          const diastolicErrorMessage = diastolicError && error?.message?.split('Diastolic ')[1];

          return (
            <>
              <NumberInput
                helperText={error && systolicError ? systolicErrorMessage : null}
                error={!!systolicError}
                label="BP Systolic, mmHg"
                value={systolic}
                onChange={(e) => {
                  const newBp = `${e.target.value}/${diastolic}`;
                  onChange(e);
                  setBp(newBp);
                  setValue('vitals-bp', newBp);
                }}
              />
              <Typography>/</Typography>
              <NumberInput
                helperText={error && diastolicError ? diastolicErrorMessage : null}
                error={!!diastolicError}
                label="BP Diastolic, mmHg"
                value={diastolic}
                onChange={(e) => {
                  const newBp = `${systolic}/${e.target.value}`;
                  onChange(e);
                  setBp(newBp);
                  setValue('vitals-bp', newBp);
                }}
              />
            </>
          );
        }}
      />
    </Box>
  );
};
