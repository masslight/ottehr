import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, ClickAwayListener, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useReducer } from 'react';
import { TelemedAppointmentStatusEnum, TelemedStatusHistoryElement } from 'utils';
import { diffInMinutes, getAppointmentWaitingTime } from '../utils';
import { AppointmentStatusChip } from './AppointmentStatusChip';
import { CustomTooltip } from './CustomTooltip';

type StatusHistoryTooltipProps = {
  history: TelemedStatusHistoryElement[];
  currentStatus: keyof typeof TelemedAppointmentStatusEnum;
};

const initialTooltipState: { visible: false } | { triggeredBy: 'click' | 'hover'; visible: true } = {
  visible: false,
};

function tooltipReducer(
  state: typeof initialTooltipState,
  action: 'OPEN_ON_CLICK' | 'CLOSE_ON_CLICK' | 'OPEN_ON_HOVER' | 'CLOSE_ON_LEAVE'
): typeof initialTooltipState {
  switch (action) {
    case 'OPEN_ON_CLICK':
      return state.visible === false || state.triggeredBy !== 'click' ? { visible: true, triggeredBy: 'click' } : state;
    case 'OPEN_ON_HOVER':
      return state.visible === false ? { visible: true, triggeredBy: 'hover' } : state;
    case 'CLOSE_ON_CLICK':
      return state.visible === true ? { visible: false } : state;
    case 'CLOSE_ON_LEAVE':
      return state.visible === true && state.triggeredBy === 'hover' ? { visible: false } : state;
    default:
      return state;
  }
}

