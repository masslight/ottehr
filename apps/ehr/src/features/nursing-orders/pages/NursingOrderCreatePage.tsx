import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Grid, TextField, CircularProgress, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
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
    <Box>
      <Typography variant="h4" color="primary.dark" sx={{ mb: 3 }}>
        Nursing Order
      </Typography>

      <Paper sx={{ p: 4 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
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
              </Grid>

              <Grid item xs={12} sx={{ mt: 3 }}>
                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    sx={{
                      borderRadius: '50px',
                      px: 4,
                      py: 1,
                    }}
                  >
                    Cancel
                  </Button>
                  <Box>
                    <Button
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
                    </Button>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </Paper>
    </Box>
  );
};
