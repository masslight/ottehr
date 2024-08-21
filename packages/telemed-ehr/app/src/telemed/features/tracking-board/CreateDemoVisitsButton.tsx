import { ReactElement, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Snackbar, TextField } from '@mui/material';
import React from 'react';
import { createDemoVisits } from '../../assets';
import { createSampleAppointments } from '../../../helpers/create-sample-appointments';
import { useApiClients } from '../../../hooks/useAppClients';
import { useAuth0 } from '@auth0/auth0-react';
import { Controller } from 'react-hook-form';
import { otherColors } from '../../../CustomThemeProvider';
import { LoadingButton } from '@mui/lab';

// interface CreateDemoVisitsButtonProps {
//   phoneNumber: string;
// }

const CreateDemoVisitsButton = (): ReactElement => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const { fhirClient } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();

  const handleCreateSampleAppointments = async (phoneNumber: string): Promise<void> => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError(true);
      return;
    }
    try {
      setLoading(true);
      setError(false);
      const authToken = await getAccessTokenSilently();
      const response = await createSampleAppointments(fhirClient, authToken, phoneNumber);
      console.log('response', response);
      setOpenSnackbar(true);
    } catch (error) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPhoneNumber(e.target.value);
    if (e.target.value.length >= 10 && e.target.value.length <= 15 && e.target.value.startsWith('+1')) {
      setError(false);
    } else {
      setError(true);
    }
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  };

  return (
    <>
      <TextField
        label="Phone Number"
        value={phoneNumber}
        onChange={handleChange}
        sx={{ my: 2 }}
        required
        error={error}
        helperText={error ? 'Please enter a valid phone number' : ''}
      />
      <LoadingButton
        loading={loading}
        onClick={() => handleCreateSampleAppointments(phoneNumber)}
        sx={{
          my: 2,
          borderRadius: 10,
          border: '1px solid #2169F5',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <img src={createDemoVisits} alt="create demo visits" />
        Create Demo Visits
      </LoadingButton>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          Appointments created successfully!
        </Alert>
      </Snackbar>
    </>
  );
};

export default CreateDemoVisitsButton;
