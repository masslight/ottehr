import { FC, useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useLocalVideo, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { CallSettings, IconButtonContained, CallSettingsTooltip, SideCardList } from '../../components';
import { otherColors } from '../../../IntakeThemeProvider';
import { ConfirmEndCallDialog } from '.';
import { intakeFlowPageRoute } from '../../../App';
import { breakpoints, CustomDialog } from 'ui-components';
import { useLocation } from 'react-router-dom';

export const VideoControls: FC = () => {
  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const { muted, toggleMute } = useToggleLocalMute();
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);
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
          backgroundColor: otherColors.appbarBackground,
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
            <VideocamOffIcon sx={{ color: otherColors.appbarBackground }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMute} variant={!muted ? undefined : 'disabled'}>
          {!muted ? (
            <MicIcon sx={{ color: otherColors.white }} />
          ) : (
            <MicOffIcon sx={{ color: otherColors.appbarBackground }} />
          )}
        </IconButtonContained>
        {isRegularParticipant && isMobile && (
          <IconButtonContained onClick={() => setIsMoreOpen(!isMoreOpen)} variant={isMoreOpen ? 'disabled' : undefined}>
            <MoreVertIcon sx={{ color: isMoreOpen ? otherColors.appbarBackground : otherColors.white }} />
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
