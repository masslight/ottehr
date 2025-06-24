import CheckIcon from '@mui/icons-material/Check';
import { Stack, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { otherColors } from '../IntakeThemeProvider';

interface CheckIconWithTextProps {
  children: ReactNode;
}

const CheckIconWithText: FC<CheckIconWithTextProps> = ({ children }) => {
  return (
    <Stack direction="row" spacing={2}>
      <CheckIcon sx={{ color: otherColors.checkIcon }} />
      <Typography variant="body2" color="secondary.main">
        {children}
      </Typography>
    </Stack>
  );
};
export default CheckIconWithText;
