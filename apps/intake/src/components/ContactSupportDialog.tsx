import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSupportDisplayGroups, getSupportPhoneFor } from 'utils';
import { CustomDialog } from './CustomDialog';
import PageForm from './PageForm';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  const supportGroups = getSupportDisplayGroups();
  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Need help?
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {supportGroups.map((group) => (
          <Box key={group.hours} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {group.locations.map((location) => (
              <Typography key={location} variant="body2">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {location}:
                </Box>{' '}
                {getSupportPhoneFor(location)}
              </Typography>
            ))}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {group.hours}
            </Typography>
          </Box>
        ))}

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
