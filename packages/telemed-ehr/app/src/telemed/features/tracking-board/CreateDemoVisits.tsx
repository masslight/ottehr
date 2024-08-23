import { ReactElement, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Snackbar, TextField, Typography } from '@mui/material';
import React from 'react';
import { createDemoVisits } from '../../assets';
import { createSampleAppointments } from '../../../helpers/create-sample-appointments';
import { useApiClients } from '../../../hooks/useAppClients';
import { useAuth0 } from '@auth0/auth0-react';
import { otherColors } from '../../../CustomThemeProvider';
import { LoadingButton } from '@mui/lab';
import { Box } from '@mui/system';

const CreateDemoVisits = (): ReactElement => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [inputError, setInputError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const { fhirClient } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();

  const handleCreateSampleAppointments = async (phoneNumber: string): Promise<void> => {
    if (!phoneNumber || phoneNumber.length < 10 || !phoneNumber.startsWith('+1')) {
      setInputError(true);
      return;
    }
    try {
      setLoading(true);
      setInputError(false);
      const authToken = await getAccessTokenSilently();
      const response = await createSampleAppointments(fhirClient, authToken, phoneNumber);
      console.log('response', response);
      setSnackbar({
        open: true,
        message: 'Appointments created successfully!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating appointments:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create appointments. Please try again.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPhoneNumber(e.target.value);
    if (e.target.value.length >= 10 && e.target.value.length <= 15 && e.target.value.startsWith('+1')) {
      setInputError(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: otherColors.lightBlue,
        px: 2.5,
        py: 1.5,
        borderRadius: 2,
        mt: 2,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
        <Typography variant="h6" color="primary.main">
          Lack of test data? Create demo visits
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please enter a phone number to create visits for this user
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexGrow: 1, gap: 2, alignItems: 'center' }}>
        <TextField
          label="Phone Number"
          value={phoneNumber}
          onChange={handleChange}
          size="small"
          sx={{
            flexGrow: 1,
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: inputError ? 'error.main' : 'rgba(0, 0, 0, 0.23)',
              },
              '& input': {
                backgroundColor: 'white',
              },
            },
          }}
          required
          error={inputError}
          helperText={inputError ? 'Please enter a valid phone number' : ''}
        />
        <LoadingButton
          loading={loading}
          onClick={() => handleCreateSampleAppointments(phoneNumber)}
          size="small"
          sx={{
            borderRadius: 10,
            border: '1px solid #2169F5',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,

            px: 2,
            py: 0.75,
            flexShrink: 0,
            minHeight: 0,
            '& .MuiButton-startIcon': {
              margin: 0,
            },
          }}
          startIcon={<img src={createDemoVisits} alt="create demo visits" style={{ width: 16, height: 16 }} />}
        >
          <Typography variant="button" sx={{ textTransform: 'none', textWrap: 'nowrap' }}>
            Create Demo Visits
          </Typography>
        </LoadingButton>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CreateDemoVisits;
