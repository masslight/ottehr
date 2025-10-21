import { otherColors } from '@ehrTheme/colors';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC } from 'react';

export const WarningBanner: FC<{
  otherPatientsWithSameName: boolean;
  onClose: () => void;
}> = ({ otherPatientsWithSameName, onClose }) => {
  if (!otherPatientsWithSameName) return null;

  return (
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
      <Typography variant="body2" color={otherColors.closeCross} sx={{ m: 1.25, maxWidth: 850, fontWeight: 500 }}>
        There are other patients with this name in our database. Please confirm by the DOB that you are viewing the
        right patient.
      </Typography>
      <CloseIcon
        onClick={onClose}
        sx={{ marginLeft: 'auto', marginRight: 0, marginTop: 1, color: otherColors.closeCross }}
      />
    </Box>
  );
};
