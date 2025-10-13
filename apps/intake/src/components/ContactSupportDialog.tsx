import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getLocationNames, getSupportPhoneFor } from 'utils/lib/configuration/branding';
import { CustomDialog } from './CustomDialog';
import PageForm from './PageForm';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  const locationNames = getLocationNames();
  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Need help?
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {locationNames.length > 0 ? (
          locationNames.map((locationName) => (
            <Typography key={locationName} variant="body2" sx={{ fontWeight: 700 }}>
              {locationName}: {getSupportPhoneFor(locationName)}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" sx={{ mb: -1.5 }}>
            Call us: <span style={{ fontWeight: 700 }}>{getSupportPhoneFor()}</span>
          </Typography>
        )}

        <Typography variant="body2">Sunday-Saturday 10am-10pm ET.</Typography>
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
