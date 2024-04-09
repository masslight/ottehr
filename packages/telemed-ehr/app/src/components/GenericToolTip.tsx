import { ReactElement } from 'react';
import { Box, styled, Tooltip, tooltipClasses, TooltipProps, Typography } from '@mui/material';
import { otherColors } from '../CustomThemeProvider';
import { AppointmentInformation } from '../types/types';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';

export const GenericToolTip = styled(
  ({ className, customWidth, ...props }: TooltipProps & { customWidth?: number | string }) => (
    <Tooltip
      enterTouchDelay={0}
      placement="top-end"
      {...props}
      classes={{ popper: className }}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: customWidth || 150,
            backgroundColor: '#F9FAFB',
            color: '#000000',
            border: '1px solid #dadde9',
          },
        },
      }}
    />
  ),
)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    boxShadow: theme.shadows[1],
    fontSize: theme.typography.pxToRem(12),
  },
}));

export const PaperworkToolTipContent = ({ appointment }: { appointment: AppointmentInformation }): ReactElement => (
  <Box
    sx={{
      margin: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}
  >
    <Box sx={{ display: 'flex', gap: 1 }}>
      <AccountCircleOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></AccountCircleOutlinedIcon>
      <Typography>Demographics</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <HealthAndSafetyOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></HealthAndSafetyOutlinedIcon>
      <Typography>INS Card</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <BadgeOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></BadgeOutlinedIcon>
      <Typography>ID</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <AssignmentTurnedInOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></AssignmentTurnedInOutlinedIcon>
      <Typography>Consent</Typography>
    </Box>
  </Box>
);
