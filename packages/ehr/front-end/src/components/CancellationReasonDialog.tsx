import React, { ReactElement, useState } from 'react';
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
import { CancellationReasonOptions, CancellationReasonCodes } from '../types/types';
import useFhirClient from '../hooks/useFhirClient';
import { DateTime } from 'luxon';
import { Appointment, Encounter } from 'fhir/r4';
import { getPatchOperationsToUpdateVisitStatus } from '../helpers/visitMappingUtils';
import LoadingButton from '@mui/lab/LoadingButton';

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
  const fhirClient = useFhirClient();
  const [cancellationReason, setCancellationReason] = useState<CancellationReasonOptions | ''>('');
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
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
        'one of cancellationReason, encounter, encounter.id, or encounter.statusHistory is null or undefined',
      );
      return;
    }

    const status = 'CANCELLED';
    const statusOperations = getPatchOperationsToUpdateVisitStatus(appointment, status);
    await fhirClient?.patchResource({
      resourceType: 'Appointment',
      resourceId: appointment.id || '',
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
        {
          op: 'add',
          path: '/cancelationReason',
          value: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason',
                code: CancellationReasonCodes[cancellationReason],
                display: cancellationReason,
              },
            ],
          },
        },
        ...statusOperations,
      ],
    });

    const timeNow = DateTime.now().toISO();
    const lenStatusHistory = encounter.statusHistory.length;

    await fhirClient?.patchResource({
      resourceType: 'Encounter',
      resourceId: encounter.id,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
        {
          op: 'add',
          path: `/statusHistory/${lenStatusHistory - 1}`,
          value: {
            status: encounter.statusHistory[lenStatusHistory - 1].status,
            period: {
              end: timeNow,
            },
          },
        },
        {
          op: 'add',
          path: `/statusHistory/${lenStatusHistory}`,
          value: {
            status: 'cancelled',
            period: {
              start: timeNow,
            },
          },
        },
      ],
    });

    await getResourceBundle();
    setCancelLoading(false);
    handleClose();
  };

  const handleChange = (event: SelectChangeEvent<typeof cancellationReason>): void => {
    const value = event.target.value as CancellationReasonOptions;
    value && setCancellationReason && setCancellationReason(value);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
          Patient&apos;s cancelation reason
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
          <Button variant="text" onClick={handleClose} size="medium" sx={buttonSx}>
            Keep
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
