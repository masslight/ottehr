import { FC } from 'react';
import { ClickAwayListener, IconButton, List, Box } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { StyledListItemWithButton, CustomTooltip } from 'ui-components';
import { otherColors } from '../../IntakeThemeProvider';
import { IconButtonContained } from './IconButtonContained';
import { ContactSupportDialog } from '../../components/ContactSupportDialog';
import { useIntakeCommonStore } from '../features/common';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

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
              {supportDialogOpen && (
                <ContactSupportDialog onClose={() => useIntakeCommonStore.setState({ supportDialogOpen: false })} />
              )}
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
