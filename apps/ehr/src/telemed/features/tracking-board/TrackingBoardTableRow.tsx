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
import { FC, ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TelemedAppointmentInformation, TelemedAppointmentStatusEnum } from 'utils';
import { otherColors } from '../../../CustomThemeProvider';
import ChatModal from '../../../features/chat/ChatModal';
import { calculatePatientAge, formatDateUsingSlashes } from '../../../helpers/formatDateTime';
import { AppointmentStatusChip, StatusHistory } from '../../components';
import { quickTexts } from '../../utils';
import { TrackingBoardTableButton } from './TrackingBoardTableButton';

interface AppointmentTableProps {
  appointment: TelemedAppointmentInformation;
  showProvider: boolean;
  next?: boolean;
}

export function TrackingBoardTableRow({ appointment, showProvider, next }: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(appointment?.smsModel?.hasUnreadMessages || false);

  const patientName =
    [appointment?.patient?.lastName, appointment?.patient?.firstName].filter(Boolean).join(', ') || 'Unknown';

  const practitionerFamilyName = appointment?.practitioner?.name?.at(0)?.family;
  const displayedPractitionerName = practitionerFamilyName ? `Dr. ${practitionerFamilyName}` : '';

  const showChatIcon = appointment?.smsModel !== undefined;

  const patientInfo = useMemo((): React.ReactNode => {
    const dob = formatDateUsingSlashes(appointment?.patient?.dateOfBirth);
    const age = calculatePatientAge(appointment?.patient?.dateOfBirth);
    const sex = appointment?.patient?.sex?.replace?.(/^[a-z]/i, (str) => str.toUpperCase());
    const dobAge = dob && age && `DOB: ${dob} (${age})`;

    const parsedAnswers: { phone?: string; language?: string } = {};
    const isParentGuardian =
      appointment?.paperwork?.item?.find((item) => item.linkId === 'patient-filling-out-as')?.answer?.[0]
        .valueString === 'Parent/Guardian';
    const { phone, language } =
      appointment?.paperwork?.item?.reduce?.((acc, val) => {
        if (!val?.linkId || typeof val?.answer?.[0]?.valueString !== 'string') {
          return acc;
        }
        const { linkId } = val;
        const answer = val.answer?.[0]?.valueString;
        if (isParentGuardian && linkId === 'guardian-number') {
          acc.phone = answer as string;
        } else if (linkId === 'patient-number') {
          acc.phone = answer as string;
        }
        if (linkId === 'preferred-language' && (answer as string)?.toLowerCase?.() === 'spanish') {
          acc.language = 'Español';
        }
        return acc;
      }, parsedAnswers) ?? parsedAnswers;

    const baseInfo = [sex, dobAge, phone].filter(Boolean).join(' | ');

    return (
      <>
        <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
          {patientName}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {baseInfo}
        </Typography>
        {language && (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {language}
          </Typography>
        )}
      </>
    );
  }, [
    appointment?.paperwork?.item,
    appointment?.patient?.dateOfBirth,
    appointment?.patient?.sex,
    theme.palette.text.secondary,
    patientName,
  ]);

  const reasonForVisit = appointment?.reasonForVisit;

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
        {appointment.telemedStatus == TelemedAppointmentStatusEnum.cancelled ? (
          <Tooltip title={appointment.cancellationReason}>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                textOverflow: 'ellipsis',
                width: '80px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                pt: '6px',
              }}
            >
              {appointment.cancellationReason}
            </Typography>
          </Tooltip>
        ) : (
          <></>
        )}
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
      <TableCell sx={{ verticalAlign: 'top' }}>
        <StatusHistory history={appointment.telemedStatusHistory} currentStatus={appointment.telemedStatus} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography>{appointment.provider?.join(', ')}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography>{appointment.group?.join(', ')}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', cursor: 'pointer' }} onClick={goToAppointment}>
        {patientInfo}
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
      {showProvider && (
        <TableCell sx={{ verticalAlign: 'top' }}>
          <Box>{displayedPractitionerName}</Box>
        </TableCell>
      )}
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
          quickTexts={quickTexts}
        />
      )}
    </TableRow>
  );
}

export const TrackingBoardTableRowSkeleton: FC<{
  showProvider: boolean;
  isState: boolean;
}> = ({ showProvider, isState }) => {
  const theme = useTheme();

  return (
    <>
      {!isState && (
        <TableRow>
          <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={7 + +showProvider}>
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
              <AppointmentStatusChip status={TelemedAppointmentStatusEnum.ready} />
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
