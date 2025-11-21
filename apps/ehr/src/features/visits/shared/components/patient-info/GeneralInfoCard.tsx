import { alpha, Box, Checkbox, FormControlLabel, Grid, lighten, Paper, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getPatientName } from 'src/shared/utils';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useSaveChartData } from '../../stores/appointment/appointment.store';
import { ProfileAvatar } from '../ProfileAvatar';

const GeneralInfoCard: React.FC = (): JSX.Element => {
  const theme = useTheme();
  const { visitState: appointmentData, mappedData } = useAppointmentData();
  const { patient: patientData } = appointmentData;
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

  const dateOfBirth = patientData?.birthDate ? DateTime.fromISO(patientData?.birthDate)?.toFormat('MM/dd/yyyy') : '';

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Grid container>
        <Grid item xs={6} container>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex' }}>
              <ProfileAvatar embracingSquareSize={100} hasEditableInfo={!isReadOnly} />

              <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.primary.dark,
                    fontSize: '18px',
                    fontWeight: 500,
                  }}
                >
                  {getPatientName(patientData?.name).fullDisplayName}
                </Typography>
                <Typography variant="body1" color={theme.palette.primary.dark} sx={{ mt: 1 }}>
                  {mappedData.pronouns ?? ''}
                </Typography>
                <Typography variant="body1" color={theme.palette.primary.dark} sx={{ mt: 1 }}>
                  DOB: {dateOfBirth}
                </Typography>
              </Box>
            </Box>

            <Box>
              <FormControlLabel
                sx={{
                  mr: 0,
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  borderRadius: 2,
                  mt: 2,
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
                      fontSize: '16px',
                      fontWeight: 600,
                      color: isCheckboxDisabled ? lighten(theme.palette.text.primary, 0.4) : theme.palette.text.primary,
                    }}
                  >
                    I verified patient's name and date of birth
                  </Typography>
                }
              />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default GeneralInfoCard;
