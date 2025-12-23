import { Autocomplete, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeOption, emCodeOptions } from 'utils';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';

export const EMCodeField: FC = () => {
  const { chartData, setPartialChartData } = useChartData();
  const emCode = chartData?.emCode;
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const onChange = (value: CPTCodeOption | null): void => {
    if (value) {
      const prevValue = emCode;
      const optimisticValue = { ...emCode, ...value };

      // Optimistic update
      setPartialChartData({ emCode: optimisticValue }, false);

      saveChartData(
        { emCode: optimisticValue },
        {
          onSuccess: (data) => {
            const saved = data.chartData?.emCode;

            if (saved) {
              // Update with server response (resourceId, etc.)
              setPartialChartData({ emCode: saved });
            }
          },
          onError: () => {
            enqueueSnackbar('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
            // Rollback to previous state
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
    } else {
      const prevValue = emCode;

      // Optimistic update
      setPartialChartData({ emCode: undefined }, false);

      deleteChartData(
        { emCode },
        {
          onError: () => {
            enqueueSnackbar('An error has occurred while deleting E&M code. Please try again.', { variant: 'error' });
            // Rollback to previous state
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
    }
  };

  return (
    <Autocomplete
      disabled={isSaveLoading || isDeleteLoading}
      options={emCodeOptions}
      data-testid={dataTestIds.assessmentCard.emCodeDropdown}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      value={emCode ? { display: emCode.display, code: emCode.code } : null}
      getOptionLabel={(option) => option.display}
      onChange={(_e, value) => onChange(value)}
      renderInput={(params) => <TextField {...params} size="small" label="E&M code" placeholder="Search E&M code" />}
    />
  );
};
