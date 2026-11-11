import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { effectiveVisitTypes, expandProviderSchedule, validateTemplate } from 'utils/lib/provider-schedule/expand';
import { ProviderScheduleConfig } from 'utils/lib/provider-schedule/types';
import { resetMockProviderSchedules } from '../api/mockProviderScheduleApi';
import { ExceptionsEditor } from '../components/admin/ExceptionsEditor';
import { VisitTypeSettingsTable } from '../components/admin/VisitTypeSettingsTable';
import { WeeklyTemplateEditor } from '../components/admin/WeeklyTemplateEditor';
import { todayIn } from '../components/calendarTime';
import { CalendarView, ProviderCalendar } from '../components/ProviderCalendar';
import {
  useProviderAppointments,
  useProviderScheduleConfig,
  useSaveProviderScheduleConfig,
  useScheduleLocations,
  useScheduleProviders,
  useScheduleVisitTypes,
} from '../hooks/useProviderSchedule';
import { providerLabel } from './ProviderSchedulePage';

type AdminTab = 'template' | 'visit-types' | 'exceptions' | 'preview';

/** Admin → Provider schedules: build each provider's templates, visit-type rules and exceptions. */
export const ProviderScheduleAdminPage: FC = () => {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const providersQuery = useScheduleProviders();
  const locationsQuery = useScheduleLocations();
  const visitTypesQuery = useScheduleVisitTypes();
  const providers = providersQuery.data ?? [];
  const providerId = params.get('provider') ?? providers[0]?.id;
  const provider = providers.find((p) => p.id === providerId);
  const configQuery = useProviderScheduleConfig(providerId);
  const saveMutation = useSaveProviderScheduleConfig();

  const [draft, setDraft] = useState<ProviderScheduleConfig>();
  const [tab, setTab] = useState<AdminTab>('template');
  // Reset the draft whenever a different provider's config (or a fresh save) arrives.
  useEffect(() => setDraft(configQuery.data ? structuredClone(configQuery.data) : undefined), [configQuery.data]);

  const dirty = useMemo(
    () => Boolean(draft && configQuery.data && JSON.stringify(draft) !== JSON.stringify(configQuery.data)),
    [draft, configQuery.data]
  );
  const invalidTemplates = useMemo(
    () => (draft?.templates ?? []).filter((t) => validateTemplate(t).length > 0),
    [draft]
  );
  const providerVisitTypes = useMemo(
    () => (draft && visitTypesQuery.data ? effectiveVisitTypes(draft, visitTypesQuery.data) : []),
    [draft, visitTypesQuery.data]
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent): void => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const switchProvider = (id: string): void => {
    if (dirty && !window.confirm('Discard unsaved schedule changes for this provider?')) return;
    setParams({ provider: id }, { replace: true });
  };

  const save = async (): Promise<void> => {
    if (!draft) return;
    try {
      await saveMutation.mutateAsync(draft);
      enqueueSnackbar(`Saved ${provider ? providerLabel(provider) : 'schedule'}`, { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(`Could not save: ${(e as Error).message}`, { variant: 'error' });
    }
  };

  const loading = providersQuery.isLoading || visitTypesQuery.isLoading || locationsQuery.isLoading || !draft;

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Button
          size="small"
          onClick={() => {
            if (!window.confirm('Reset all demo schedules to the seeded examples?')) return;
            resetMockProviderSchedules();
            void queryClient.invalidateQueries({ queryKey: ['provider-schedule'] });
          }}
        >
          Reset demo data
        </Button>
        <Button
          variant="outlined"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => configQuery.data && setDraft(structuredClone(configQuery.data))}
        >
          Discard
        </Button>
        <LoadingButton
          variant="contained"
          disabled={!dirty || invalidTemplates.length > 0}
          loading={saveMutation.isPending}
          onClick={() => void save()}
        >
          Save changes
        </LoadingButton>
      </AdminHeaderActionSlot>

      <Alert severity="info" sx={{ mb: 2 }}>
        Preview: these screens use demo data stored in this browser. Saving doesn&apos;t change booking yet.
      </Alert>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Autocomplete
          size="small"
          sx={{ width: 300 }}
          options={providers}
          value={provider ?? null}
          getOptionLabel={providerLabel}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, p) => p && switchProvider(p.id)}
          disableClearable={Boolean(provider)}
          renderInput={(props) => <TextField {...props} label="Provider" />}
        />
        {provider && (
          <Button component={RouterLink} to={`/schedule?provider=${provider.id}`} size="small">
            Open provider calendar
          </Button>
        )}
        {dirty && (
          <Typography variant="body2" color="warning.dark" sx={{ ml: 'auto' }}>
            Unsaved changes
          </Typography>
        )}
      </Stack>

      {invalidTemplates.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Fix problems in {invalidTemplates.map((t) => `"${t.name || 'Untitled'}"`).join(', ')} before saving.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, t: AdminTab) => setTab(t)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="template" label="Weekly template" />
        <Tab value="visit-types" label="Visit types & durations" />
        <Tab value="exceptions" label="Time off & exceptions" />
        <Tab value="preview" label="Preview" />
      </Tabs>

      {loading || !provider ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tab === 'template' && (
            <WeeklyTemplateEditor
              key={provider.id}
              templates={draft.templates}
              locations={(locationsQuery.data ?? []).filter((l) => provider.locationIds.includes(l.id))}
              providerVisitTypes={providerVisitTypes}
              onChange={(templates) => setDraft({ ...draft, templates })}
            />
          )}
          {tab === 'visit-types' && (
            <VisitTypeSettingsTable
              visitTypes={visitTypesQuery.data ?? []}
              settings={draft.visitTypeSettings}
              onChange={(visitTypeSettings) => setDraft({ ...draft, visitTypeSettings })}
            />
          )}
          {tab === 'exceptions' && (
            <ExceptionsEditor
              providerId={provider.id}
              timezone={draft.timezone}
              exceptions={draft.exceptions}
              providerVisitTypes={providerVisitTypes}
              onChange={(exceptions) => setDraft({ ...draft, exceptions })}
            />
          )}
          {tab === 'preview' && <DraftPreview config={draft} />}
        </>
      )}
    </Box>
  );
};

/** The unsaved draft rendered against real bookings, so conflicts show before saving. */
const DraftPreview: FC<{ config: ProviderScheduleConfig }> = ({ config }) => {
  const visitTypesQuery = useScheduleVisitTypes();
  const [view, setView] = useState<CalendarView>('week');
  const [date, setDate] = useState(todayIn(config.timezone));
  const [range, setRange] = useState<{ startDate: string; endDate: string }>();
  const appointmentsQuery = useProviderAppointments(config.providerId, range?.startDate, range?.endDate);
  const blocks = useMemo(
    () => (range ? expandProviderSchedule(config, range.startDate, range.endDate) : []),
    [config, range]
  );
  const providerVisitTypes = useMemo(
    () => effectiveVisitTypes(config, visitTypesQuery.data ?? []),
    [config, visitTypesQuery.data]
  );

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your unsaved changes applied to existing bookings. Appointments with a dashed red outline would fall outside the
        new schedule.
      </Typography>
      <ProviderCalendar
        timezone={config.timezone}
        view={view}
        date={date}
        blocks={blocks}
        appointments={appointmentsQuery.data ?? []}
        visitTypes={visitTypesQuery.data ?? []}
        providerVisitTypes={providerVisitTypes}
        onNavigate={(next) => {
          setView(next.view);
          setDate(next.date);
        }}
        onRangeChange={setRange}
        height={view === 'month' ? 'auto' : 720}
      />
    </Box>
  );
};

export default ProviderScheduleAdminPage;
