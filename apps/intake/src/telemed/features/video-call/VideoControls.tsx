import { FC, useState } from 'react';
import { Alert, AlertColor, Box, Snackbar } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { useLocalVideo, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { CallSettings, IconButtonContained, CallSettingsTooltip } from '../../components';
import { otherColors } from '../../../IntakeThemeProvider';
import { ConfirmEndCallDialog } from '.';
import ReportIssueDialog from '../../components/ReportIssueDialog';
import { getSelectors } from 'utils';
import { useAppointmentStore } from '../appointments';
import { usePatientInfoStore } from '../patient-info';
import { useWaitingRoomStore } from '../waiting-room';
import { useApiClients } from '../../hooks/useAppClients';

export const VideoControls: FC = () => {
  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const { muted, toggleMute } = useToggleLocalMute();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const { oystehr } = useApiClients();

  const { patientInfo } = usePatientInfoStore.getState();

  const [toastMessage, setToastMessage] = useState<string | undefined>(undefined);
  const [toastType, setToastType] = useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  const encounterId = useWaitingRoomStore((state) => state.encounterId);

  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);

  const handleTooltipClose = (): void => {
    setIsTooltipOpen(false);
  };

  const handleTooltipOpen = (): void => {
    setIsTooltipOpen(true);
  };

  const handleReportDialogOpen = (): void => {
    setIsReportDialogOpen(true);
  };

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const handleModalOpen = (): void => {
    setIsModalOpen(true);
  };

  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: otherColors.darkPurple,
          display: 'flex',
          gap: 3,
          justifyContent: 'center',
          py: 2,
        }}
      >
        <IconButtonContained onClick={toggleVideo} variant={isVideoEnabled ? undefined : 'disabled'}>
          {isVideoEnabled ? (
            <VideocamIcon sx={{ color: otherColors.white }} />
          ) : (
            <VideocamOffIcon sx={{ color: otherColors.darkPurple }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMute} variant={!muted ? undefined : 'disabled'}>
          {!muted ? (
            <MicIcon sx={{ color: otherColors.white }} />
          ) : (
            <MicOffIcon sx={{ color: otherColors.darkPurple }} />
          )}
        </IconButtonContained>
        <CallSettingsTooltip
          isTooltipOpen={isTooltipOpen}
          handleTooltipOpen={handleTooltipOpen}
          handleTooltipClose={handleTooltipClose}
          openSettings={openSettings}
          handleReportDialogOpen={handleReportDialogOpen}
        />
        <IconButtonContained onClick={handleModalOpen} variant="error">
          <CallEndIcon sx={{ color: otherColors.white }} />
        </IconButtonContained>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={toastMessage}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={toastType} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
      {isSettingsOpen && <CallSettings onClose={closeSettings} />}
      {isModalOpen && <ConfirmEndCallDialog openModal={isModalOpen} setOpenModal={setIsModalOpen} />}
      {isReportDialogOpen && (
        <ReportIssueDialog
          open={isReportDialogOpen}
          handleClose={() => setIsReportDialogOpen(false)}
          oystehr={oystehr}
          appointmentID={appointmentID}
          patientID={patientInfo?.id}
          encounterId={encounterId}
          setSnackbarOpen={setSnackbarOpen}
          setToastType={setToastType}
          setToastMessage={setToastMessage}
        ></ReportIssueDialog>
      )}
    </>
  );
};
