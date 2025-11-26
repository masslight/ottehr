import { alpha, Box, Checkbox, FormControlLabel, lighten, Paper, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useSaveChartData } from '../../stores/appointment/appointment.store';

export const VerifiedPatientInfo: FC = () => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { data: chartData, isLoading: isLoadingChartData } = useChartFields({
    requestedFields: { patientInfoConfirmed: {} },
  });

  useEffect(() => {
    if (!chartData) {
      return;
    }
    const isPatientInfoConfirmed = chartData?.patientInfoConfirmed?.value ?? false;
    setVerifiedNameAndDob(isPatientInfoConfirmed);
  }, [chartData]);

  const [isVerifiedNameAndDob, setVerifiedNameAndDob] = useState<boolean>(false);
  const { mutateAsync: updateVerificationStatusAsync, isPending: isUpdatingVerificationStatus } = useSaveChartData();
  const isCheckboxDisabled =
    isLoadingChartData || chartData === undefined || isUpdatingVerificationStatus || isReadOnly;

  const handlePatientInfoVerified = useCallback(
    async (isChecked: boolean): Promise<void> => {
      setVerifiedNameAndDob(isChecked);
      try {
        const data = await updateVerificationStatusAsync({ patientInfoConfirmed: { value: isChecked } });
        const patientInfoConfirmedUpdated = data.chartData.patientInfoConfirmed;
        if (patientInfoConfirmedUpdated) {
          setVerifiedNameAndDob(patientInfoConfirmedUpdated.value ?? false);
        }
      } catch {
        enqueueSnackbar('An error has occurred while saving patient info verification status. Please try again.', {
          variant: 'error',
        });
      }
    },
    [updateVerificationStatusAsync]
  );

  return (
    <Paper elevation={3} sx={{ p: 2, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Box>
        <FormControlLabel
          sx={{
            m: 0,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            borderRadius: 2,
            pr: 2,
          }}
          control={
            <Checkbox
              data-testid={dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox}
              sx={{
                color: theme.palette.primary.main,
                '&.Mui-checked': {
                  color: theme.palette.primary.main,
                },
                '&.Mui-disabled': {
                  color: lighten(theme.palette.primary.main, 0.4),
                },
              }}
              disabled={isCheckboxDisabled}
              checked={isVerifiedNameAndDob}
              onChange={(e) => handlePatientInfoVerified(e.target.checked)}
            />
          }
          label={
            <Typography
              sx={{
                ml: 0,
                fontSize: '16px',
                fontWeight: 400,
                color: isCheckboxDisabled ? lighten(theme.palette.text.primary, 0.4) : theme.palette.text.primary,
              }}
            >
              I verified patient's name and date of birth
            </Typography>
          }
        />
      </Box>
    </Paper>
  );
};
