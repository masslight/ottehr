import { FC } from 'react';
import { ClickAwayListener, IconButton, List, Box } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { clockFullColor } from '../assets';
import { StyledListItemWithButton, CustomTooltip } from 'ottehr-components';
import { otherColors } from '../IntakeThemeProvider';
import { IconButtonContained } from './IconButtonContained';

type CallSettingsTooltipProps = {
  isTooltipOpen: boolean;
  handleTooltipOpen: () => void;
  handleTooltipClose: () => void;
  openSettings: () => void;
};

export const CallSettingsTooltip: FC<CallSettingsTooltipProps> = (props) => {
  const { isTooltipOpen, handleTooltipOpen, handleTooltipClose, openSettings } = props;

  return (
    <ClickAwayListener onClickAway={handleTooltipClose}>
      <div>
        <CustomTooltip
          PopperProps={{
            disablePortal: true,
          }}
          onClose={handleTooltipClose}
          open={isTooltipOpen}
          disableFocusListener
          disableHoverListener
          disableTouchListener
          title={
            <Box sx={{ p: 3, width: '300px', position: 'relative' }}>
              <List sx={{ p: 0 }}>
                <StyledListItemWithButton primaryText="Report problem" secondaryText="Send error report">
                  <img alt="Clock icon" src={clockFullColor} width={24} />
                </StyledListItemWithButton>
                <StyledListItemWithButton
                  primaryText="Setting"
                  secondaryText="Audio, video"
                  onClick={() => {
                    handleTooltipClose();
                    openSettings();
                  }}
                  noDivider
                >
                  <SettingsOutlinedIcon sx={{ color: otherColors.purple }} />
                </StyledListItemWithButton>
              </List>
              <IconButton onClick={handleTooltipClose} size="small" sx={{ position: 'absolute', right: 0, top: 0 }}>
                <CloseIcon fontSize="small" sx={{ color: otherColors.toolTipClose }} />
              </IconButton>
            </Box>
          }
        >
          <IconButtonContained onClick={handleTooltipOpen} variant={isTooltipOpen ? 'disabled' : undefined}>
            <SettingsIcon sx={{ color: isTooltipOpen ? otherColors.darkPurple : otherColors.white }} />
          </IconButtonContained>
        </CustomTooltip>
      </div>
    </ClickAwayListener>
  );
};
