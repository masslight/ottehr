import { otherColors } from '@ehrTheme/colors';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';

interface Props {
  category: string;
  createdDate: string;
  title: string;
  subtitle: string;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
  statusSection?: {
    status: 'completed' | 'in progress';
    details: string;
  };
  onAssignMeClick?: () => void;
  onUnassignMeClick?: () => void;
  onAssignSomeoneElseClick?: () => void;
  alertText?: string;
}

export const TaskRow: React.FC<Props> = (props) => {
  const [moreActionsPopoverAnchor, setMoreActionsPopoverAnchor] = React.useState<HTMLButtonElement | null>(null);

  const closeMoreActionsPopover = (): void => {
    setMoreActionsPopoverAnchor(null);
  };

  return (
    <Paper style={{ display: 'flex', height: '62px', alignItems: 'center', width: '100%', padding: '16px' }}>
      <Box style={{ width: '150px' }}>
        <Box
          style={{
            background: '#2169F51F',
            borderRadius: '16px',
            height: '24px',
            padding: '0 12px 0 12px',
          }}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="body2" display="inline" style={{ color: '#2169F5', fontSize: '13px' }}>
            {props.category}
          </Typography>
        </Box>
        <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
          {props.createdDate}
        </Typography>
      </Box>
      <Box style={{ flexGrow: 1 }}>
        <Typography variant="body1" display="inline" style={{ color: '#000000DE', display: 'block', fontWeight: 500 }}>
          {props.title}
        </Typography>
        <Typography variant="body2" display="inline" style={{ color: '#00000099' }}>
          {props.subtitle}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {props.alertText ? (
          <GenericToolTip title={props.alertText} placement="top">
            <PriorityHighOutlinedIcon
              style={{
                width: '15px',
                height: '15px',
                color: '#FFF',
                background: otherColors.priorityHighIcon,
                borderRadius: '4px',
                padding: '1px 2px 1px 2px',
              }}
            />
          </GenericToolTip>
        ) : null}
        {props.actionButton ? (
          <RoundedButton variant="contained" onClick={props.actionButton.onClick}>
            {props.actionButton.text}
          </RoundedButton>
        ) : null}
        {props.onAssignMeClick ? (
          <RoundedButton variant="outlined" onClick={props.onAssignMeClick}>
            Assign Me
          </RoundedButton>
        ) : null}
        {props.statusSection ? (
          <Stack alignItems="flex-end">
            <StatusChip
              status={props.statusSection.status}
              style={props.statusSection.status === 'completed' ? 'green' : 'orange'}
            />
            <Typography variant="body2">{props.statusSection.details}</Typography>
          </Stack>
        ) : null}
        {props.onUnassignMeClick || props.onAssignSomeoneElseClick ? (
          <IconButton color="primary" onClick={(e) => setMoreActionsPopoverAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="medium" />
          </IconButton>
        ) : null}
        <Popover
          open={Boolean(moreActionsPopoverAnchor)}
          anchorEl={moreActionsPopoverAnchor}
          onClose={closeMoreActionsPopover}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <List>
            {props.onUnassignMeClick ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    props.onUnassignMeClick?.();
                    closeMoreActionsPopover();
                  }}
                >
                  <ListItemIcon>
                    <ShortcutIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                  </ListItemIcon>
                  <ListItemText primary="Unassign me" />
                </ListItemButton>
              </ListItem>
            ) : null}
            {props.onAssignSomeoneElseClick ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    props.onAssignSomeoneElseClick?.();
                    closeMoreActionsPopover();
                  }}
                >
                  <ListItemIcon>
                    <PersonAddIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                  </ListItemIcon>
                  <ListItemText primary="Assign to someone else" />
                </ListItemButton>
              </ListItem>
            ) : null}
          </List>
        </Popover>
      </Stack>
    </Paper>
  );
};
