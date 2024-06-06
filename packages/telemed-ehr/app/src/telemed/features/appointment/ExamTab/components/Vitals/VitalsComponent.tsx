import { FC, useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { useAppointmentStore, useUpdatePaperwork } from '../../../../../state';
import { useDebounce } from '../../../../../hooks';
import { getSelectors } from '../../../../../../shared/store/getSelectors';
import { NumberInput } from '../NumberInput';
import { updateQuestionnaireResponse } from '../../../../../utils';

type VitalsComponentProps = {
  name: 'vitals-pulse' | 'vitals-hr' | 'vitals-rr' | 'vitals-bp';
  label: string;
  validate: (value: string) => string | undefined;
};

export const VitalsComponent: FC<VitalsComponentProps> = (props) => {
  const { name, label, validate } = props;

  const { appointment, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'questionnaireResponse',
  ]);
  const defaultValue = getQuestionnaireResponseByLinkId(name, questionnaireResponse)?.answer[0].valueString;
  const { control, handleSubmit, watch } = useForm<{
    [name: string]: string;
  }>({
    defaultValues: {
      [name]: (defaultValue === 'N/A' ? '' : defaultValue) || '',
    },
  });
  const { mutate } = useUpdatePaperwork();
  const { debounce, clear } = useDebounce(1000);

  const onSubmit = useCallback(
    (value: { [name: string]: string }): void => {
      debounce(() => {
        mutate(
          {
            appointmentID: appointment!.id!,
            paperwork: {
              [name]: value[name] || 'N/A',
            },
          },
          {
            onSuccess: () => {
              updateQuestionnaireResponse(questionnaireResponse, name, value[name] || 'N/A');
            },
          }
        );
      });
    },
    [questionnaireResponse, debounce, mutate, appointment, name]
  );

  useEffect(() => {
    const subscription = watch(() => handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [handleSubmit, watch, onSubmit]);

  return (
    <Controller
      name={name}
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
          label={label}
          value={value}
          onChange={onChange}
          sx={{ flex: 1 }}
        />
      )}
    />
  );
};
