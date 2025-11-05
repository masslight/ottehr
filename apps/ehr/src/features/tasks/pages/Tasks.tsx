import { otherColors } from '@ehrTheme/colors';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import {
  Box,
  CircularProgress,
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
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import React, { ReactElement, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { Option } from 'src/components/input/Option';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import {
  Task,
  TASKS_PAGE_SIZE,
  useAssignTask,
  useCompleteTask,
  useGetTasks,
  useUnassignTask,
} from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { formatDate, TASK_CATEGORY_LABEL } from '../common';
import { AssignTaskDialog } from '../components/AssignTaskDialog';
import { CategoryChip } from '../components/CategoryChip';
import { CreateTaskDialog } from '../components/CreateTaskDialog';

const LOCAL_STORAGE_FILTERS_KEY = 'tasks.filters';
const UNKNOWN = 'Unknown';
const COMPLETED = 'completed';
const TASK_STATUS_LABEL: Record<string, string> = {
  ready: 'pending',
  'in-progress': 'in progress',
  completed: 'completed',
};
const CATEGORY_OPTIONS: Option[] = Object.entries(
  Object.entries(TASK_CATEGORY_LABEL).reduce<Record<string, string>>((previousValue, entry) => {
    const category = entry[0];
    const label = entry[1];
    if (previousValue[label]) {
      previousValue[label] += ',' + category;
    } else {
      previousValue[label] = category;
    }
    return previousValue;
  }, {})
).map((entry) => {
  return {
    label: entry[0],
    value: entry[1],
  };
});
const STATUS_OPTIONS: Option[] = Object.entries(TASK_STATUS_LABEL).map((entry) => {
  return {
    label: entry[1],
    value: entry[0],
  };
});

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: assignTask, isPending: isAssigning } = useAssignTask();
  const { mutateAsync: unassignTask } = useUnassignTask();
  const { mutateAsync: completeTask } = useCompleteTask();
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
                  name: currentUser.userName,
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
          disabled={currentUserProviderId !== task.assignee?.id}
          onClick={() => window.open(task.action?.link, '_blank')}
        >
          {task.action.name}
        </RoundedButton>
      );
    }
    return null;
  };

  const renderCompleteButton = (task: Task): ReactElement | null => {
    if (task.status !== COMPLETED && currentUserProviderId === task.assignee?.id && task.completable) {
      return (
        <RoundedButton variant="contained" onClick={async () => await completeTask({ taskId: task.id })}>
          Complete
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

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const filtersValues = {
      assignedTo: searchParams.get('assignedTo')
        ? {
            id: searchParams.get('assignedTo'),
          }
        : null,
      category: searchParams.get('category'),
      location: searchParams.get('location')
        ? {
            id: searchParams.get('location'),
          }
        : null,
      status: searchParams.get('status'),
    };
    methods.reset(filtersValues);
  }, [searchParams, methods]);

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        const queryParams = new URLSearchParams();
        const filtersToPersist: Record<string, string> = {};
        for (const key in values) {
          const value = values[key]?.id ?? values[key];
          if (value) {
            queryParams.set(key, value);
            filtersToPersist[key] = value;
          }
        }
        setSearchParams(queryParams);
        if (Object.keys(filtersToPersist).length > 0) {
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(filtersToPersist));
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
        }
      },
    });
    return () => callback();
  }, [methods, navigate, setSearchParams]);

  useEffect(() => {
    const persistedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
    if (searchParams.size === 0 && persistedFilters != null) {
      const filters = JSON.parse(persistedFilters);
      const queryParams = new URLSearchParams();
      for (const key in filters) {
        queryParams.set(key, filters[key]);
      }
      setSearchParams(queryParams);
    }
  }, [searchParams, setSearchParams]);

  const [pageNumber, setPageNumber] = useState(0);

  const { data: tasksData, isLoading: isTasksLoading } = useGetTasks({
    assignedTo: searchParams.get('assignedTo'),
    category: searchParams.get('category'),
    location: searchParams.get('location'),
    status: searchParams.get('status'),
    page: pageNumber,
  });

  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const onNewTaskClick = (): void => {
    setShowCreateTaskDialog(true);
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <FormProvider {...methods}>
          <Paper>
            <Stack direction="row" spacing={2} padding="8px">
              <LocationSelectInput name="location" label="Location" />
              <SelectInput name="category" label="Category" options={CATEGORY_OPTIONS} />
              <ProviderSelectInput name="assignedTo" label="Asigned to" />
              <SelectInput name="status" label="Status" options={STATUS_OPTIONS} />
              <RoundedButton variant="contained" onClick={onNewTaskClick} startIcon={<AddIcon />}>
                New Task
              </RoundedButton>
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
              {isTasksLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : null}
              {!isTasksLoading && (tasksData?.tasks ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2">No tasks</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {!isTasksLoading &&
                (tasksData?.tasks ?? []).map((task) => {
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
                        {task.details ? <Typography variant="body2">{task.details}</Typography> : null}
                        <Typography variant="body2" style={{ color: '#00000099' }}>
                          {task.subtitle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <>
                            <Typography variant="body2">{task.assignee.name}</Typography>
                            <Typography
                              variant="body2"
                              display="inline"
                              style={{ color: '#00000099', display: 'block' }}
                            >
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
                            {renderCompleteButton(task)}
                            {renderMoreButton(task)}
                          </Stack>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[TASKS_PAGE_SIZE]}
            component="div"
            count={tasksData?.total ?? -1}
            rowsPerPage={TASKS_PAGE_SIZE}
            page={pageNumber}
            onPageChange={(_e, newPageNumber) => {
              setPageNumber(newPageNumber);
            }}
          />
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
        <CreateTaskDialog
          open={showCreateTaskDialog}
          handleClose={(): void => {
            setShowCreateTaskDialog(false);
          }}
        />
      </Stack>
    </PageContainer>
  );
};
