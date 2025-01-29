import { Box, useTheme } from '@mui/system';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DoneIcon from '@mui/icons-material/Done';
import { ReactElement } from 'react';
import { otherColors } from '@theme/colors';
import { GenericToolTip } from './GenericToolTip';

export const IntakeCheckmark = ({ providerName }: { providerName: string }): ReactElement => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <DoneIcon sx={{ fill: otherColors.green700 }} />
      <GenericToolTip title={`Screening completed by ${providerName}`} placement="top">
        <InfoOutlinedIcon fontSize="small" sx={{ fill: theme.palette.text.secondary }} />
      </GenericToolTip>
    </Box>
  );
};
