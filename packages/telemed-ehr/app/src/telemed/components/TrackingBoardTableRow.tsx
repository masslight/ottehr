import { Badge, Box, IconButton, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { ReactElement } from 'react';
import { otherColors } from '../../CustomThemeProvider';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import { LoadingButton } from '@mui/lab';
import { formatDateUsingSlashes } from '../../helpers/formatDateTime';
import { ApptStatus } from '../utils';
import { useNavigate } from 'react-router-dom';
import { AppointmentStatusChip } from './AppointmentStatusChip';
import { useTrackingBoardStore } from '../state';
import { getSelectors } from '../../shared/store/getSelectors';
import { StatusHistory } from './StatusHistory';
import { TelemedAppointmentInformation } from 'ehr-utils';
import { Duration } from 'luxon';

interface AppointmentTableProps {
  appointment: TelemedAppointmentInformation;
  showEstimated: boolean;
  showProvider: boolean;
}

export default function TrackingBoardTableRow({
  appointment,
  showEstimated,
  showProvider,
}: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const { availableStates } = getSelectors(useTrackingBoardStore, ['availableStates']);
  const navigate = useNavigate();

  const patientName = `${appointment.patient.lastName}, ${appointment.patient.firstName}` || 'Unknown';
  const hasUnread = false;
  const showChatIcon = true;

  const chooseActionButtonText = (): string => {
    if (!appointment.location.state || !availableStates.includes(appointment.location.state)) {
      return 'View';
    }
    switch (appointment.telemedStatus) {
      case ApptStatus.ready:
        return 'Take';
      case ApptStatus['pre-video']:
      case ApptStatus['on-video']:
        return 'Open';
      case ApptStatus.unsigned:
        return 'Sign';
      default:
        return 'View';
    }
  };

  const onClick = (): void => {
    navigate(`/telemed/appointments/${appointment.id}`);
  };

  return (
    <TableRow
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '&:hover': {
          backgroundColor: otherColors.apptHover,
        },
        position: 'relative',
      }}
    >
      <TableCell sx={{ verticalAlign: 'top' }}>
        <AppointmentStatusChip status={appointment.telemedStatus} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <StatusHistory history={appointment.telemedStatusHistory} currentStatus={appointment.telemedStatus} />
      </TableCell>
      {showEstimated && (
        <TableCell sx={{ verticalAlign: 'top' }}>
          <Typography>
            {appointment.estimated ? Duration.fromMillis(appointment.estimated).toFormat("mm'm'") : '...m'}
          </Typography>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
          {patientName}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          DOB: {formatDateUsingSlashes(appointment.patient?.dateOfBirth)}
        </Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography sx={{ fontSize: '16px' }}>{(appointment.reasonForVisit || '').split(',').join(', ')}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography sx={{ fontSize: '16px' }}>{appointment.location.state}</Typography>
      </TableCell>
      {showProvider && (
        <TableCell sx={{ verticalAlign: 'top' }}>
          <Box>Dr. Smith</Box>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'top' }}>
        {showChatIcon && (
          <IconButton
            sx={{
              backgroundColor: theme.palette.primary.main,
              width: '36px',
              height: '36px',
              borderRadius: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'}
          >
            {/* todo reduce code duplication */}
            {hasUnread ? (
              <Badge
                variant="dot"
                color="warning"
                sx={{
                  '& .MuiBadge-badge': {
                    width: '14px',
                    height: '14px',
                    borderRadius: '10px',
                    border: '2px solid white',
                    top: '-4px',
                    right: '-4px',
                  },
                }}
              >
                <ChatOutlineIcon
                  sx={{
                    color: theme.palette.primary.contrastText,
                    height: '20px',
                    width: '20px',
                  }}
                ></ChatOutlineIcon>
              </Badge>
            ) : (
              <ChatOutlineIcon
                sx={{
                  color: theme.palette.primary.contrastText,
                  height: '20px',
                  width: '20px',
                }}
              ></ChatOutlineIcon>
            )}
          </IconButton>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <LoadingButton
          onClick={onClick}
          variant="contained"
          sx={{
            borderRadius: 8,
            textTransform: 'none',
            fontSize: '15px',
            fontWeight: '700',
          }}
        >
          {chooseActionButtonText()}
        </LoadingButton>
      </TableCell>
    </TableRow>
  );
}
