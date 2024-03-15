import { Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog, PageForm } from 'ottehr-components';

type ManageParticipantsDialogProps = {
  onClose: () => void;
};

export const ManageParticipantsDialog: FC<ManageParticipantsDialogProps> = ({ onClose }) => {
  const handleClose = (): void => {
    onClose();
  };

  return (
    <CustomDialog open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        Another call participant
      </Typography>
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: 'First name',
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: 'Last name',
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'phoneNumber',
            label: 'Phone number',
            format: 'Phone Number',
            required: true,
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email',
            format: 'Email',
            required: true,
          },
        ]}
        controlButtons={{
          submitLabel: 'Send invite',
          backButtonLabel: 'Close',
        }}
      />
    </CustomDialog>
  );
};
