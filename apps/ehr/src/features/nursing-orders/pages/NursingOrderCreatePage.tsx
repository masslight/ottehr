import { Box, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNursingOrder } from 'src/api/api';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { CreateNursingOrderInput } from 'utils';
import { useAppointmentData } from '../../../telemed/state/appointment/appointment.store';
import { BreadCrumbs } from '../components/BreadCrumbs';

export const NursingOrderCreatePage: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderNote, setOrderNote] = useState<string>('');
  const { patient, encounter } = useAppointmentData();

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      if (!oystehrZambda) throw new Error('Zambda client not found');
      console.log('Order submitted:', {
        notes: orderNote,
        patientId: patient?.id,
        encounterId: encounter?.id,
      });

      if (!encounter?.id) {
        throw new Error('Missing encounter ID');
      }

      const zambdaParams: CreateNursingOrderInput = {
        encounterId: encounter?.id,
        notes: orderNote,
      };

      await createNursingOrder(oystehrZambda, zambdaParams);

      handleBack();
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, maxWidth: '680px' }}>
        <BreadCrumbs />

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
                    inputProps={{ maxLength: 150 }}
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
                        disabled={orderNote.length === 0 || loading}
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
