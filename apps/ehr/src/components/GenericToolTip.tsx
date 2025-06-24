import { otherColors } from '@ehrTheme/colors';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import { Box, styled, Tooltip, tooltipClasses, TooltipProps, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { InPersonAppointmentInformation } from 'utils';

export const GenericToolTip = styled(
  ({ className, customWidth, ...props }: TooltipProps & { customWidth?: number | string }) => (
    <Tooltip
      enterTouchDelay={0}
      placement="top-end"
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
      {...props}
    />
  )
)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    boxShadow: theme.shadows[1],
    fontSize: theme.typography.pxToRem(12),
  },
}));

export const PaperworkToolTipContent = ({
  appointment,
}: {
  appointment: InPersonAppointmentInformation;
}): ReactElement => (
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
      <Typography sx={!appointment.paperwork.demographics ? { color: '#78909C' } : {}}>Demographics</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <HealthAndSafetyOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></HealthAndSafetyOutlinedIcon>
      <Typography sx={!appointment.paperwork.insuranceCard ? { color: '#78909C' } : {}}>INS Card</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <BadgeOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></BadgeOutlinedIcon>
      <Typography sx={!appointment.paperwork.photoID ? { color: '#78909C' } : {}}>ID</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <AssignmentTurnedInOutlinedIcon
        sx={{ marginRight: 0.75, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
        fill={otherColors.cardChip}
      ></AssignmentTurnedInOutlinedIcon>
      <Typography sx={!appointment.paperwork.consent ? { color: '#78909C' } : {}}>Consent</Typography>
    </Box>
  </Box>
);
