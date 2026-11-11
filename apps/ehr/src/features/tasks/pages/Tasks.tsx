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
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import Loading from 'src/components/Loading';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import { useTaskNotes } from 'src/features/patient-notes/hooks/useTaskNotes';
import {
  formatDate,
  TASKS_PAGE_SIZE,
  useCompleteTask,
  useGetTasks,
  VIEW_FAX,
} from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { FAX_TASK, Task, TaskAlertCode, TaskAlertDisplay } from 'utils/lib/types/data/tasks/types';
import { CompleteSupportChatTaskButton } from '../../support-chat/components/CompleteSupportChatTaskButton';
import { SupportChatTaskButton } from '../../support-chat/components/SupportChatTaskButton';
import { RefillRequestDialog } from '../../visits/in-person/components/erx/RefillRequestDialog';
import { TASK_CATEGORY_LABEL } from '../common';
import { CategoryChip } from '../components/CategoryChip';
import { CreateTaskDialog } from '../components/CreateTaskDialog';
import { MoreTaskActions } from '../components/MoreTaskActions';
import { TaskActionButton } from '../components/TaskActionButton';
import { TaskNotesButton } from '../components/TaskNotesButton';
import { TaskNotesDialog } from '../components/TaskNotesDialog';
import { TaskTitle } from '../components/TaskTitle';

const LOCAL_STORAGE_FILTERS_KEY = 'tasks.filters';
const UNKNOWN = 'Unknown';
const COMPLETED = 'completed';
const NOTE_CREATED_PREVIEW_LENGTH = 80;
const TASK_STATUS_LABEL: Record<string, string> = {
  ready: 'pending',
  'in-progress': 'in progress',
  completed: 'completed',
};
// Label -> comma-joined category codes: several codes share a label (e.g. the system and the manual
// "External Lab" tasks), so each option selects all of them.
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

/**
 * The `category` URL param is a flat comma-separated list of category codes, so the options it holds are
 * the ones it names any code of, kept in the order they were picked. A single-category URL from before the
 * filter was multi-select reads the same way.
 */
const parseCategoryParam = (param: string | null): string[] => {
  const options = (param ?? '')
    .split(',')
    .map((code) => Object.values(CATEGORIES).find((option) => option.split(',').includes(code)))
    .filter((option): option is string => !!option);
  return [...new Set(options)];
};

const parseIdListParam = (param: string | null): { id: string }[] =>
  (param ?? '')
    .split(',')
    .filter(Boolean)
    .map((id) => ({ id }));

