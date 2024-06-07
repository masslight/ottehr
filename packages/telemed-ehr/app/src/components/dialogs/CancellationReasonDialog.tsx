import LoadingButton from '@mui/lab/LoadingButton';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import { Appointment, Encounter } from 'fhir/r4';
import React, { ReactElement, useState } from 'react';
import { cancelAppointment } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { CancelAppointmentParameters, CancellationReasonOptions } from '../../types/types';

interface CancellationReasonDialogProps {
  handleClose: () => void;
  getResourceBundle: () => Promise<void>;
  appointment: Appointment;
  encounter: Encounter;
  open: boolean;
}

export default function CancellationReasonDialog({
  handleClose,
  getResourceBundle,
  appointment,
  encounter,
  open,
}: CancellationReasonDialogProps): ReactElement {
  const { zambdaIntakeClient } = useApiClients();
  const [cancellationReason, setCancellationReason] = useState<CancellationReasonOptions | ''>('');
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const buttonSx = {
    fontWeight: '700',
    textTransform: 'none',
    borderRadius: 6,
  };
  const ITEM_HEIGHT = 34;
  const ITEM_PADDING_Y = 16;

  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 8 + ITEM_PADDING_Y,
        width: 350,
      },
    },
  };

  const handleCancel = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCancelLoading(true);
    if (!(cancellationReason && encounter && encounter.id && encounter.statusHistory)) {
      console.error(
        'one of cancellationReason, encounter, encounter.id, or encounter.statusHistory is null or undefined'
      );
      return;
    }

    const zambdaParams: CancelAppointmentParameters = {
      appointmentID: appointment.id || '',
      cancellationReason: cancellationReason,
    };

    let response;
    let apiErr = false;
    try {
      if (!zambdaIntakeClient) throw new Error('Zambda client not found');
      response = await cancelAppointment(zambdaIntakeClient, zambdaParams);
    } catch (error) {
      console.log(`Failed to cancel appointment: ${error}`);
      apiErr = true;
    } finally {
      if (response && !apiErr) {
        await getResourceBundle();
        handleClose();
        setError(false);
      } else {
        setError(true);
      }
      setCancelLoading(false);
    }
  };

  const handleChange = (event: SelectChangeEvent<typeof cancellationReason>): void => {
    const value = event.target.value as CancellationReasonOptions;
    value && setCancellationReason && setCancellationReason(value);
  };

  const handleDialogClose = (): void => {
    handleClose();
    setError(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '444px',
          maxWidth: 'initial',
        },
      }}
    >
      <form onSubmit={(e) => handleCancel(e)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Patient's cancelation reason
        </DialogTitle>
        <DialogContent>
          <div>
            <FormControl required sx={{ mt: 2, width: '100%' }}>
              <InputLabel id="select-label">Cancelation reason</InputLabel>
              <Select
                labelId="select-label"
                id="select"
                label="Cancelation reason"
                value={cancellationReason}
                onChange={handleChange}
                renderValue={(selected) => selected}
                MenuProps={MenuProps}
              >
                {Object.keys(CancellationReasonOptions).map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    <ListItemText primary={reason} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={cancelLoading}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
          >
            Cancel visit
          </LoadingButton>
          <Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Keep
          </Button>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error cancelling this appointment, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
}
