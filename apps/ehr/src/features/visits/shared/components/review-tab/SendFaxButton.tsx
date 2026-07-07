import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { FC, useState } from 'react';
import { SendFaxDialog } from 'src/components/dialogs/SendFaxDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useAppointmentData } from '../../stores/appointment/appointment.store';

export const SendFaxButton: FC = () => {
  const { appointment, patient } = useAppointmentData();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <RoundedButton
        disabled={!appointment?.id}
        variant="outlined"
        onClick={() => setDialogOpen(true)}
        startIcon={<FaxOutlinedIcon color="inherit" />}
        data-testid={dataTestIds.progressNotePage.sendFaxButton}
      >
        Send Fax
      </RoundedButton>
      {dialogOpen && (
        <SendFaxDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          patient={patient}
          appointmentId={appointment?.id}
        />
      )}
    </>
  );
};
