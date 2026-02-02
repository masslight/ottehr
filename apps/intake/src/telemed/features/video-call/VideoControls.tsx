import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box } from '@mui/material';
import { palette } from '@theme/index';
import { useLocalVideo, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { FC, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../../App';
import { CustomDialog } from '../../../components/CustomDialog';
import { otherColors } from '../../../IntakeThemeProvider';
import { CallSettings, CallSettingsTooltip, IconButtonContained, SideCardList } from '../../components';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ConfirmEndCallDialog } from '.';

export const VideoControls: FC = () => {
  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const { muted, toggleMute } = useToggleLocalMute();
  const isMobile = useIsMobile();
  const location = useLocation();
  const isRegularParticipant = location.pathname === intakeFlowPageRoute.VideoCall.path;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleTooltipClose = (): void => {
    setIsTooltipOpen(false);
  };

  const handleTooltipOpen = (): void => {
    setIsTooltipOpen(true);
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
          backgroundColor: palette.primary.dark,
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
            <VideocamOffIcon sx={{ color: otherColors.white }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMute} variant={!muted ? undefined : 'disabled'}>
          {!muted ? <MicIcon sx={{ color: otherColors.white }} /> : <MicOffIcon sx={{ color: otherColors.white }} />}
        </IconButtonContained>
        {isRegularParticipant && isMobile && (
          <IconButtonContained onClick={() => setIsMoreOpen(!isMoreOpen)} variant={isMoreOpen ? 'disabled' : undefined}>
            <MoreVertIcon sx={{ color: otherColors.white }} />
          </IconButtonContained>
        )}
        <CallSettingsTooltip
          isTooltipOpen={isTooltipOpen}
          handleTooltipOpen={handleTooltipOpen}
          handleTooltipClose={handleTooltipClose}
          openSettings={openSettings}
        />
        <IconButtonContained onClick={handleModalOpen} variant="error">
          <CallEndIcon sx={{ color: otherColors.white }} />
        </IconButtonContained>
      </Box>
      {isSettingsOpen && <CallSettings onClose={closeSettings} />}
      {isModalOpen && <ConfirmEndCallDialog openModal={isModalOpen} setOpenModal={setIsModalOpen} />}
      {isMoreOpen && (
        <CustomDialog open={isMoreOpen} onClose={() => setIsMoreOpen(false)}>
          <SideCardList isCardExpanded={true} />
        </CustomDialog>
      )}
    </>
  );
};
