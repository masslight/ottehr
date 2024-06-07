import React, { FC } from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useSaveChartData } from '../../../../state';

export const PatientInfoConfirmedCheckbox: FC = () => {
  const { chartData, setPartialChartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'isReadOnly',
  ]);
  const { mutate, isLoading } = useSaveChartData();

  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value || false;

  const onChange = (value: boolean): void => {
    setPartialChartData({ patientInfoConfirmed: { value } });
    mutate(
      { patientInfoConfirmed: { value } },
      {
        onSuccess: (data) => {
          const patientInfoConfirmedUpdated = data.patientInfoConfirmed;
          if (patientInfoConfirmedUpdated) {
            setPartialChartData({ patientInfoConfirmed: patientInfoConfirmedUpdated });
          }
        },
      }
    );
  };

  return (
    <FormControlLabel
      control={
        <Checkbox
          disabled={isLoading || isReadOnly}
          checked={patientInfoConfirmed}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
      label="I confirmed patient's name, DOB, introduced myself and gave my licensure and credentials"
    />
  );
};
