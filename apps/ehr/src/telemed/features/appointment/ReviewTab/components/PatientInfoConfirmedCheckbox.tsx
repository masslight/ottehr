import { Checkbox, FormControlLabel } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore, useSaveChartData } from '../../../../state';

export const PatientInfoConfirmedCheckbox: FC = () => {
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate, isLoading } = useSaveChartData();

  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value || false;

  const onChange = (value: boolean): void => {
    setPartialChartData({ patientInfoConfirmed: { value } });
    mutate(
      { patientInfoConfirmed: { value } },
      {
        onSuccess: (data) => {
          const patientInfoConfirmedUpdated = data.chartData.patientInfoConfirmed;
          if (patientInfoConfirmedUpdated) {
            setPartialChartData({ patientInfoConfirmed: patientInfoConfirmedUpdated });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while confirming patient information. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({ patientInfoConfirmed: chartData?.patientInfoConfirmed });
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
          data-testid={dataTestIds.telemedEhrFlow.patientInfoConfirmationCheckbox}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
      label="I confirmed patient's name, DOB, introduced myself and gave my licensure and credentials"
    />
  );
};