/** A filter's form value as stored in the URL and localStorage: select options by `id`, arrays as lists. */
const toFilterValue = (value: unknown): string | string[] | undefined => {
  const toItem = (item: unknown): string | undefined =>
    (typeof item === 'string' ? item : (item as { id?: string } | null)?.id) || undefined;
  if (Array.isArray(value)) {
    const items = value.map(toItem).filter((item): item is string => !!item);
    return items.length > 0 ? items : undefined;
  }
  return toItem(value);
};

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: completeTask, isPending: isCompleting, variables: completingTask } = useCompleteTask();
  const currentUser = useEvolveUser();
  const currentUserProviderId = getIdFromReference(currentUser?.profile);
  const [requestTaskId, setRequestTaskId] = useState<string>();

  const renderCompleteButton = (task: Task): ReactElement | null => {
    if (task.status !== COMPLETED && currentUserProviderId === task.assignee?.id && task.completable) {
      if (task.chat) {
        return <CompleteSupportChatTaskButton task={task} />;
      }

      const isCompletingTask = isCompleting && completingTask?.taskId === task.id;

      const complete = async (): Promise<void> => {
        try {
          await completeTask({ taskId: task.id });
        } catch (error) {
          enqueueSnackbar(error instanceof Error ? error.message : 'Failed to complete the task.', {
            variant: 'error',
          });
        }
      };

      // A completed fax can no longer be filed or deleted, so completing an unfiled one is confirmed first.
      if (task.category === FAX_TASK.category && task.action?.name !== VIEW_FAX) {
        return (
          <ConfirmationDialog
            key={task.id}
            title="Complete without filing?"
            description="This fax hasn't been filed to a patient's chart. Once the task is completed, the fax can no longer be filed or deleted."
            response={complete}
            actionButtons={{ proceed: { text: 'Complete', loading: isCompletingTask }, back: { text: 'Cancel' } }}
          >
            {(showDialog) => (
              <RoundedButton variant="contained" onClick={showDialog} loading={isCompletingTask}>
                Complete
              </RoundedButton>
            )}
          </ConfirmationDialog>
        );
      }
      return (
        <RoundedButton variant="contained" onClick={complete} loading={isCompletingTask}>
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
      category: parseCategoryParam(searchParams.get('category')),
      location: parseIdListParam(searchParams.get('location')),
      status: searchParams.get('status')?.split(','),
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
        const filtersToPersist: Record<string, string | string[]> = {};
        for (const key in values) {
          const value = toFilterValue(values[key]);
          if (value) {
            queryParams.set(key, Array.isArray(value) ? value.join(',') : value);
            filtersToPersist[key] = value;
          }
        }
        setSearchParams(queryParams);
        if (Object.keys(filtersToPersist).length > 0) {
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(filtersToPersist));
        } else {
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify({}));
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
        const value = filters[key];
        queryParams.set(key, Array.isArray(value) ? value.join(',') : value);
      }
      setSearchParams(queryParams);
    }
    if (searchParams.size === 0 && persistedFilters == null) {
      const queryParams = new URLSearchParams();
      queryParams.set('status', 'ready,in-progress');
      setSearchParams(queryParams);
    }
  }, [searchParams, setSearchParams]);

  const setPage = (page: number): void => {
    searchParams.set('page', page.toString());
    setSearchParams(searchParams);
  };

  const page = Number(searchParams.get('page') ?? '0');

  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isFetching: isTasksRefreshing,
  } = useGetTasks(
    {
      assignedTo: searchParams.get('assignedTo'),
      category: searchParams.get('category'),
      location: searchParams.get('location'),
      status: searchParams.get('status'),
      page: page,
    },
    {
      refetchInterval: 30000,
    }
  );

  const { data: taskNotes } = useTaskNotes((tasksData?.tasks ?? []).map((task) => task.id));
  const notesByTaskId = useMemo(() => {
    const grouped = new Map<string, NoteDTO[]>();
    for (const note of taskNotes ?? []) {
      if (!note.taskId) continue;
      const notes = grouped.get(note.taskId);
      if (notes) notes.push(note);
      else grouped.set(note.taskId, [note]);
    }
    return grouped;
  }, [taskNotes]);
  const [notesTaskId, setNotesTaskId] = useState<string | undefined>();

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
            <Stack direction="row" alignItems="flex-start" spacing={2} padding="8px">
              <LocationSelectInput name="location" label="Location" type="in-person" multiple limitTags={2} />
              <SelectInput
                name="category"
                label="Category"
                multiple
                limitTags={2}
                options={Object.values(CATEGORIES)}
                getOptionLabel={(option) =>
                  Object.entries(CATEGORIES).find(([_key, value]) => value === option)?.[0] ?? option
                }
              />
              <EmployeeSelectInput name="assignedTo" label="Assigned to" />
              <SelectInput
                name="status"
                label="Status"
                multiple={true}
                options={Object.keys(TASK_STATUS_LABEL)}
                getOptionLabel={(option) => TASK_STATUS_LABEL[option]}
              />
              <RoundedButton
                variant="contained"
                onClick={onNewTaskClick}
                startIcon={<AddIcon />}
                sx={{ flexShrink: 0 }}
              >
                New Task
              </RoundedButton>
            </Stack>
          </Paper>
        </FormProvider>
        <Paper>
          <Box sx={{ position: 'relative' }}>
            {isTasksRefreshing && !isTasksLoading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 0,
                }}
              >
                <Loading />
              </Box>
            )}
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
                    const notes = notesByTaskId.get(task.id) ?? [];
                    return (
                      <TableRow key={task.id}>
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
                            <TaskTitle task={task} notes={notes} onOpenNotes={() => setNotesTaskId(task.id)} />
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
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <TaskNotesButton
                              task={task}
                              notes={notes}
                              currentUserId={currentUserProviderId}
                              onOpenNotes={() => setNotesTaskId(task.id)}
                            />
                            {task.chat && <SupportChatTaskButton task={task} />}
                            <TaskActionButton task={task} onViewRequest={() => setRequestTaskId(task.id)} />
                            {renderCompleteButton(task)}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <MoreTaskActions task={task} currentUser={currentUser} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Box>
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
        {requestTaskId && <RefillRequestDialog taskId={requestTaskId} onClose={() => setRequestTaskId(undefined)} />}
        {notesTaskId ? (
          <TaskNotesDialog
            taskId={notesTaskId}
            onClose={() => setNotesTaskId(undefined)}
            onNoteCreated={(text) => {
              setNotesTaskId((current) => (current === notesTaskId ? undefined : current));
              const preview =
                text.length > NOTE_CREATED_PREVIEW_LENGTH ? `${text.slice(0, NOTE_CREATED_PREVIEW_LENGTH)}…` : text;
              enqueueSnackbar(`Note created: ${preview}`, { variant: 'success' });
            }}
          />
        ) : null}
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
