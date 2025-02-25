import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import React, { Dispatch, MouseEventHandler, ReactElement, SetStateAction, useState } from 'react';
import { otherColors } from '../../CustomThemeProvider';

interface ScheduleOverridesDialogProps {
  item: Location | Practitioner | HealthcareService;
  setItem: React.Dispatch<React.SetStateAction<Location | Practitioner | HealthcareService | undefined>>;
  handleClose: MouseEventHandler<HTMLButtonElement>;
  open: boolean;
  setIsScheduleOverridesDialogOpen: Dispatch<SetStateAction<boolean>>;
  updateItem: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export default function ScheduleOverridesDialog({
  handleClose,
  open,
  updateItem,
  setIsScheduleOverridesDialogOpen,
}: ScheduleOverridesDialogProps): ReactElement {
  const buttonSx = {
    fontWeight: '700',
    textTransform: 'none',
    borderRadius: 6,
  };

  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '35%',
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%', fontWeight: 600 }}>
        Schedule change may affect visits
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          sx={{
            color: theme.palette.text.primary,
          }}
        >
          Your changes will be applied immediately after confirmation. Please make sure that no previously booked visits
          are affected by this schedule change.
        </DialogContentText>
        <Box
          sx={{
            marginTop: 1,
            padding: 1,
            background: otherColors.dialogNote,
            borderRadius: '4px',
          }}
          display="flex"
        >
          <WarningAmberIcon sx={{ marginTop: 1, color: otherColors.warningIcon }} />
          <Typography variant="body2" color="#212130" sx={{ m: 1.25 }}>
            If there are conflicts in booked visits and new schedule, please contact patients to move their visits.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start' }}>
        <form
          onSubmit={async (event) => {
            setLoading(true);
            await updateItem(event);
            setIsScheduleOverridesDialogOpen(false);
            setLoading(false);
          }}
        >
          <LoadingButton
            loading={loading}
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
            type="submit"
          >
            Confirm schedule change
          </LoadingButton>
          <Button variant="text" onClick={handleClose} size="medium" sx={buttonSx}>
            Cancel
          </Button>
        </form>
      </DialogActions>
    </Dialog>
  );
}
