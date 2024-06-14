import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog, PageForm } from 'ottehr-components';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Need help?
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          {/* Remember to replace placeholder number */}
          Call us: <span style={{ fontWeight: 700 }}>1-234-567-8900</span>
        </Typography>
        <Typography variant="body2" sx={{ mt: -1.5 }}>
          Sunday-Saturday 10am-10pm ET.
        </Typography>
        <Typography variant="body2">
          For wait times or more information:&nbsp;
          <Link href="https://ottehr.com" target="_blank">
            Click Here
          </Link>
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
