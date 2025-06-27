import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog } from './CustomDialog';
import PageForm from './PageForm';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Need help?
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          Call us: <span style={{ fontWeight: 700 }}>(202) 555-1212</span>
        </Typography>
        <Typography variant="body2" sx={{ mt: -1.5 }}>
          Sunday-Saturday 10am-10pm ET.
        </Typography>
        <Typography variant="body2">If this is an emergency, please call 911.</Typography>
      </Box>
      <PageForm
        onSubmit={onClose}
        controlButtons={{
          submitLabel: 'Ok',
          backButton: false,
        }}
      />
    </CustomDialog>
  );
};
