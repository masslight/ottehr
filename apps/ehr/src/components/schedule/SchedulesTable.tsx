import { Add } from '@mui/icons-material';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { Fragment, ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorQuery } from 'utils/lib/frontend';
import { ScheduleListItem, SchedulesAndOwnerListItem } from 'utils/lib/types/api/schedules';
import { APIError, isApiError } from 'utils/lib/types/errors';
import { listScheduleOwners } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { BooleanStateChip } from '../BooleanStateChip';
import Loading from '../Loading';

type OwnerTypeFilter = 'all' | 'location' | 'provider';
type ActiveFilter = 'all' | 'active' | 'inactive';

const hoursText = (schedule?: ScheduleListItem): string => {
  if (!schedule?.todayHoursISO) {
    return 'No scheduled hours';
  }
  const { open, close } = schedule.todayHoursISO;
  const openTime = DateTime.fromISO(open).setZone(schedule.timezone);
  const closeTime = DateTime.fromISO(close).setZone(schedule.timezone);
  if (openTime.isValid && closeTime.isValid) {
    return `${openTime.toFormat('h:mm a')} – ${closeTime.toFormat('h:mm a')}`;
  }
  return 'No scheduled hours';
};

// A Location schedule is live only if the Location is active AND its Schedule is
// active; a Location with no schedule yet falls back to its own status.
const locationEffectiveActive = (item: SchedulesAndOwnerListItem): boolean =>
  item.owner.active === true && (item.schedules[0]?.active ?? true) !== false;

type Row =
  | { kind: 'location'; sortName: string; item: SchedulesAndOwnerListItem; active: boolean }
  | { kind: 'provider'; sortName: string; item: SchedulesAndOwnerListItem; children: ScheduleListItem[] };

