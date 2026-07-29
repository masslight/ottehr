import { Add } from '@mui/icons-material';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APIError, isApiError, ProviderGroupListItem } from 'utils';
import { useErrorQuery } from 'utils/lib/frontend';
import { listProviderGroups } from '../api/api';
import { BooleanStateChip } from '../components/BooleanStateChip';
import Loading from '../components/Loading';
import { useApiClients } from '../hooks/useAppClients';

type StatusFilter = 'all' | 'active' | 'inactive';

const poolLabel = (group: ProviderGroupListItem): string => {
  if (group.poolsAllProviders) return 'All active providers';
  if (group.locationNames.length === 0) return 'No locations';
  return group.locationNames.join(', ');
};

export default function ProviderGroupsPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['provider-groups'],
    queryFn: () => (oystehrZambda ? listProviderGroups(oystehrZambda) : null),
    enabled: !!oystehrZambda,
  });

  useErrorQuery(error, (err) => {
    if (err) {
      enqueueSnackbar({
        message: isApiError(err) ? (err as APIError).message : 'Error fetching provider groups',
        variant: 'error',
      });
    }
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.groups ?? []).filter((group) => {
      if (q && !group.name.toLowerCase().includes(q) && !group.locationNames.some((n) => n.toLowerCase().includes(q))) {
        return false;
      }
      if (statusFilter === 'active') return group.active;
      if (statusFilter === 'inactive') return !group.active;
      return true;
    });
  }, [data, search, statusFilter]);

  const loading = isLoading || isFetching;

  return (
    <Box sx={{ marginTop: 2 }}>
      <Paper sx={{ padding: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
          Provider groups let patients book across several providers at once. A group pools availability — from every
          active provider, or just the providers at the locations you choose — and can limit which services are bookable
          through it. Use them to shape booking patterns like a shared walk-in queue or a service-specific pool: a
          patient booking through the group&apos;s link is matched to any available provider in the pool.
        </Typography>

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
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            sx={{ width: 160 }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/provider-groups/add')}>
            Add group
          </Button>
          {loading && (
            <Box sx={{ marginLeft: 'auto' }}>
              <Loading />
            </Box>
          )}
        </Box>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          <Table stickyHeader sx={{ minWidth: 650 }} aria-label="provider groups table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Pool</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Services</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((group) => (
                <TableRow
                  key={group.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/group/id/${group.id}`)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Groups2OutlinedIcon fontSize="small" color="action" />
                      <Typography color="primary">{group.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{poolLabel(group)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {group.providerCount} provider{group.providerCount === 1 ? '' : 's'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={group.serviceLabels.length ? 'text.primary' : 'text.secondary'}>
                      {group.serviceLabels.length ? group.serviceLabels.join(', ') : 'All services'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <BooleanStateChip state={group.active} label={group.active ? 'Active' : 'Inactive'} />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography sx={{ py: 2, textAlign: 'center' }} color="text.secondary">
                      No provider groups match your filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
