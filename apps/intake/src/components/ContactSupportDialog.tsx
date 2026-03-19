import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSupportDialog } from 'utils';
import { CustomDialog } from './CustomDialog';
import PageForm from './PageForm';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  const supportDialog = getSupportDialog();

  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {supportDialog.title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {supportDialog.sections.map((section, index) => (
            <Box key={`support-section-${index}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {section.rows.map((row, rowIndex) => (
                <Typography
                  key={`support-row-${index}-${rowIndex}-${row.label ?? row.value}`}
                  variant="body2"
                  sx={row.emphasized ? { fontWeight: 700 } : undefined}
                >
                  {row.label ? (
                    <>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {row.label}:
                      </Box>{' '}
                      {row.value}
                    </>
                  ) : (
                    row.value
                  )}
                </Typography>
              ))}
            </Box>
          ))}
        </Box>

        <Typography variant="body2">{supportDialog.emergencyNotice}</Typography>
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
