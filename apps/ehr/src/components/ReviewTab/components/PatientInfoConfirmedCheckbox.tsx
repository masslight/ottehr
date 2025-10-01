import { Checkbox, FormControlLabel } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSaveChartData } from 'src/shared/hooks/appointment/appointment.store';
import { useChartFields } from 'src/shared/hooks/appointment/useChartFields';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';

export const PatientInfoConfirmedCheckbox: FC = () => {
  const { data: chartData, setQueryCache } = useChartFields({
    requestedFields: { patientInfoConfirmed: {} },
  });
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate, isPending: isLoading } = useSaveChartData();

  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value || false;

  const onChange = (value: boolean): void => {
    setQueryCache({ patientInfoConfirmed: { value } });
    mutate(
      { patientInfoConfirmed: { value } },
      {
        onSuccess: (data) => {
          const patientInfoConfirmedUpdated = data.chartData.patientInfoConfirmed;
          if (patientInfoConfirmedUpdated) {
            setQueryCache({ patientInfoConfirmed: patientInfoConfirmedUpdated });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while confirming patient information. Please try again.', {
            variant: 'error',
          });
          setQueryCache({ patientInfoConfirmed: chartData?.patientInfoConfirmed });
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
