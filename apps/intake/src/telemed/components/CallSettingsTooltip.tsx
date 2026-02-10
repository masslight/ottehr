import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Box, ClickAwayListener, IconButton, List } from '@mui/material';
import { palette } from '@theme/colors';
import { FC } from 'react';
import { ContactSupportDialog } from '../../components/ContactSupportDialog';
import { CustomTooltip } from '../../components/CustomTooltip';
import { StyledListItemWithButton } from '../../components/StyledListItemWithButton';
import { useIntakeCommonStore } from '../features/common';
import { IconButtonContained } from './IconButtonContained';

type CallSettingsTooltipProps = {
  isTooltipOpen: boolean;
  handleTooltipOpen: () => void;
  handleTooltipClose: () => void;
  openSettings: () => void;
};

export const CallSettingsTooltip: FC<CallSettingsTooltipProps> = (props) => {
  const { isTooltipOpen, handleTooltipOpen, handleTooltipClose, openSettings } = props;
  const supportDialogOpen = useIntakeCommonStore((state) => state.supportDialogOpen);

  return (
    <>
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
                  <StyledListItemWithButton
                    primaryText="Report problem"
                    secondaryText="Send error report"
                    onClick={() => {
                      handleTooltipClose();
                      useIntakeCommonStore.setState({ supportDialogOpen: true });
                    }}
                  >
                    <HelpOutlineIcon color="secondary" />
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
                    <SettingsOutlinedIcon sx={{ color: palette.secondary.main }} />
                  </StyledListItemWithButton>
                </List>
                <IconButton onClick={handleTooltipClose} size="small" sx={{ position: 'absolute', right: 0, top: 0 }}>
                  <CloseIcon fontSize="small" sx={{ color: palette.tertiary.contrast }} />
                </IconButton>
              </Box>
            }
          >
            <IconButtonContained onClick={handleTooltipOpen} variant={isTooltipOpen ? 'disabled' : undefined}>
              <SettingsIcon sx={{ color: palette.tertiary.light }} />
            </IconButtonContained>
          </CustomTooltip>
        </div>
      </ClickAwayListener>
      {supportDialogOpen && (
        <ContactSupportDialog onClose={() => useIntakeCommonStore.setState({ supportDialogOpen: false })} />
      )}
    </>
  );
};
