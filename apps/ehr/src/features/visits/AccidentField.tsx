import { Box, CircularProgress, Stack } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { AccidentDTO, AllStates } from 'utils';
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

export const AccidentField: FC<Props> = ({ readOnly }) => {
  const {
    data: chartDataFields,
    refetch,
    isLoading: isChartDataLoading,
  } = useChartFields({
    requestedFields: {
      accident: {
        _tag: 'accident',
      },
    },
  });
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const [lastSavedAccident, setLastSavedAccident] = useState<AccidentDTO | undefined>();

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

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
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
          methods.setError('state', {
            message: 'State is required for Auto Accident',
          });
          return;
        } else {
          methods.clearErrors();
        }
        const accidentToSave = {
          resourceId: chartDataFields?.accident?.resourceId,
          type: types,
          date: values.date,
          state: values.state,
        };
        if (lastSavedAccident !== accidentToSave) {
          saveChartData(
            {
              accident: accidentToSave,
            },
            {
              onSuccess: () => {
                setLastSavedAccident(accidentToSave);
                void refetch();
              },
            }
          );
        }
      },
    });
    return () => callback();
  }, [methods, chartDataFields, lastSavedAccident, deleteChartData, saveChartData, refetch]);

  const disabled = isChartDataLoading || readOnly;

  return (
    <AccordionCard label="Patient's condition related to">
      <FormProvider {...methods}>
        <Stack spacing={2} padding={2}>
          <Stack spacing={2} direction="row" justifyContent="flex-start">
            <CheckboxInput name="autoAccident" label="Auto Accident" disabled={disabled} />
            <CheckboxInput name="employmentAccident" label="Employment" disabled={disabled} />
            <CheckboxInput name="otherAccident" label="Other Accident" disabled={disabled} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px' }}>
              {isSaveLoading || isDeleteLoading ? <CircularProgress size="20px" /> : null}
            </Box>
          </Stack>
          <Stack spacing={2} direction="row">
            <DateInput name="date" label="Date of accident" disabled={disabled} />
            <SelectInput
              name="state"
              label="State"
              options={AllStates.map((state) => state.value)}
              disabled={disabled}
            />
          </Stack>
        </Stack>
      </FormProvider>
    </AccordionCard>
  );
};
