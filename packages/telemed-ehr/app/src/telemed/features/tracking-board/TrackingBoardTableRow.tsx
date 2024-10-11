import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  IconButton,
  Skeleton,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DateTime, Duration } from 'luxon';
import { FC, ReactElement, useMemo, useState } from 'react';
import { ApptStatus, TelemedAppointmentInformation } from 'ehr-utils';
import { otherColors } from '../../../CustomThemeProvider';
import ChatModal from '../../../features/chat/ChatModal';
import { calculatePatientAge, formatDateUsingSlashes } from '../../../helpers/formatDateTime';
import { AppointmentStatusChip, StatusHistory } from '../../components';
import { TrackingBoardTableButton } from './TrackingBoardTableButton';

interface AppointmentTableProps {
  appointment: TelemedAppointmentInformation;
  showEstimated: boolean;
  showProvider: boolean;
  next?: boolean;
}

export function TrackingBoardTableRow({
  appointment,
  showEstimated,
  showProvider,
  next,
}: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(appointment.smsModel?.hasUnreadMessages || false);

  const patientName = `${appointment.patient.lastName}, ${appointment.patient.firstName}` || 'Unknown';
  const showChatIcon = appointment.smsModel !== undefined;

  const patientInfo = useMemo((): string => {
    const dob = formatDateUsingSlashes(appointment.patient?.dateOfBirth);
    const age = calculatePatientAge(appointment.patient?.dateOfBirth);
    const sex = appointment?.paperwork?.item?.find((item) => item.linkId === 'patient-birth-sex')?.answer?.[0]
      .valueString;
    const number = appointment?.paperwork?.item?.find((item) => item.linkId === 'guardian-number')?.answer?.[0]
      .valueString;

    const dobAge = dob && age && `${dob} ${age}`;

    return [sex, dobAge, number].filter((item) => !!item).join(' | ');
  }, [appointment?.paperwork?.item, appointment.patient?.dateOfBirth]);

  const reasonForVisit = useMemo((): string => {
    const reasonForVisit = appointment?.paperwork?.item
      ?.find((item) => item.linkId === 'reason-for-visit')
      ?.answer?.[0].valueString?.split(',')
      ?.join(', ');
    const additionalInformation = appointment?.paperwork?.item?.find((item) => item.linkId === 'additional-information')
      ?.answer?.[0].valueString;

    return reasonForVisit
      ? additionalInformation
        ? `${reasonForVisit} (${additionalInformation})`
        : reasonForVisit
      : '';
  }, [appointment?.paperwork?.item]);

  const goToAppointment = (): void => {
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
        ...(next && { boxShadow: `inset 0 0 0 1px ${otherColors.orange800}` }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        {next && (
          <Box
            sx={{
              backgroundColor: otherColors.orange800,
              position: 'absolute',
              width: '14px',
              bottom: 0,
              left: '-14px',
              height: '100%',
              borderTopLeftRadius: '10px',
              borderBottomLeftRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="subtitle2"
              fontSize={10}
              sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                color: theme.palette.common.white,
              }}
            >
              NEXT
            </Typography>
          </Box>
        )}
        <AppointmentStatusChip status={appointment.telemedStatus} />
        <Tooltip title={appointment.id}>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
              textOverflow: 'ellipsis',
              width: '80px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              pt: '6px',
            }}
          >
            ID: {appointment.id}
          </Typography>
        </Tooltip>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        <Typography>{DateTime.fromISO(appointment.start || '').toLocaleString(DateTime.DATETIME_SHORT)}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <StatusHistory history={appointment.telemedStatusHistory} currentStatus={appointment.telemedStatus} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography>{appointment.provider?.join(', ')}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography>{appointment.group?.join(', ')}</Typography>
      </TableCell>
      {showEstimated && (
        <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
          <Typography>
            {appointment.estimated ? Duration.fromMillis(appointment.estimated).toFormat("mm'm'") : '...m'}
          </Typography>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
          {patientName}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {patientInfo}
        </Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        <Typography sx={{ fontSize: '16px' }}>{appointment.location.state}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        <Tooltip title={reasonForVisit}>
          <Typography
            variant="body2"
            sx={{
              fontSize: '16px',
              textOverflow: 'ellipsis',
              width: '160px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {reasonForVisit}
          </Typography>
        </Tooltip>
      </TableCell>

      <TableCell sx={{ verticalAlign: 'top' }}>
        {showChatIcon && (
          <IconButton
            color="primary"
            sx={{
              backgroundColor: theme.palette.primary.main,
              width: '36px',
              height: '36px',
              borderRadius: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
            onClick={(_event) => {
              setChatModalOpen(true);
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
        <TrackingBoardTableButton appointment={appointment} />
      </TableCell>
      {chatModalOpen && (
        <ChatModal
          appointment={appointment}
          onClose={() => setChatModalOpen(false)}
          onMarkAllRead={() => setHasUnread(false)}
        />
      )}
    </TableRow>
  );
}

export const TrackingBoardTableRowSkeleton: FC<{
  showEstimated: boolean;
  showProvider: boolean;
  isState: boolean;
}> = ({ showEstimated, showProvider, isState }) => {
  const theme = useTheme();

  return (
    <>
      {!isState && (
        <TableRow>
          <TableCell
            sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }}
            colSpan={7 + +showEstimated + +showProvider}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Skeleton>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  ST - State name
                </Typography>
              </Skeleton>
            </Box>
          </TableCell>
        </TableRow>
      )}
      {[...Array(3)].map((_row, index) => (
        <TableRow key={index} sx={{}}>
          <TableCell>
            <Skeleton variant="rounded">
              <AppointmentStatusChip status={ApptStatus.ready} />
            </Skeleton>
            <Skeleton width="100%">
              <Typography
                variant="body2"
                sx={{
                  pt: '6px',
                }}
              >
                ID: some ID
              </Typography>
            </Skeleton>
          </TableCell>
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton width="100%">
              <Typography>time</Typography>
            </Skeleton>
          </TableCell>
          {showEstimated && (
            <TableCell sx={{ verticalAlign: 'top' }}>
              <Skeleton width="100%">
                <Typography>time</Typography>
              </Skeleton>
            </TableCell>
          )}
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton>
              <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
                Patient name
              </Typography>
            </Skeleton>
            <Skeleton width="100%">
              <Typography variant="body2">Lots of patient info</Typography>
            </Skeleton>
          </TableCell>
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton>
              <Typography sx={{ fontSize: '16px' }}>ST</Typography>
            </Skeleton>
          </TableCell>
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton width="100%">
              <Typography sx={{ fontSize: '16px' }}>Reason for visit</Typography>
            </Skeleton>
          </TableCell>
          {showProvider && (
            <TableCell sx={{ verticalAlign: 'top' }}>
              <Skeleton width="100%">
                <Typography>Dr. Name</Typography>
              </Skeleton>
            </TableCell>
          )}
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton variant="circular">
              <IconButton
                sx={{
                  width: '36px',
                  height: '36px',
                }}
              />
            </Skeleton>
          </TableCell>
          <TableCell sx={{ verticalAlign: 'top' }}>
            <Skeleton variant="rounded">
              <LoadingButton
                variant="contained"
                sx={{
                  fontSize: '15px',
                  fontWeight: '700',
                }}
              >
                text
              </LoadingButton>
            </Skeleton>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};
