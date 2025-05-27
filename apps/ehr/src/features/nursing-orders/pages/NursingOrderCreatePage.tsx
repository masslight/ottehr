import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, CircularProgress, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../shared/store/getSelectors';

export const NursingOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderNote, setOrderNote] = useState<string>('');
  const { patient, encounter } = getSelectors(useAppointmentStore, ['chartData', 'patient', 'encounter']);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      // In a real implementation, this would submit the order to the API
      console.log('Order submitted:', {
        notes: orderNote,
        patientId: patient?.id,
        encounterId: encounter?.id,
      });

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate back to the nursing orders list
      navigate(-1);
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, maxWidth: '680px' }}>
        <Typography variant="h4" color="primary.dark">
          Nursing Order
        </Typography>

        <Paper>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3 }}>
                  <TextField
                    fullWidth
                    id="notes"
                    label="Order note"
                    multiline
                    rows={4}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    required
                  />
                </Box>
                <Divider />
                <Box sx={{ px: 3, py: 2 }}>
                  <Stack direction="row" spacing={2} justifyContent="space-between">
                    <ButtonRounded
                      variant="outlined"
                      onClick={handleBack}
                      sx={{
                        borderRadius: '50px',
                        px: 4,
                        py: 1,
                      }}
                    >
                      Cancel
                    </ButtonRounded>
                    <Box>
                      <ButtonRounded
                        variant="contained"
                        type="submit"
                        disabled={orderNote.length === 0}
                        sx={{
                          borderRadius: '50px',
                          px: 4,
                          py: 1,
                        }}
                      >
                        Order
                      </ButtonRounded>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </form>
          )}
        </Paper>
      </Box>
    </Box>
  );
};
