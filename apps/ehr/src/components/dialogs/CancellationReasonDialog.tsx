import {
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { Appointment, Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useState } from 'react';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { CancelAppointmentZambdaInput } from 'utils/lib/types/api/cancel-appointment.types';
import { cancelAppointment } from '../../api/api';
import { dataTestIds } from '../../constants/data-test-ids';
import { useApiClients } from '../../hooks/useAppClients';
import { AppDialog } from './AppDialog';

interface CancellationReasonDialogProps {
  handleClose: () => void;
  refetchData: () => Promise<void>;
  appointment: Appointment;
  encounter: Encounter;
  open: boolean;
  getAndSetResources: ({ logs, notes }: { logs?: boolean; notes?: boolean }) => Promise<void>;
}

export default function CancellationReasonDialog({
  handleClose,
  refetchData,
  appointment,
  encounter,
  open,
  getAndSetResources,
}: CancellationReasonDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancellationReasonAdditional, setCancellationReasonAdditional] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
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

  const cancelOptions = isTelemedAppointment(appointment)
    ? VALUE_SETS.cancelReasonOptionsVirtualProvider
    : VALUE_SETS.cancelReasonOptionsInPersonProvider;

  const handleCancel = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCancelLoading(true);
    if (!(cancellationReason && encounter && encounter.id && encounter.statusHistory)) {
      console.error(
        'one of cancellationReason, encounter, encounter.id, or encounter.statusHistory is null or undefined'
      );
      return;
    }

    const zambdaParams: CancelAppointmentZambdaInput = {
      appointmentID: appointment.id || '',
      cancellationReason: cancellationReason,
      cancellationReasonAdditional: cancellationReason === 'Other' ? cancellationReasonAdditional : undefined,
    };

    let response;
    let apiErr = false;
    try {
      if (!oystehrZambda) throw new Error('Zambda client not found');
      response = await cancelAppointment(oystehrZambda, zambdaParams);
    } catch (error) {
      console.log(`Failed to cancel appointment: ${error}`);
      apiErr = true;
    } finally {
      if (response && !apiErr) {
        await refetchData();
        try {
          await getAndSetResources({ logs: true });
        } catch (error) {
          console.log('error getting activity logs after cancellation', error);
          enqueueSnackbar('An error getting updated activity logs. Please try refreshing the page.', {
            variant: 'error',
          });
        }
        handleClose();
        setError(false);
      } else {
        setError(true);
      }
      setCancelLoading(false);
    }
  };

  const handleChange = (event: SelectChangeEvent<typeof cancellationReason>): void => {
    const value = event.target.value as string;
    if (value && setCancellationReason) {
      setCancellationReason(value);
    }
    if (value !== 'Other') {
      setCancellationReasonAdditional('');
    }
  };

  const handleDialogClose = (): void => {
    handleClose();
    setError(false);
  };

  return (
    <AppDialog
      variant="form"
      size="s"
      open={open}
      onClose={handleDialogClose}
      title="Patient's Cancelation Reason"
      onSubmit={(e) => void handleCancel(e)}
      primary={{
        label: 'Cancel Visit',
        loading: cancelLoading,
        disabled: !cancellationReason,
        'data-testid': dataTestIds.visitDetailsPage.cancelVisitDialogue,
      }}
      dismiss={{ label: 'Keep' }}
    >
      <div>
        <FormControl required sx={{ mt: 2, width: '100%' }}>
          <InputLabel id="select-label">Cancelation reason</InputLabel>
          <Select
            data-testid={dataTestIds.visitDetailsPage.cancelationReasonDropdown}
            labelId="select-label"
            id="select"
            label="Cancelation reason"
            value={cancellationReason}
            onChange={handleChange}
            renderValue={(selected) => selected}
            MenuProps={MenuProps}
          >
            {cancelOptions.map((reason) => (
              <MenuItem key={reason.value} value={reason.value}>
                <ListItemText primary={reason.label} />
              </MenuItem>
            ))}
          </Select>
          {cancellationReason === 'Other' && (
            <TextField
              fullWidth
              sx={{ mt: 2 }}
              label="Please specify"
              value={cancellationReasonAdditional}
              onChange={(e) => setCancellationReasonAdditional(e.target.value)}
              inputProps={{ maxLength: 200 }}
            />
          )}
        </FormControl>
      </div>
      {error && (
        <Typography color="error" variant="body2" mt={2}>
          There was an error cancelling this appointment, please try again.
        </Typography>
      )}
    </AppDialog>
  );
}
