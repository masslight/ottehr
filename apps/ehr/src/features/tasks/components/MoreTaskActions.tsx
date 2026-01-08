import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import { IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Popover } from '@mui/material';
import React, { useState } from 'react';
import { useAssignTask, useUnassignTask } from 'src/features/visits/in-person/hooks/useTasks';
import { EvolveUser } from 'src/hooks/useEvolveUser';
import { Task } from 'utils';
import { AssignTaskDialog } from './AssignTaskDialog';

interface MoreTaskActionsProps {
  task: Task;
  currentUser: EvolveUser | undefined;
  refetchData?: () => void;
}

export const MoreTaskActions: React.FC<MoreTaskActionsProps> = ({ task, currentUser, refetchData }) => {
  const [moreActionsPopoverData, setMoreActionsPopoverData] = useState<{
    element: HTMLButtonElement;
    task: Task;
  } | null>(null);
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);

  const { mutateAsync: assignTask } = useAssignTask();
  const { mutateAsync: unassignTask } = useUnassignTask();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];

  const closeMoreActionsPopover = (): void => {
    setMoreActionsPopoverData(null);
  };

  if (task.status === 'completed') {
    return null;
  }

  return (
    <>
      <IconButton color="primary" onClick={(e) => setMoreActionsPopoverData({ element: e.currentTarget, task })}>
        <MoreVertIcon fontSize="medium" />
      </IconButton>
      {moreActionsPopoverData ? (
        <Popover
          open={true}
          anchorEl={moreActionsPopoverData.element}
          onClose={closeMoreActionsPopover}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <List>
            {moreActionsPopoverData.task?.assignee?.id ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={async () => {
                    await unassignTask({
                      taskId: moreActionsPopoverData.task.id,
                    });
                    closeMoreActionsPopover();
                    if (refetchData) refetchData();
                  }}
                >
                  <ListItemIcon>
                    <ShortcutIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                  </ListItemIcon>
                  <ListItemText primary="Unassign" />
                </ListItemButton>
              </ListItem>
            ) : (
              <>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={async () => {
                      if (currentUserProviderId && currentUser?.name) {
                        await assignTask({
                          taskId: moreActionsPopoverData.task.id,
                          assignee: {
                            id: currentUserProviderId,
                            name: currentUser.userName,
                          },
                        });
                        closeMoreActionsPopover();
                        if (refetchData) refetchData();
                      }
                    }}
                  >
                    <ListItemIcon>
                      <HowToRegOutlinedIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary="Assign me" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setTaskToAssign(moreActionsPopoverData.task);
                      closeMoreActionsPopover();
                    }}
                  >
                    <ListItemIcon>
                      <PersonAddIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                    </ListItemIcon>
                    <ListItemText primary="Assign to someone else" />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        </Popover>
      ) : null}
      {taskToAssign ? (
        <AssignTaskDialog task={taskToAssign} handleClose={() => setTaskToAssign(null)} refetchData={refetchData} />
      ) : null}
    </>
  );
};
