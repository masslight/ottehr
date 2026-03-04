import { Stack } from '@mui/material';
import { FC, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { useChartFields } from './shared/hooks/useChartFields';

interface Props {
  readOnly: boolean;
}

export const AccidentField: FC<Props> = (_p) => {
  const { data: _chartDataFields } = useChartFields({
    requestedFields: {
      accident: {
        _tag: 'accident',
      },
    },
  });
  //const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  //const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const methods = useForm();
  const formValues = methods.watch();

  const { debounce } = useDebounce(1000);
  useEffect(() => {
    debounce(() => {
      if (
        (!formValues.autoAccident && !formValues.employmentAccident && !formValues.otherAccident) ||
        (formValues.autoAccident && !formValues.state)
      ) {
        return;
      }
      // todo save accident
    });
  }, [debounce, formValues]);

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
