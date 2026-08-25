import { Box, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNursingOrder } from 'src/api/api';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useMarkDraftNavigatedAway, useNursingOrderStore } from 'src/state/draft-data.store';
import { CreateNursingOrderInput } from 'utils/lib/types/data/orders/types';
import { BreadCrumbs } from '../components/BreadCrumbs';

interface NursingOrderCreatePageProps {
  // set by the Review & Sign inline edit flow to collapse back to its order list instead of
  // navigating away; on the route it is absent and the page navigates
  onFinished?: () => void;
}

export const NursingOrderCreatePage: React.FC<NursingOrderCreatePageProps> = ({ onFinished }) => {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const [loading, setLoading] = useState(false);
  const { patient, encounter } = useAppointmentData();

  const { setDraft, clearDraft, hasDraft, getDraft } = useNursingOrderStore();
  const draft = getDraft(encounter?.id ?? '');

  const [orderNote, setOrderNote] = useState(draft.notes ?? '');

  useMarkDraftNavigatedAway({ encounterId: encounter?.id ?? '', setDraft, hasDraft });

  const handleOrderNoteChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setOrderNote(value);
    if (encounter?.id) {
      setDraft(encounter.id, { notes: value });
    }
  };

  const handleClearForm = (): void => {
    clearDraft(encounter?.id ?? '');
    setOrderNote('');
  };

  const handleBack = (): void => {
    if (encounter.id) clearDraft(encounter.id);
    if (onFinished) onFinished();
    else navigate(-1);
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
        encounterId: encounter.id,
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

        {/* inline the note section card header already names the section */}
        {!isInlineFlow && (
          <Typography variant="h4" color="primary.dark" data-testid={dataTestIds.nursingOrderCreatePage.title}>
            Nursing Order
          </Typography>
        )}

        {encounter.id && hasDraft(encounter.id) && (
          <UnsavedDraftWarning
            message={
              draft.hasNavigatedAway
                ? 'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
                : 'You have a nursing order in progress. Your draft will be saved'
            }
          />
        )}

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
                    onChange={handleOrderNoteChange}
                    required
                    inputProps={{ maxLength: 150 }}
                    data-testid={dataTestIds.nursingOrderCreatePage.orderNoteInput}
                  />
                </Box>
                <Divider />
                <Box sx={{ px: 3, py: 2 }}>
                  <Stack direction="row" spacing={2} justifyContent="space-between">
                    <Stack direction="row" spacing={2}>
                      <ButtonRounded
                        variant="outlined"
                        onClick={handleBack}
                        sx={{ borderRadius: '50px', px: 4, py: 1 }}
                        data-testid={dataTestIds.nursingOrderCreatePage.cancelButton}
                      >
                        Cancel
                      </ButtonRounded>
                      {encounter?.id && hasDraft(encounter.id) && (
                        <ButtonRounded
                          variant="outlined"
                          onClick={handleClearForm}
                          sx={{ borderRadius: '50px', px: 4, py: 1 }}
                        >
                          Clear Form
                        </ButtonRounded>
                      )}
                    </Stack>
                    <Box>
                      <ButtonRounded
                        variant="contained"
                        type="submit"
                        disabled={orderNote.length === 0 || loading}
                        sx={{ borderRadius: '50px', px: 4, py: 1 }}
                        data-testid={dataTestIds.nursingOrderCreatePage.orderButton}
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
