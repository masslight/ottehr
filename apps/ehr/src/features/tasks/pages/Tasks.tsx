import { WarningAmberOutlined } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  CircularProgress,
  Paper,
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
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import {
  formatDate,
  TASKS_PAGE_SIZE,
  useCompleteTask,
  useGetTasks,
} from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { Task, TaskAlertCode, TaskAlertDisplay } from 'utils';
import { TASK_CATEGORY_LABEL } from '../common';
import { CategoryChip } from '../components/CategoryChip';
import { CreateTaskDialog } from '../components/CreateTaskDialog';
import { MoreTaskActions } from '../components/MoreTaskActions';

const LOCAL_STORAGE_FILTERS_KEY = 'tasks.filters';
const UNKNOWN = 'Unknown';
const COMPLETED = 'completed';
const TASK_STATUS_LABEL: Record<string, string> = {
  ready: 'pending',
  'in-progress': 'in progress',
  completed: 'completed',
};
const CATEGORIES: Record<string, string> = Object.entries(TASK_CATEGORY_LABEL).reduce<Record<string, string>>(
  (previousValue, entry) => {
    const category = entry[0];
    const label = entry[1];
    if (previousValue[label]) {
      previousValue[label] += ',' + category;
    } else {
      previousValue[label] = category;
    }
    return previousValue;
  },
  {}
);

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: completeTask } = useCompleteTask();
  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];

  const renderActionButton = (task: Task): ReactElement | null => {
    if (task.status === COMPLETED) {
      return null;
    }
    if (task.action) {
      return (
        <RoundedButton variant="contained" onClick={() => window.open(task.action?.link, '_blank')}>
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

  const setPage = (page: number): void => {
    searchParams.set('page', page.toString());
    setSearchParams(searchParams);
  };

  const page = Number(searchParams.get('page') ?? '0');

  const { data: tasksData, isLoading: isTasksLoading } = useGetTasks({
    assignedTo: searchParams.get('assignedTo'),
    category: searchParams.get('category'),
    location: searchParams.get('location'),
    status: searchParams.get('status'),
    page: page,
  });

  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const onNewTaskClick = (): void => {
    setShowCreateTaskDialog(true);
  };

  const renderAlertIcon = (alertCode: TaskAlertCode): ReactElement | null => {
    const display = TaskAlertDisplay[alertCode] ?? alertCode;
    return (
      <GenericToolTip title={display} placement="top">
        <WarningAmberOutlined style={{ marginLeft: '5px' }} color="warning" />
      </GenericToolTip>
    );
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <FormProvider {...methods}>
          <Paper>
            <Stack direction="row" spacing={2} padding="8px">
              <LocationSelectInput name="location" label="Location" />
              <SelectInput
                name="category"
                label="Category"
                options={Object.values(CATEGORIES)}
                getOptionLabel={(option) =>
                  Object.entries(CATEGORIES).find(([_key, value]) => value === option)?.[0] ?? option
                }
              />
              <EmployeeSelectInput name="assignedTo" label="Assigned to" />
              <SelectInput
                name="status"
                label="Status"
                options={Object.keys(TASK_STATUS_LABEL)}
                getOptionLabel={(option) => TASK_STATUS_LABEL[option]}
              />
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
                <TableCell style={{ width: '50px' }}></TableCell>
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
                          {task.alert ? renderAlertIcon(task.alert) : null}
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
                          'Unassigned'
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
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            {renderActionButton(task)}
                            {renderCompleteButton(task)}
                          </Stack>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <MoreTaskActions task={task} currentUser={currentUser} />
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
            page={page}
            onPageChange={(_e, newPageNumber) => {
              setPage(newPageNumber);
            }}
          />
        </Paper>
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
