import { FC, useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAppointmentStore, useUpdatePaperwork } from '../../../../../state';
import { useDebounce } from '../../../../../hooks';
import { Box, Typography } from '@mui/material';
import { NumberInput } from '../NumberInput';
import { convertTemperature, updateQuestionnaireResponse } from '../../../../../utils';
import { getSelectors } from '../../../../../../shared/store/getSelectors';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';

type VitalsTemperatureProps = {
  validate: (value: string) => string | undefined;
};

export const VitalsTemperature: FC<VitalsTemperatureProps> = (props) => {
  const { validate } = props;

  const { appointment, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'questionnaireResponse',
  ]);
  const defaultValue = getQuestionnaireResponseByLinkId('vitals-temperature', questionnaireResponse)?.answer[0]
    .valueString;
  const { control, handleSubmit, watch, setValue, getValues } = useForm<{
    'vitals-temperature': string;
  }>({
    defaultValues: {
      'vitals-temperature': (defaultValue === 'N/A' ? '' : defaultValue) || '',
    },
  });
  const { mutate } = useUpdatePaperwork();
  const { debounce, clear } = useDebounce(1000);
  const [f, setF] = useState(convertTemperature(getValues('vitals-temperature'), 'fahrenheit'));

  const onSubmit = useCallback(
    (value: { 'vitals-temperature': string }): void => {
      debounce(() => {
        mutate(
          {
            appointmentID: appointment!.id!,
            paperwork: {
              'vitals-temperature': value['vitals-temperature'] || 'N/A',
            },
          },
          {
            onSuccess: () => {
              updateQuestionnaireResponse(
                questionnaireResponse,
                'vitals-temperature',
                value['vitals-temperature'] || 'N/A'
              );
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
        name="vitals-temperature"
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
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <NumberInput
            helperText={error ? error.message : null}
            error={!!error}
            label="Temp, C"
            value={value}
            onChange={(e) => {
              onChange(e);
              setF(convertTemperature(e.target.value, 'fahrenheit'));
            }}
          />
        )}
      />
      <Typography>/</Typography>
      <NumberInput
        label="Temp, F"
        value={f}
        onChange={(e) => {
          setF(e.target.value);
          setValue('vitals-temperature', convertTemperature(e.target.value, 'celsius'));
        }}
      />
    </Box>
  );
};
