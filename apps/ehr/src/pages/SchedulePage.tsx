import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, IconButton, Paper, Skeleton, Tab, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { APIError, CreateScheduleParams, isApiError, isValidUUID, ScheduleDTO, UpdateScheduleParams } from 'utils';
import { useSuccessQuery } from 'utils/lib/frontend';
import { createSchedule, getSchedule, updateSchedule } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import Loading from '../components/Loading';
import ScheduleComponent from '../components/schedule/ScheduleComponent';
import ScheduleGeneralTab from '../components/schedule/ScheduleGeneralTab';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

export function getResource(
  scheduleType: 'location' | 'provider' | 'group'
): 'Location' | 'Practitioner' | 'HealthcareService' {
  if (scheduleType === 'location') {
    return 'Location';
  } else if (scheduleType === 'provider') {
    return 'Practitioner';
  } else if (scheduleType === 'group') {
    return 'HealthcareService';
  }

  console.log(`scheduleType unknown ${scheduleType}`);
  throw new Error('scheduleType unknown');
}

export default function SchedulePage(): ReactElement {
  const scheduleType = useParams()['schedule-type'] as 'location' | 'provider' | undefined;
  const ownerId = useParams()['owner-id'] as string | undefined;
  const scheduleId = useParams()['schedule-id'] as string;
  const createMode = scheduleType !== undefined && ownerId !== undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const { oystehrZambda } = useApiClients();
  const queryEnabled = (() => {
    if (!oystehrZambda) {
      return false;
    }
    if (createMode) {
      return true;
    }
    if (!createMode && isValidUUID(scheduleId)) {
      return true;
    }
    return false;
  })();

  const {
    isLoading,
    isFetching,
    isRefetching,
    data: scheduleData,
  } = useQuery({
    queryKey: ['ehr-get-schedule', scheduleId, ownerId, scheduleType],

    queryFn: () =>
      oystehrZambda
        ? getSchedule(
            { scheduleId, ownerId, ownerType: scheduleType ? getResource(scheduleType) : undefined },
            oystehrZambda
          )
        : null,

    enabled: queryEnabled,
  });

  useSuccessQuery(scheduleData, (data) => {
    if (data) {
      setItem(data);
    }
  });

  const saveScheduleChanges = useMutation({
    mutationFn: async (params: UpdateScheduleParams) => {
      if (oystehrZambda) {
        const response = await updateSchedule(params, oystehrZambda);
        return response;
      }
      throw new Error('fhir client not defined or patient id not provided');
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        const message = (error as APIError).message;
        enqueueSnackbar(message, { variant: 'error' });
      } else {
        enqueueSnackbar('Something went wrong! Schedule changes could not be saved.', { variant: 'error' });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ehr-get-schedule'],
      });
      enqueueSnackbar('Schedule changes saved successfully!', { variant: 'success' });
    },
  });

  const createNewSchedule = useMutation({
    mutationFn: async (params: CreateScheduleParams) => {
      if (oystehrZambda) {
        const response = await createSchedule(params, oystehrZambda);
        return response;
      }
      throw new Error('fhir client not defined or patient id not provided');
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        const message = (error as APIError).message;
        enqueueSnackbar(message, { variant: 'error' });
      } else {
        enqueueSnackbar('Something went wrong! Schedule could not be created.', { variant: 'error' });
      }
    },
    onSuccess: async (newSchedule: Schedule) => {
      navigate(`/admin/schedule/id/${newSchedule.id}`);
      enqueueSnackbar('Schedule added successfully!', { variant: 'success' });
    },
  });

  const saveNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!oystehrZambda || !item) {
        throw new Error('Schedule not loaded');
      }
      return await updateSchedule({ scheduleId: item.id, name: newName }, oystehrZambda);
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        enqueueSnackbar((error as APIError).message, { variant: 'error' });
      } else {
        enqueueSnackbar('Could not save the new name.', { variant: 'error' });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ehr-get-schedule'] });
      setIsEditingName(false);
      enqueueSnackbar('Name saved.', { variant: 'success' });
    },
  });

  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || saveScheduleChanges.isPending;

  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  const startEditName = (): void => {
    setNameDraft(item?.owner?.name ?? '');
    setIsEditingName(true);
  };

  const cancelEditName = (): void => {
    setIsEditingName(false);
    setNameDraft('');
  };

  const submitName = (): void => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      enqueueSnackbar('Name cannot be empty.', { variant: 'warning' });
      return;
    }
    if (trimmed === item?.owner?.name) {
      setIsEditingName(false);
      return;
    }
    saveNameMutation.mutate(trimmed);
  };

  const isLocationOwner = item?.owner?.type === 'Location';

  async function onSaveSchedule(params: UpdateScheduleParams): Promise<void> {
    if (!oystehrZambda) {
      console.log('oystehr client is not defined');
      return;
    }
    if (createMode && scheduleType) {
      const ownerResourceType = getResource(scheduleType);
      if (!ownerId || !ownerResourceType || !params.schedule) {
        enqueueSnackbar('Schedule could not be created. Please reload the page and try again.', { variant: 'error' });
        return;
      }
      const createParams: CreateScheduleParams = {
        ...params,
        ownerId: ownerId,
        ownerType: ownerResourceType,
      } as CreateScheduleParams;
      createNewSchedule.mutate({ ...createParams });
    } else {
      saveScheduleChanges.mutate({ ...params });
    }
  }

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', state: { defaultTab: scheduleType }, children: 'Admin' },
                { link: '/admin/schedules', state: { defaultTab: scheduleType }, children: 'Schedules' },
                { link: '#', children: item?.owner?.name || <Skeleton width={150} /> },
              ]}
            />

            {isEditingName && isLocationOwner ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
                <TextField
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitName();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelEditName();
                    }
                  }}
                  size="small"
                  autoFocus
                  disabled={saveNameMutation.isPending}
                  sx={{ minWidth: 300, '& input': { fontSize: '2rem', fontWeight: 700 } }}
                />
                <LoadingButton
                  loading={saveNameMutation.isPending}
                  onClick={submitName}
                  color="primary"
                  aria-label="Save name"
                  sx={{ minWidth: 0, p: 1 }}
                >
                  <CheckIcon />
                </LoadingButton>
                <IconButton
                  onClick={cancelEditName}
                  disabled={saveNameMutation.isPending}
                  aria-label="Cancel name edit"
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
                <Typography variant="h3" color="primary.dark">
                  {item?.owner?.name || <Skeleton width={150} />}
                </Typography>
                {isLocationOwner && (
                  <IconButton onClick={startEditName} aria-label="Edit name" size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
            {item?.owner.detailText && (
              <Typography marginBottom={1} fontWeight={400}>
                {item.owner.detailText}
              </Typography>
            )}
            <TabContext value={tabName}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: createMode ? 'none' : 'block' }}>
                <TabList onChange={handleTabChange} aria-label="Tabs">
                  <Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  <Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }} />
                </TabList>
              </Box>
              <Paper
                sx={{
                  marginTop: 2,
                  border: 'none',
                  boxShadow: 'none',
                  background: 'none',
                }}
              >
                <TabPanel value="schedule" sx={{ padding: 0 }}>
                  {(scheduleId || createMode) && (
                    <ScheduleComponent
                      id={scheduleId || 'new'}
                      item={item}
                      loading={somethingIsLoadingInSomeWay}
                      update={onSaveSchedule}
                      hideOverrides={createMode}
                    />
                  )}
                </TabPanel>
                <TabPanel value="general">
                  <ScheduleGeneralTab
                    item={item}
                    onSchedulePersisted={setItem}
                    onSave={async (params) => {
                      await saveScheduleChanges.mutateAsync(params);
                    }}
                    isSaving={somethingIsLoadingInSomeWay}
                  />
                </TabPanel>
              </Paper>
            </TabContext>
          </Box>
        ) : (
          <Loading />
        )}
      </>
    </PageContainer>
  );
}
