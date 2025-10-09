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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import React, { ReactElement, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import { Task, useAssignTask, useGetTasks, useUnassignTask } from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { formatDate } from '../common';
import { AssignTaskDialog } from '../components/AssignTaskDialog';
import { CategoryChip } from '../components/CategoryChip';

const UNKNOWN = 'Unknown';
const COMPLETED = 'completed';
const TASK_STATUS_LABEL: Record<string, string> = {
  requested: 'pending',
  'in-progress': 'in progress',
  completed: 'completed',
};

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { data: tasks } = useGetTasks();
  const { mutateAsync: assignTask, isPending: isAssigning } = useAssignTask();
  const { mutateAsync: unassignTask } = useUnassignTask();
  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];

  const [moreActionsPopoverData, setMoreActionsPopoverData] = useState<{
    element: HTMLButtonElement;
    task: Task;
  } | null>(null);
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);

  const renderActionButton = (task: Task): ReactElement | null => {
    if (task.status === COMPLETED) {
      return null;
    }
    if (!task.assignee) {
      return (
        <RoundedButton
          variant="outlined"
          onClick={async () => {
            if (currentUserProviderId && currentUser?.name) {
              await assignTask({
                taskId: task.id,
                assignee: {
                  id: currentUserProviderId,
                  name: currentUser.name,
                },
              });
            }
          }}
          loading={isAssigning}
        >
          Assign Me
        </RoundedButton>
      );
    }
    if (task.action) {
      return (
        <RoundedButton
          variant="contained"
          onClick={() => navigate(task.action?.link ?? '#')}
          disabled={currentUserProviderId !== task.assignee?.id}
        >
          {task.action.name}
        </RoundedButton>
      );
    }
    return null;
  };

  const renderMoreButton = (task: Task): ReactElement | null => {
    if (task.status === COMPLETED) {
      return null;
    }
    return (
      <IconButton color="primary" onClick={(e) => setMoreActionsPopoverData({ element: e.currentTarget, task })}>
        <MoreVertIcon fontSize="medium" />
      </IconButton>
    );
  };

  const closeMoreActionsPopover = (): void => {
    setMoreActionsPopoverData(null);
  };

  const methods = useForm();

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        console.log(values);
      },
    });
    return () => callback();
  }, [methods]);

  return (
    <PageContainer>
      <Stack spacing={2}>
        <FormProvider {...methods}>
          <Paper>
            <Stack direction="row" spacing={2} padding="8px">
              <LocationSelectInput name="location" label="Location" />
              <SelectInput name="category" label="Category" options={[]} />
              <ProviderSelectInput name="asignedTo" label="Asigned to" />
              <SelectInput name="status" label="Status" options={[]} />
            </Stack>
          </Paper>
        </FormProvider>
        <Paper>
          <Table sx={{ width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Category and Date
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight="500" fontSize="14px">
                    Task
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Assigned To
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Status
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Action
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(tasks ?? []).map((task) => {
                return (
                  <TableRow>
                    <TableCell>
                      <CategoryChip category={task.category} />
                      <Typography
                        variant="body2"
                        display="inline"
                        style={{ color: '#00000099', display: 'block', marginTop: '5px' }}
                      >
                        {formatDate(task.createdDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography
                          variant="body1"
                          display="inline"
                          style={{
                            color: '#000000DE',
                            fontWeight: 500,
                            textDecoration: task.status === COMPLETED ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </Typography>
                        {task.alert ? (
                          <GenericToolTip title={task.alert} placement="top">
                            <PriorityHighOutlinedIcon
                              style={{
                                width: '15px',
                                height: '15px',
                                color: '#FFF',
                                background: otherColors.priorityHighIcon,
                                borderRadius: '4px',
                                padding: '1px 2px',
                                marginLeft: '5px',
                              }}
                            />
                          </GenericToolTip>
                        ) : null}
                      </Box>
                      <Typography variant="body2" display="inline" style={{ color: '#00000099' }}>
                        {task.subtitle}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {task.assignee ? (
                        <>
                          <Typography variant="body2">{task.assignee.name}</Typography>
                          <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
                            {formatDate(task.assignee.date)}
                          </Typography>
                        </>
                      ) : (
                        'Not Assigned'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        status={TASK_STATUS_LABEL[task.status] ?? UNKNOWN}
                        style={
                          task.status === COMPLETED ? 'green' : task.status === 'in-progress' ? 'orange' : 'purple'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {task.status !== COMPLETED ? (
                        <Stack direction="row" justifyContent="space-between">
                          {renderActionButton(task)}
                          {renderMoreButton(task)}
                        </Stack>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
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
                    }}
                  >
                    <ListItemIcon>
                      <ShortcutIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                    </ListItemIcon>
                    <ListItemText primary="Unassign" />
                  </ListItemButton>
                </ListItem>
              ) : (
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
              )}
            </List>
          </Popover>
        ) : null}
        {taskToAssign ? <AssignTaskDialog task={taskToAssign} handleClose={() => setTaskToAssign(null)} /> : null}
      </Stack>
    </PageContainer>
  );
};
