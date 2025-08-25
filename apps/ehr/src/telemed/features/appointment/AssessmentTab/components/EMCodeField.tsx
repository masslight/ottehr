import { Autocomplete, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../../../state';

export type CPTCodeOption = {
  code: string;
  display: string;
};

export const EMCodeField: FC = () => {
  const { chartData, setPartialChartData } = useChartData();
  const emCode = chartData?.emCode;
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const onChange = (value: CPTCodeOption | null): void => {
    if (value) {
      const prevValue = emCode;

      saveChartData(
        { emCode: { ...emCode, ...value } },
        {
          onSuccess: (data) => {
            const saved = data.chartData?.emCode;

            if (saved) {
              setPartialChartData({ emCode: saved });
            }
          },
          onError: () => {
            enqueueSnackbar('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
      setPartialChartData({ emCode: value });
    } else {
      deleteChartData({ emCode });
      setPartialChartData({ emCode: undefined });
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

export const emCodeOptions: CPTCodeOption[] = [
  { display: '99201 New Patient - E/M Level 1', code: '99201' },
  { display: '99202 New Patient - E/M Level 2', code: '99202' },
  { display: '99203 New Patient - E/M Level 3', code: '99203' },
  { display: '99204 New Patient - E/M Level 4', code: '99204' },
  { display: '99205 New Patient - E/M Level 5', code: '99205' },
  { display: '99212 Established Patient - E/M Level 2', code: '99212' },
  { display: '99213 Established Patient - E/M Level 3', code: '99213' },
  { display: '99214 Established Patient - E/M Level 4', code: '99214' },
  { display: '99215 Established Patient - E/M Level 5', code: '99215' },
];