export function SchedulesTable(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<OwnerTypeFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Location- and provider-owned schedules are fetched in parallel but resolved
  // as ONE query, so the table paints the full list in a single pass instead of
  // popping in providers first, then locations.
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['schedule-list', 'combined'],
    queryFn: async () => {
      if (!oystehrZambda) return null;
      const [locations, providers] = await Promise.all([
        listScheduleOwners({ ownerType: 'Location' }, oystehrZambda),
        listScheduleOwners({ ownerType: 'Practitioner' }, oystehrZambda),
      ]);
      return { locations, providers };
    },
    enabled: !!oystehrZambda,
  });

  useErrorQuery(error, (err) => {
    if (err) {
      enqueueSnackbar({
        message: isApiError(err) ? (err as APIError).message : 'Error fetching schedules',
        variant: 'error',
      });
    }
  });

  const loading = isLoading || isFetching;

  const toggleExpanded = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows = useMemo<Row[]>(() => {
    const q = search.trim().toLowerCase();
    const matches = (text: string | undefined): boolean => !q || (text ?? '').toLowerCase().includes(q);
    const activeMatches = (isActive: boolean): boolean =>
      activeFilter === 'all' || (activeFilter === 'active' ? isActive : !isActive);

    const result: Row[] = [];

    if (ownerTypeFilter !== 'provider') {
      for (const item of data?.locations.list ?? []) {
        // The list is per-schedule: a Location with no schedule isn't a row (same
        // as a provider with none). Create one via "Add schedule" → Location.
        if (item.schedules.length === 0) continue;
        if (!matches(item.owner.name)) continue;
        const active = locationEffectiveActive(item);
        if (!activeMatches(active)) continue;
        result.push({ kind: 'location', sortName: item.owner.name, item, active });
      }
    }

    if (ownerTypeFilter !== 'location') {
      for (const item of data?.providers.list ?? []) {
        const ownerMatch = matches(item.owner.name);
        const anyLocationMatch = item.schedules.some((s) => matches(s.locationName));
        if (!ownerMatch && !anyLocationMatch) continue;
        // Filter the provider's child schedules by the active filter; drop the
        // provider entirely if nothing survives.
        const children = item.schedules.filter((s) => activeMatches(s.active !== false));
        if (children.length === 0) continue;
        result.push({ kind: 'provider', sortName: item.owner.name, item, children });
      }
    }

    return result.sort((a, b) => a.sortName.localeCompare(b.sortName));
  }, [data, search, ownerTypeFilter, activeFilter]);

  // Location rows always have a schedule now (schedule-less ones are filtered out
  // above), so this always links to the schedule's page.
  const locationLink = (item: SchedulesAndOwnerListItem): string => `/admin/schedule/id/${item.schedules[0].id}`;

  return (
    <Paper sx={{ padding: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ endAdornment: <SearchIcon /> }}
        />
        <TextField
          select
          label="Type"
          size="small"
          value={ownerTypeFilter}
          onChange={(e) => setOwnerTypeFilter(e.target.value as OwnerTypeFilter)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">All types</MenuItem>
          <MenuItem value="location">Locations</MenuItem>
          <MenuItem value="provider">Providers</MenuItem>
        </TextField>
        <TextField
          select
          label="Status"
          size="small"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          sx={{ width: 160 }}
        >
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/schedule/add')}>
          Add schedule
        </Button>
        {loading && (
          <Box sx={{ marginLeft: 'auto' }}>
            <Loading />
          </Box>
        )}
      </Box>

      <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
        <Table stickyHeader sx={{ minWidth: 650 }} aria-label="schedules table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 'bold', width: '45%' }}>Owner</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Today&apos;s hours</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Status</TableCell>
              <TableCell sx={{ width: 96 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              if (row.kind === 'location') {
                const { item, active } = row;
                return (
                  <TableRow
                    key={item.owner.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(locationLink(item))}
                  >
                    <TableCell />
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ApartmentOutlinedIcon fontSize="small" color="action" />
                        <Typography color="primary">{item.owner.name || '-'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{hoursText(item.schedules[0])}</TableCell>
                    <TableCell>
                      <BooleanStateChip state={active} label={active ? 'Active' : 'Inactive'} />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                );
              }

              // provider row (expandable)
              const { item, children } = row;
              const isOpen = expanded.has(item.owner.id);
              return (
                <Fragment key={item.owner.id}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleExpanded(item.owner.id)}>
                    <TableCell>
                      <IconButton size="small" aria-label={isOpen ? 'collapse' : 'expand'}>
                        {isOpen ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonOutlineOutlinedIcon fontSize="small" color="action" />
                        <Typography color="primary">{item.owner.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {children.length} schedule{children.length === 1 ? '' : 's'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                    {/* Active is a per-schedule fact for providers — shown on each child row.
                        A provider has no single active state, so leave the parent cell blank. */}
                    <TableCell />
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Manage provider">
                          <IconButton
                            size="small"
                            aria-label={`manage ${item.owner.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // owner.id is the Practitioner id; the provider
                              // route resolves it to the User id on the way to
                              // the employee editor's schedule section.
                              navigate(`/admin/provider/${item.owner.id}#schedule`);
                            }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add schedule">
                          <IconButton
                            size="small"
                            aria-label={`add schedule for ${item.owner.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/schedule/add?provider=${item.owner.id}`);
                            }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {isOpen &&
                    children.map((child) => {
                      const childActive = child.active !== false;
                      return (
                        <TableRow
                          key={child.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/schedule/id/${child.id}`)}
                        >
                          <TableCell />
                          <TableCell sx={{ pl: 6 }}>
                            <Typography color="primary">· {child.locationName ?? 'Unassigned location'}</Typography>
                            {child.categoryLabels && child.categoryLabels.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {child.categoryLabels.join(', ')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{hoursText(child)}</TableCell>
                          <TableCell>
                            <BooleanStateChip state={childActive} label={childActive ? 'Active' : 'Inactive'} />
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}
                </Fragment>
              );
            })}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography sx={{ py: 2, textAlign: 'center' }} color="text.secondary">
                    No schedules match your filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
