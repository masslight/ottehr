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
import { useNavigate } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import { Task } from 'utils';

interface Props {
  task: Task;
  showAlert?: boolean;
  showActionButton?: boolean;
  showAssignMeButton?: boolean;
  showStatus?: boolean;
  showUnassignMeItem?: boolean;
  showAssignSomeoneElseItem?: boolean;
}

export const TaskRow: React.FC<Props> = ({
  task,
  showAlert,
  showActionButton,
  showAssignMeButton,
  showStatus,
  showUnassignMeItem,
  showAssignSomeoneElseItem,
}) => {
  const navigate = useNavigate();
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
            {task.category}
          </Typography>
        </Box>
        <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
          {task.createdDate}
        </Typography>
      </Box>
      <Box style={{ flexGrow: 1 }}>
        <Typography variant="body1" display="inline" style={{ color: '#000000DE', display: 'block', fontWeight: 500 }}>
          {task.title}
        </Typography>
        <Typography variant="body2" display="inline" style={{ color: '#00000099' }}>
          {task.subtitle}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {showAlert && task.alert ? (
          <GenericToolTip title={task.alert} placement="top">
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
        {showActionButton && task.action ? (
          <RoundedButton variant="contained" onClick={() => navigate(task.action?.link ?? '#')}>
            {task.action.name}
          </RoundedButton>
        ) : null}
        {showAssignMeButton ? (
          <RoundedButton variant="outlined" onClick={() => console.log('Assign Me')}>
            Assign Me
          </RoundedButton>
        ) : null}
        {showStatus ? (
          <Stack alignItems="flex-end">
            <StatusChip status={task.status} style={task.status === 'completed' ? 'green' : 'orange'} />
            <Typography variant="body2">{task.assignee?.name + ' ' + task.assignee?.date}</Typography>
          </Stack>
        ) : null}
        {showUnassignMeItem || showAssignSomeoneElseItem ? (
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
            {showUnassignMeItem ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    console.log('Unassign me');
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
            {showAssignSomeoneElseItem ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    console.log('Assign to someone else');
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
