import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Location, PractitionerRole, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPractitionerRole, listServiceCategories, setPractitionerRoleActive } from 'src/api/api';
import { getPractitionerRoleAllCategories, SCHEDULE_DISPLAY_NAME_EXTENSION_URL, TIMEZONES } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';

interface PractitionerRoleListProps {
  practitionerId: string;
  /** Display name of the provider — used to seed the default schedule name
   *  in the create-schedule dialog ("<Provider Name> @ <Location>"). */
  practitionerName: string;
}

interface ScheduleRow {
  role: PractitionerRole;
  location?: Location;
  schedule?: Schedule;
  categoryLabels: string[];
  /** User-facing label, e.g. "Intake — Main Clinic" or "Main Clinic". */
  displayLabel: string;
  /** PractitionerRole.active — `false` means soft-deleted; the row is kept in
   *  the list so an admin can reactivate without recreating from scratch. */
  active: boolean;
}

// Default label when an admin hasn't set a custom Name. Just the Location —
// services are already listed on the row below as "Services: …". Admins who
// have multiple schedules at the same location can name them explicitly to
// disambiguate.
function deriveDisplayLabel(locationName: string | undefined): string {
  return locationName || 'Unnamed location';
}

export default function PractitionerRoleList({
  practitionerId,
  practitionerName,
}: PractitionerRoleListProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<ScheduleRow | null>(null);

  const listQueryKey = ['practitioner-role-list', practitionerId];

  const { data, isLoading } = useQuery({
    queryKey: listQueryKey,
    queryFn: async (): Promise<{ rows: ScheduleRow[]; activeLocations: Location[] }> => {
      if (!oystehr) throw new Error('oystehr client not ready');
      const [roleBundle, locationBundle] = await Promise.all([
        oystehr.fhir.search<PractitionerRole | Location | Schedule>({
          resourceType: 'PractitionerRole',
          params: [
            { name: 'practitioner', value: `Practitioner/${practitionerId}` },
            { name: '_include', value: 'PractitionerRole:location' },
            { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
          ],
        }),
        oystehr.fhir.search<Location>({
          resourceType: 'Location',
          params: [{ name: 'status', value: 'active' }],
        }),
      ]);
      const resources = roleBundle.unbundle();
      // PRs without a Location reference are group-membership records (linking
      // a practitioner to a Group HealthcareService), not schedule-bearing PRs.
      // Skip those — they belong to the Group admin flow, not scheduling.
      // Inactive PRs (previously soft-deleted) are kept so an admin can flip
      // the row's status toggle back on instead of recreating from scratch.
      const roles = resources.filter(
        (r): r is PractitionerRole =>
          r.resourceType === 'PractitionerRole' && !!(r as PractitionerRole).location?.[0]?.reference
      );
      const includedLocations = resources.filter((r): r is Location => r.resourceType === 'Location');
      const schedules = resources.filter((r): r is Schedule => r.resourceType === 'Schedule');

      // Resolve category labels once.
      const categoriesResp = oystehrZambda
        ? await listServiceCategories(oystehrZambda).catch(() => ({ serviceCategories: [] }))
        : { serviceCategories: [] };
      const categoriesById = new Map<string, { code: string; name: string }>();
      for (const sc of categoriesResp.serviceCategories || []) {
        if ((sc as any).id) {
          categoriesById.set((sc as any).id, { code: sc.code, name: sc.name });
        }
      }

      const rows: ScheduleRow[] = roles.map((role) => {
        const locRef = role.location?.[0]?.reference;
        const location = includedLocations.find((l) => `Location/${l.id}` === locRef);
        const schedule = schedules.find((s) => s.actor?.some((a) => a.reference === `PractitionerRole/${role.id}`));
        // Always emit at least one label so downstream renderers can `.join()`
        // unconditionally — pre-toggle they fell back to "All services" on
        // empty, which was the old implicit-empty semantic and is now wrong
        // (empty + toggle off = offers nothing).
        const resolvedCategoryNames = (role.healthcareService || [])
          .map((ref) => {
            const id = ref.reference?.split('/')[1];
            if (!id) return undefined;
            return categoriesById.get(id)?.name;
          })
          .filter((n): n is string => !!n);
        const categoryLabels = getPractitionerRoleAllCategories(role)
          ? ['All services']
          : resolvedCategoryNames.length > 0
          ? resolvedCategoryNames
          : ['No services'];
        // Admin-set display name wins; fallback to the auto-derived label.
        const explicitName = (role.extension ?? [])
          .find((ext) => ext.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL)
          ?.valueString?.trim();
        return {
          role,
          location,
          schedule,
          categoryLabels,
          displayLabel: explicitName || deriveDisplayLabel(location?.name),
          active: role.active !== false,
        };
      });

      return { rows, activeLocations: locationBundle.unbundle() };
    },
    enabled: !!oystehr,
  });

  const createRole = useMutation({
    mutationFn: async (input: {
      locationId: string;
      categoryHealthcareServiceIds: string[];
      timezone: string;
      displayName?: string;
      allCategories?: boolean;
    }) => {
      if (!oystehrZambda) throw new Error('zambda client not ready');
      return createPractitionerRole(oystehrZambda, {
        practitionerId,
        locationId: input.locationId,
        categoryHealthcareServiceIds: input.categoryHealthcareServiceIds,
        timezone: input.timezone,
        displayName: input.displayName,
        allCategories: input.allCategories,
      });
    },
    onSuccess: ({ schedule }) => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      setDialogOpen(false);
      // Drop the admin straight into the editor for the new schedule — no
      // separate "ok now configure it" step.
      if (schedule.id) {
        navigate(`/admin/schedule/id/${schedule.id}`);
      }
    },
    onError: (err) => {
      console.error(err);
      // Conflict errors carry a useful, admin-friendly message from the zambda
      // — surface it directly. Generic catch-all otherwise.
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
          ? (err as any).message
          : 'Failed to create schedule.';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  type ListQueryData = { rows: ScheduleRow[]; activeLocations: Location[] };

  const setActive = useMutation({
    mutationFn: async ({ roleId, active }: { roleId: string; active: boolean }) => {
      if (!oystehrZambda) throw new Error('zambda client not ready');
      return setPractitionerRoleActive(oystehrZambda, { roleId, active });
    },
    // Optimistically flip the row's active state in the cache so the Switch
    // updates the instant the user clicks. If the request fails, onError
    // rolls back to the snapshot we take here.
    onMutate: async ({ roleId, active }) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const snapshot = queryClient.getQueryData<ListQueryData>(listQueryKey);
      if (snapshot) {
        queryClient.setQueryData<ListQueryData>(listQueryKey, {
          ...snapshot,
          rows: snapshot.rows.map((r) => (r.role.id === roleId ? { ...r, active } : r)),
        });
      }
      return { snapshot };
    },
    onSuccess: (_data, variables) => {
      enqueueSnackbar(variables.active ? 'Schedule activated.' : 'Schedule deactivated.', { variant: 'success' });
      setPendingDeactivate(null);
    },
    onError: (err, variables, context) => {
      console.error(err);
      if (context?.snapshot) {
        queryClient.setQueryData(listQueryKey, context.snapshot);
      }
      enqueueSnackbar(variables.active ? 'Failed to activate schedule.' : 'Failed to deactivate schedule.', {
        variant: 'error',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
  });

  // Activation is cheap and fully reversible, so it fires straight from the
  // switch. Deactivation goes through the confirmation dialog below — it's
  // soft, but it pulls a schedule out of bookable circulation immediately and
  // we want an explicit "are you sure" before that happens.
  const handleToggleActive = (row: ScheduleRow, nextActive: boolean): void => {
    if (!row.role.id) return;
    if (nextActive) {
      setActive.mutate({ roleId: row.role.id, active: true });
    } else {
      setPendingDeactivate(row);
    }
  };

  if (isLoading || !data) {
    return (
      <Paper sx={{ padding: 3, marginTop: 3 }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }

  const rows = data.rows;
  const activeLocations = data.activeLocations;
  const headerLabel = rows.length === 1 ? 'Schedule' : 'Schedules';

  // Single-Location org + zero schedules → one-click setup. The admin doesn't
  // need to pick a Location since there's only one.
  // Defaults to allCategories=true so the resulting PR is immediately
  // bookable for every service. Without the toggle the empty
  // healthcareService[] would mean "offers nothing" under the explicit
  // semantic, defeating the "one click and you're scheduling" intent.
  // Admin can narrow categories later via the schedule edit page.
  const handleSetUpFastPath = (): void => {
    if (activeLocations.length === 1) {
      createRole.mutate({
        locationId: activeLocations[0].id!,
        categoryHealthcareServiceIds: [],
        timezone: TIMEZONES[0],
        allCategories: true,
      });
    } else {
      setDialogOpen(true);
    }
  };

  return (
    <Paper sx={{ padding: 3, marginTop: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
          {headerLabel}
        </Typography>
        {rows.length === 0 ? (
          <Button variant="contained" onClick={handleSetUpFastPath} disabled={createRole.isPending}>
            Set up scheduling
          </Button>
        ) : (
          <Button variant="outlined" onClick={() => setDialogOpen(true)}>
            Add another schedule
          </Button>
        )}
      </Box>

      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          No schedule configured yet. Click <strong>Set up scheduling</strong> to create one.
        </Typography>
      )}

      {rows.length > 0 && (
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Schedule</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Services</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '12%' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '12%' }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.role.id} sx={{ opacity: row.active ? 1 : 0.6 }}>
                <TableCell sx={{ color: row.active ? 'text.primary' : 'text.disabled' }}>{row.displayLabel}</TableCell>
                <TableCell>{row.categoryLabels.join(', ')}</TableCell>
                <TableCell>
                  <ScheduleStatusToggle
                    row={row}
                    onToggle={handleToggleActive}
                    disabled={setActive.isPending && setActive.variables?.roleId === row.role.id}
                  />
                </TableCell>
                <TableCell align="right">
                  {row.schedule?.id ? (
                    <Tooltip title="Edit schedule">
                      <IconButton size="small" component={Link} to={`/admin/schedule/id/${row.schedule.id}`}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="error">
                      missing
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={(loc, categoryIds, tz, name, allCategories) =>
          createRole.mutate({
            locationId: loc,
            categoryHealthcareServiceIds: categoryIds,
            timezone: tz,
            displayName: name,
            allCategories,
          })
        }
        isSubmitting={createRole.isPending}
        practitionerName={practitionerName}
      />

      <Dialog open={!!pendingDeactivate} onClose={() => !setActive.isPending && setPendingDeactivate(null)}>
        <DialogTitle>Deactivate schedule?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will deactivate{' '}
            <strong>
              {pendingDeactivate?.location?.name || 'this schedule'}
              {pendingDeactivate?.categoryLabels.length ? ` (${pendingDeactivate.categoryLabels.join(', ')})` : ''}
            </strong>
            . Past appointments and encounters that referenced this schedule are preserved; it just stops appearing as a
            bookable option going forward. You can switch it back on at any time.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeactivate(null)} disabled={setActive.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={setActive.isPending}
            onClick={() =>
              pendingDeactivate?.role.id && setActive.mutate({ roleId: pendingDeactivate.role.id, active: false })
            }
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

interface ScheduleStatusToggleProps {
  row: ScheduleRow;
  onToggle: (row: ScheduleRow, nextActive: boolean) => void;
  disabled: boolean;
}

function ScheduleStatusToggle({ row, onToggle, disabled }: ScheduleStatusToggleProps): ReactElement {
  return (
    <Tooltip title={row.active ? 'Deactivate schedule' : 'Activate schedule'}>
      <Switch
        size="small"
        checked={row.active}
        onChange={(e) => onToggle(row, e.target.checked)}
        disabled={disabled}
        inputProps={{ 'aria-label': row.active ? 'Deactivate schedule' : 'Activate schedule' }}
      />
    </Tooltip>
  );
}

interface AddScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    locationId: string,
    categoryHealthcareServiceIds: string[],
    timezone: string,
    displayName: string,
    allCategories: boolean
  ) => void;
  isSubmitting: boolean;
  practitionerName: string;
}

function AddScheduleDialog({
  open,
  onClose,
  onCreate,
  isSubmitting,
  practitionerName,
}: AddScheduleDialogProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const [location, setLocation] = useState<Location | null>(null);
  const [categoryHsIds, setCategoryHsIds] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<boolean>(false);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  const [scheduleName, setScheduleName] = useState<string>('');
  // Track whether the admin has manually typed in the Name field. While
  // false, Name auto-fills from the practitioner + selected location so the
  // admin sees a sensible default. As soon as they type, the auto-fill
  // backs off and respects their edit.
  const [nameEditedManually, setNameEditedManually] = useState<boolean>(false);

  // Reset fields when the dialog reopens so prior selections don't leak.
  useEffect(() => {
    if (open) {
      setLocation(null);
      setCategoryHsIds([]);
      setAllCategories(false);
      setTimezone(TIMEZONES[0]);
      setScheduleName(`${practitionerName} Schedule`);
      setNameEditedManually(false);
    }
  }, [open, practitionerName]);

  // Live-update the default name as the location changes, until the admin
  // edits the field manually.
  useEffect(() => {
    if (!open || nameEditedManually) return;
    setScheduleName(location?.name ? `${practitionerName} @ ${location.name}` : `${practitionerName} Schedule`);
  }, [location, practitionerName, open, nameEditedManually]);

  const { data: locations } = useQuery({
    queryKey: ['add-schedule-locations'],
    queryFn: async (): Promise<Location[]> => {
      if (!oystehr) return [];
      const bundle = await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: 'status', value: 'active' }],
      });
      return bundle.unbundle();
    },
    enabled: open && !!oystehr,
  });

  const { data: categories } = useQuery({
    queryKey: ['add-schedule-categories'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      try {
        return await listServiceCategories(oystehrZambda);
      } catch {
        return { serviceCategories: [] };
      }
    },
    enabled: open && !!oystehrZambda,
  });

  const categoryOptions = (categories?.serviceCategories || []).filter((sc: any) => sc.id);

  const handleCreate = (): void => {
    if (!location?.id) return;
    // When the "Offers all services" toggle is on, send an empty
    // categoryHealthcareServiceIds list — the toggle alone qualifies the role
    // for every service, and there's no reason to also pin specific HS refs.
    onCreate(location.id, allCategories ? [] : categoryHsIds, timezone, scheduleName, allCategories);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add another schedule</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Autocomplete
            options={locations ?? []}
            getOptionLabel={(opt) => opt.name || 'Unnamed'}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, opt) => (
              <li {...props} key={opt.id}>
                {opt.name || 'Unnamed'}
              </li>
            )}
            value={location}
            onChange={(_e, v) => setLocation(v)}
            renderInput={(params) => <TextField {...params} label="Location" required />}
          />
          <TextField
            label="Name"
            required
            value={scheduleName}
            onChange={(e) => {
              setScheduleName(e.target.value);
              setNameEditedManually(true);
            }}
          />
          <FormControlLabel
            control={<Checkbox checked={allCategories} onChange={(e) => setAllCategories(e.target.checked)} />}
            label="Offers all services"
            sx={{ alignSelf: 'flex-start' }}
          />
          <Autocomplete
            multiple
            disableCloseOnSelect
            disabled={allCategories}
            options={categoryOptions.map((c: any) => c.id as string)}
            value={allCategories ? [] : categoryHsIds}
            onChange={(_e, v) => setCategoryHsIds(v)}
            getOptionLabel={(id) => {
              const hit = categoryOptions.find((c: any) => c.id === id);
              return hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id;
            }}
            renderOption={(props, id) => {
              const selected = categoryHsIds.includes(id);
              const hit = categoryOptions.find((c: any) => c.id === id);
              return (
                <li {...props} key={id}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Services"
                helperText={
                  allCategories
                    ? 'Toggle off "Offers all services" to choose specific services'
                    : 'Pick the specific services this role offers'
                }
              />
            )}
          />
          <Autocomplete
            options={TIMEZONES as unknown as string[]}
            value={timezone}
            onChange={(_e, v) => v && setTimezone(v)}
            renderInput={(params) => <TextField {...params} label="Timezone" />}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!location || !scheduleName.trim() || isSubmitting} onClick={handleCreate}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
