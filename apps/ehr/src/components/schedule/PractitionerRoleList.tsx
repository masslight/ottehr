import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Location, PractitionerRole, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { listServiceCategories } from 'src/api/api';
import { BLANK_SCHEDULE_JSON_TEMPLATE, SCHEDULE_EXTENSION_URL, TIMEZONE_EXTENSION_URL, TIMEZONES } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';

interface PractitionerRoleListProps {
  practitionerId: string;
}

interface RoleRow {
  role: PractitionerRole;
  location?: Location;
  schedule?: Schedule;
  categoryLabels: string[];
}

export default function PractitionerRoleList({ practitionerId }: PractitionerRoleListProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all PractitionerRoles for this Practitioner, plus their referenced
  // Locations and the Schedules whose actor is one of those roles. Single
  // batch request keeps the page snappy.
  const { data, isLoading } = useQuery({
    queryKey: ['practitioner-role-list', practitionerId],
    queryFn: async (): Promise<{
      rows: RoleRow[];
      categoriesById: Map<string, { code: string; name: string }>;
    }> => {
      if (!oystehr) throw new Error('oystehr client not ready');
      const bundle = await oystehr.fhir.search<PractitionerRole | Location | Schedule>({
        resourceType: 'PractitionerRole',
        params: [
          { name: 'practitioner', value: `Practitioner/${practitionerId}` },
          { name: '_include', value: 'PractitionerRole:location' },
          { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
        ],
      });
      const resources = bundle.unbundle();
      const roles = resources.filter((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
      const locations = resources.filter((r): r is Location => r.resourceType === 'Location');
      const schedules = resources.filter((r): r is Schedule => r.resourceType === 'Schedule');

      // Resolve category-tagged HealthcareService names once so we can label
      // each role's offered categories in the table.
      const categoriesResp = oystehrZambda
        ? await listServiceCategories(oystehrZambda).catch(() => ({ serviceCategories: [] }))
        : { serviceCategories: [] };
      const categoriesById = new Map<string, { code: string; name: string }>();
      for (const sc of categoriesResp.serviceCategories || []) {
        if ((sc as any).id) {
          categoriesById.set((sc as any).id, { code: sc.code, name: sc.name });
        }
      }

      const rows: RoleRow[] = roles.map((role) => {
        const locRef = role.location?.[0]?.reference;
        const location = locations.find((l) => `Location/${l.id}` === locRef);
        const schedule = schedules.find((s) => s.actor?.some((a) => a.reference === `PractitionerRole/${role.id}`));
        const categoryLabels = (role.healthcareService || [])
          .map((ref) => {
            const id = ref.reference?.split('/')[1];
            if (!id) return undefined;
            return categoriesById.get(id)?.name;
          })
          .filter((n): n is string => !!n);
        return { role, location, schedule, categoryLabels };
      });
      return { rows, categoriesById };
    },
    enabled: !!oystehr,
  });

  const createRole = useMutation({
    mutationFn: async (input: { locationId: string; categoryHealthcareServiceIds: string[]; timezone: string }) => {
      if (!oystehr) throw new Error('oystehr client not ready');
      // 1. Create PractitionerRole binding practitioner + location + categories.
      const role = await oystehr.fhir.create<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: `Practitioner/${practitionerId}` },
        location: [{ reference: `Location/${input.locationId}` }],
        healthcareService: input.categoryHealthcareServiceIds.map((id) => ({
          reference: `HealthcareService/${id}`,
        })),
      });
      // 2. Create a blank Schedule whose actor is the role.
      const schedule = await oystehr.fhir.create<Schedule>({
        resourceType: 'Schedule',
        active: true,
        actor: [{ reference: `PractitionerRole/${role.id}` }],
        extension: [
          { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(BLANK_SCHEDULE_JSON_TEMPLATE) },
          { url: TIMEZONE_EXTENSION_URL, valueString: input.timezone },
        ],
      });
      return { role, schedule };
    },
    onSuccess: () => {
      enqueueSnackbar('Role created — open its schedule to set working hours and capacity.', {
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['practitioner-role-list', practitionerId] });
      setDialogOpen(false);
    },
    onError: (err) => {
      console.error(err);
      enqueueSnackbar('Failed to create role.', { variant: 'error' });
    },
  });

  if (isLoading || !data) {
    return (
      <Paper sx={{ padding: 3, marginTop: 3 }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ padding: 3, marginTop: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
          Provider schedules (per location)
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          Add role at location
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
        A provider can have one role per location, each with its own set of offered service categories and its own
        schedule. Bookings made through a role are attributed to the role's location for billing and tracking.
      </Typography>

      {data.rows.length === 0 ? (
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          No roles yet. Click "Add role at location" to create the first one.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Service Categories</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Schedule</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.rows.map(({ role, location, schedule, categoryLabels }) => (
              <TableRow key={role.id}>
                <TableCell>{location?.name || <em>unknown</em>}</TableCell>
                <TableCell>{categoryLabels.length > 0 ? categoryLabels.join(', ') : <em>none</em>}</TableCell>
                <TableCell>
                  {schedule?.id ? (
                    <Link to={`/admin/schedule/id/${schedule.id}`}>Edit schedule</Link>
                  ) : (
                    <em>missing</em>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddRoleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={(loc, categoryIds, tz) =>
          createRole.mutate({ locationId: loc, categoryHealthcareServiceIds: categoryIds, timezone: tz })
        }
        isSubmitting={createRole.isPending}
      />
    </Paper>
  );
}

interface AddRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (locationId: string, categoryHealthcareServiceIds: string[], timezone: string) => void;
  isSubmitting: boolean;
}

function AddRoleDialog({ open, onClose, onCreate, isSubmitting }: AddRoleDialogProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const [location, setLocation] = useState<Location | null>(null);
  const [categoryHsIds, setCategoryHsIds] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);

  const { data: locations } = useQuery({
    queryKey: ['add-role-locations'],
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
    queryKey: ['add-role-categories'],
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
    onCreate(location.id, categoryHsIds, timezone);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add role at location</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Autocomplete
            options={locations ?? []}
            getOptionLabel={(opt) => opt.name || 'Unnamed'}
            value={location}
            onChange={(_e, v) => setLocation(v)}
            renderInput={(params) => <TextField {...params} label="Location" required />}
          />
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={categoryOptions.map((c: any) => c.id as string)}
            value={categoryHsIds}
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
            renderInput={(params) => <TextField {...params} label="Service Categories" />}
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
        <Button variant="contained" disabled={!location || isSubmitting} onClick={handleCreate}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
