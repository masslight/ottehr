import { Stack } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { AccidentDTO } from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDeleteChartData, useSaveChartData } from './shared/stores/appointment/appointment.store';

interface Props {
  readOnly: boolean;
}

interface FormData {
  autoAccident: boolean;
  employmentAccident: boolean;
  otherAccident: boolean;
  date?: string;
  state?: string;
}

export const AccidentField: FC<Props> = (_p) => {
  const {
    data: chartDataFields,
    refetch,
    isLoading: _isChartDataLoading,
  } = useChartFields({
    requestedFields: {
      accident: {
        _tag: 'accident',
      },
    },
  });
  const { mutate: saveChartData, isPending: _isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: _isDeleteLoading } = useDeleteChartData();
  const [lastSavedAccident, setLastSavedAccident] = useState<AccidentDTO | undefined>();

  console.log('chartDataFields', chartDataFields);

  const methods = useForm<FormData>({
    defaultValues: {
      autoAccident: false,
      employmentAccident: false,
      otherAccident: false,
    },
  });

  useEffect(() => {
    methods.reset({
      autoAccident: chartDataFields?.accident?.type?.includes('AA') ?? false,
      employmentAccident: chartDataFields?.accident?.type?.includes('EM') ?? false,
      otherAccident: chartDataFields?.accident?.type?.includes('OA') ?? false,
      date: chartDataFields?.accident?.date,
      state: chartDataFields?.accident?.state,
    });
  }, [chartDataFields, methods]);

  const formValues = methods.getValues();

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        console.log(values);
        const types: string[] = [];
        if (values.autoAccident) {
          types.push('AA');
        }
        if (values.employmentAccident) {
          types.push('EM');
        }
        if (values.otherAccident) {
          types.push('OA');
        }
        if (types.length === 0 && chartDataFields?.accident != null) {
          deleteChartData({
            accident: chartDataFields?.accident,
          });
          return;
        }
        if (values.autoAccident && !values.state) {
          // todo show error
          return;
        }
        const accidentToSave = {
          resourceId: chartDataFields?.accident?.resourceId,
          type: types,
          date: values.date,
          state: values.state,
        };
        if (lastSavedAccident !== accidentToSave) {
          saveChartData({
            accident: accidentToSave,
          });
          setLastSavedAccident(accidentToSave);
          void refetch();
        }
      },
    });
    return () => callback();
  }, [methods, chartDataFields, lastSavedAccident, deleteChartData, saveChartData, refetch]);

  return (
    <AccordionCard label="Patient's condition related to">
      <FormProvider {...methods}>
        <Stack spacing={2} padding={2}>
          <Stack spacing={2} direction="row" justifyContent="flex-start">
            <CheckboxInput name="autoAccident" label="Auto Accident" />
            <CheckboxInput name="employmentAccident" label="Employment" />
            <CheckboxInput name="otherAccident" label="Other Accident" />
          </Stack>
          <Stack spacing={2} direction="row">
            <DateInput name="date" label="Date of accident" />
            <SelectInput
              name="state"
              label="State"
              options={[]}
              validate={(value: string | undefined): boolean | string => {
                if (formValues.autoAccident && value == null) {
                  return 'State is required for Auto Accident';
                }
                return true;
              }}
            />
          </Stack>
        </Stack>
      </FormProvider>
    </AccordionCard>
  );
};
