import React, { FC } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../../../../state';

export type CPTCodeOption = {
  code: string;
  display: string;
};

export const CPTCodeField: FC = () => {
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const cptCode = (chartData?.cptCodes || [])[0];

  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();

  const onChange = (value: CPTCodeOption | null): void => {
    if (cptCode) {
      deleteChartData({ cptCodes: [cptCode] });
      setPartialChartData({ cptCodes: [] });
    }
    if (value) {
      saveChartData(
        { cptCodes: [value] },
        {
          onSuccess: (data) => {
            const saved = (data?.cptCodes || [])[0];

            if (saved) {
              setPartialChartData({ cptCodes: [saved] });
            }
          },
        },
      );
      setPartialChartData({ cptCodes: [value] });
    }
  };

  return (
    <Autocomplete
      disabled={isSaveLoading || isDeleteLoading}
      options={options}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      value={cptCode ? { display: cptCode.display, code: cptCode.code } : null}
      getOptionLabel={(option) => option.display}
      onChange={(_e, value) => onChange(value)}
      renderInput={(params) => <TextField {...params} size="small" label="CPT code *" placeholder="Search CPT code" />}
    />
  );
};

const options: CPTCodeOption[] = [
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