export const StatusHistory: FC<StatusHistoryTooltipProps> = (props) => {
  const { history, currentStatus } = props;
  const theme = useTheme();

  const [tooltipState, updateTooltip] = useReducer(tooltipReducer, initialTooltipState);
  const closeTooltipOnClick = (): void => updateTooltip('CLOSE_ON_CLICK');
  const closeTooltipOnLeave = (): void => updateTooltip('CLOSE_ON_LEAVE');
  const openTooltipOnClick = (): void => updateTooltip('OPEN_ON_CLICK');
  const openTooltipOnHover = (): void => updateTooltip('OPEN_ON_HOVER');

  const currentTimeISO = new Date().toISOString();

  return (
    <ClickAwayListener onClickAway={closeTooltipOnClick}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        onMouseEnter={openTooltipOnHover}
        onMouseLeave={closeTooltipOnLeave}
      >
        <StatusHistoryTimeCounter
          history={history}
          currentAppointmentStatus={currentStatus}
          currentTimeISO={currentTimeISO}
        />
        <div>
          <CustomTooltip
            PopperProps={{
              disablePortal: true,
            }}
            onClose={closeTooltipOnClick}
            open={tooltipState.visible}
            disableFocusListener
            disableHoverListener
            disableTouchListener
            title={
              <TooltipContent
                history={history}
                currentAppointmentStatus={currentStatus}
                currentTimeISO={currentTimeISO}
              />
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlinedIcon
                onClick={openTooltipOnClick}
                fontSize="small"
                sx={{ color: theme.palette.text.secondary, cursor: 'pointer' }}
              />
            </Box>
          </CustomTooltip>
        </div>
      </Box>
    </ClickAwayListener>
  );
};

const StatusHistoryTimeCounter: FC<{
  history: TelemedStatusHistoryElement[];
  currentAppointmentStatus: keyof typeof TelemedAppointmentStatusEnum;
  currentTimeISO: string;
}> = (props) => {
  const { history, currentAppointmentStatus, currentTimeISO } = props;

  const totalTime = getTotalAppointmentTime(history, currentAppointmentStatus, currentTimeISO);

  const appointmentStatus = TelemedAppointmentStatusEnum[currentAppointmentStatus];
  const isStatusReady = appointmentStatus === TelemedAppointmentStatusEnum.ready;
  const isStatusComplete = appointmentStatus === TelemedAppointmentStatusEnum.complete;
  const isStatusCanceled = appointmentStatus === TelemedAppointmentStatusEnum.cancelled;

  if (isStatusReady || isStatusComplete) {
    return <Typography>{`${getAppointmentWaitingTime(history)} m`}</Typography>;
  }

  if (isStatusCanceled) {
    return <Typography>{`${totalTime} m`}</Typography>;
  }

  const lastHistoryRecord = history.at(-1);
  return (
    <Typography>
      <>
        {diffInMinutes(
          DateTime.fromISO(lastHistoryRecord?.end || currentTimeISO),
          DateTime.fromISO(lastHistoryRecord?.start || currentTimeISO)
        )}
        m / {totalTime}m
      </>
    </Typography>
  );
};

const TooltipContent: FC<{
  history: TelemedStatusHistoryElement[];
  currentAppointmentStatus: keyof typeof TelemedAppointmentStatusEnum;
  currentTimeISO: string;
}> = (props) => {
  const { history, currentAppointmentStatus, currentTimeISO } = props;

  const appointmentStatus = TelemedAppointmentStatusEnum[currentAppointmentStatus];
  const isStatusReady = appointmentStatus === TelemedAppointmentStatusEnum.ready;
  // const isStatusComplete = appointmentStatus === TelemedAppointmentStatusEnum.complete;
  // const isStatusCanceled = appointmentStatus === TelemedAppointmentStatusEnum.cancelled;

  const appointmentTotalTime = getTotalAppointmentTime(history, currentAppointmentStatus, currentTimeISO);
  const totalTime = isStatusReady ? getAppointmentWaitingTime(history) : appointmentTotalTime;

  const composeHistoryElementText = (historyElement: TelemedStatusHistoryElement): string => {
    const isCanceledEntry = historyElement.status === TelemedAppointmentStatusEnum.cancelled;
    const isCompletedEntry = historyElement.status === TelemedAppointmentStatusEnum.complete;

    if (isCanceledEntry || isCompletedEntry) {
      return '';
    }

    const historyElementStartTime = historyElement.start;
    if (!historyElementStartTime) {
      return '';
    }

    return `${diffInMinutes(
      DateTime.fromISO(historyElement.end || currentTimeISO),
      DateTime.fromISO(historyElementStartTime)
    )} mins`;
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {history.map((element, index) => (
        <Box sx={{ display: 'flex', gap: 1 }} key={`${element.status}-${index}`}>
          <Typography sx={{ minWidth: '60px' }}>{composeHistoryElementText(element)}</Typography>
          <AppointmentStatusChip status={element.status} />
        </Box>
      ))}
      <Typography sx={{ fontWeight: 500, mt: 1 }}>Total: {totalTime} mins</Typography>
    </Box>
  );
};

const getTotalAppointmentTime = (
  history: TelemedStatusHistoryElement[],
  appointmentStatus: keyof typeof TelemedAppointmentStatusEnum,
  currentTimeISO: string
): number => {
  const firstHistoryRecord = history.at(0);
  const lastHistoryRecord = history.at(-1);

  const firstRecordStartTime = firstHistoryRecord?.start;
  if (!firstRecordStartTime) {
    return 0;
  }

  const historyStartTime = DateTime.fromISO(firstRecordStartTime);
  const currentTime = DateTime.fromISO(currentTimeISO);

  if (appointmentStatus === TelemedAppointmentStatusEnum.complete) {
    const onVideoHistoryRecord = history.find((element) => element.status === TelemedAppointmentStatusEnum['on-video']);
    const videoEndTime = onVideoHistoryRecord?.end;
    return videoEndTime ? diffInMinutes(DateTime.fromISO(videoEndTime), historyStartTime) : 0;
  }

  if (appointmentStatus === TelemedAppointmentStatusEnum.cancelled) {
    const lastRecordStartTime = lastHistoryRecord?.start;
    return lastRecordStartTime ? diffInMinutes(DateTime.fromISO(lastRecordStartTime), historyStartTime) : 0;
  }

  return diffInMinutes(currentTime, historyStartTime);
};
