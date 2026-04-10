import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import SearchIcon from '@mui/icons-material/Search';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
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
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { ChargeItemDefinition, Location } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useMemo } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  useCmAssociateLocationMutation,
  useCmDisassociateLocationMutation,
} from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  useAssociateLocationMutation,
  useDisassociateLocationMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { isLocationVirtual } from 'utils';
import { ChargeItemMode } from '../ChargeItemList';

const VENUE_USE_CONTEXT_CODE = 'venue';

function getLocationDisplayName(loc: Location): string {
  if (loc.name) return loc.name;
  if (loc.address?.state) return `Virtual — ${loc.address.state}`;
  return loc.id || 'Unknown';
}

function getLocationType(loc: Location): 'virtual' | 'physical' {
  return isLocationVirtual(loc) ? 'virtual' : 'physical';
}

function useScheduleOwnerLocationsQuery(): UseQueryResult<Location[], Error> {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: ['schedule-owner-locations'],

    queryFn: async () => {
      const resources = await oystehr!.fhir.search<Location>({
        resourceType: 'Location',
        params: [
          {
            name: '_count',
            value: '1000',
          },
        ],
      });

      return resources
        .unbundle()
        .filter((loc) => loc.status !== 'inactive')
        .sort((a, b) => getLocationDisplayName(a).localeCompare(getLocationDisplayName(b)));
    },

    enabled: !!oystehr,
  });
}

interface LocationAssociationsProps {
  feeSchedule: ChargeItemDefinition | undefined;
  isFetching: boolean;
  mode?: ChargeItemMode;
}

export default function LocationAssociations({
  feeSchedule,
  isFetching,
  mode = 'fee-schedule',
}: LocationAssociationsProps): ReactElement {
  const isChargeMaster = mode === 'charge-master';
  const queryKey = isChargeMaster ? 'charge-masters' : 'fee-schedules';
  const [searchText, setSearchText] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedLocations, setSelectedLocations] = React.useState<Location[]>([]);
  const [dialogSearch, setDialogSearch] = React.useState('');

  const queryClient = useQueryClient();
  const { data: allLocations, isPending: locationsLoading } = useScheduleOwnerLocationsQuery();
  const fsAssociate = useAssociateLocationMutation();
  const fsDisassociate = useDisassociateLocationMutation();
  const cmAssociate = useCmAssociateLocationMutation();
  const cmDisassociate = useCmDisassociateLocationMutation();
  const { mutateAsync: associateLocation, isPending: associating } = isChargeMaster ? cmAssociate : fsAssociate;
  const { mutateAsync: disassociateLocation, isPending: disassociating } = isChargeMaster
    ? cmDisassociate
    : fsDisassociate;

  // Extract currently associated location IDs from useContext (venue type)
  const associatedLocationIds = useMemo(() => {
    if (!feeSchedule?.useContext) return [];
    return feeSchedule.useContext
      .filter((uc) => uc.code?.code === VENUE_USE_CONTEXT_CODE && uc.valueReference?.reference?.startsWith('Location/'))
      .map((uc) => uc.valueReference!.reference!.replace('Location/', ''));
  }, [feeSchedule?.useContext]);

  // Build list of associated locations with details
  const associatedLocations = useMemo(() => {
    return associatedLocationIds.map((locId) => {
      const loc = allLocations?.find((l) => l.id === locId);
      return {
        id: locId,
        name: loc ? getLocationDisplayName(loc) : locId,
        description: loc?.description || '',
        type: loc ? getLocationType(loc) : ('physical' as const),
      };
    });
  }, [associatedLocationIds, allLocations]);

  // Filter associated locations by search text
  const filteredLocations = useMemo(() => {
    if (!searchText) return associatedLocations;
    const lower = searchText.toLowerCase();
    return associatedLocations.filter(
      (l) =>
        l.name.toLowerCase().includes(lower) ||
        l.description.toLowerCase().includes(lower) ||
        l.id.toLowerCase().includes(lower)
    );
  }, [associatedLocations, searchText]);

  // Available locations for the dialog (not already associated)
  const availableLocations = useMemo(() => {
    if (!allLocations) return [];
    return allLocations.filter((loc) => loc.id && !associatedLocationIds.includes(loc.id));
  }, [allLocations, associatedLocationIds]);

  // Filter available locations by dialog search text
  const filteredAvailableLocations = useMemo(() => {
    if (!dialogSearch) return availableLocations;
    const lower = dialogSearch.toLowerCase();
    return availableLocations.filter((loc) => {
      const name = getLocationDisplayName(loc).toLowerCase();
      const desc = (loc.description || '').toLowerCase();
      return name.includes(lower) || desc.includes(lower) || (loc.id || '').toLowerCase().includes(lower);
    });
  }, [availableLocations, dialogSearch]);

  const toggleLocation = (loc: Location): void => {
    setSelectedLocations((prev) => {
      const isSelected = prev.some((l) => l.id === loc.id);
      return isSelected ? prev.filter((l) => l.id !== loc.id) : [...prev, loc];
    });
  };

  const handleAssociate = async (): Promise<void> => {
    if (!feeSchedule?.id || selectedLocations.length === 0) return;
    try {
      for (const loc of selectedLocations) {
        if (!loc.id) continue;
        const idParam = isChargeMaster
          ? { chargeMasterId: feeSchedule.id, locationId: loc.id }
          : { feeScheduleId: feeSchedule.id, locationId: loc.id };
        await associateLocation(idParam as any);
      }
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      const names = selectedLocations.map((l) => getLocationDisplayName(l)).join(', ');
      enqueueSnackbar(`Associated ${names}`, { variant: 'success' });
      setDialogOpen(false);
      setSelectedLocations([]);
    } catch {
      enqueueSnackbar('Error associating location(s). Please try again.', { variant: 'error' });
    }
  };

  const handleDisassociate = async (locId: string, locName: string): Promise<void> => {
    if (!feeSchedule?.id) return;
    try {
      const idParam = isChargeMaster
        ? { chargeMasterId: feeSchedule.id, locationId: locId }
        : { feeScheduleId: feeSchedule.id, locationId: locId };
      await disassociateLocation(idParam as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`Removed ${locName}`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Error removing location association. Please try again.', { variant: 'error' });
    }
  };

  if (isFetching) {
    return <Skeleton height={300} sx={{ marginY: -5 }} />;
  }

  if (!feeSchedule) {
    return <></>;
  }

  const entityLabel = isChargeMaster ? 'charge master' : 'fee schedule';

  return (
    <>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important', mb: 1 }}>
          Location Associations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Associate locations with this {entityLabel}. When a location is associated, this {entityLabel} will apply to
          visits at that location.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search associated locations..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 28 }}
            onClick={() => setDialogOpen(true)}
          >
            Add location
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Location Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {associatedLocations.length === 0
                      ? `No location associations yet. Click "Add location" to associate a location with this ${entityLabel}.`
                      : 'No matching locations found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map((loc) => (
                  <TableRow key={loc.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {locationsLoading && !loc.name ? (
                          <Skeleton width={180} />
                        ) : (
                          <>
                            {loc.type === 'virtual' ? (
                              <VideocamIcon fontSize="small" color="info" />
                            ) : (
                              <PlaceIcon fontSize="small" color="action" />
                            )}
                            {loc.name}
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {loc.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {loc.type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove association">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDisassociate(loc.id, loc.name)}
                          disabled={disassociating}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { height: '70vh' } }}
      >
        <DialogTitle>Associate Locations</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Select locations to associate with this {entityLabel}.
            {selectedLocations.length > 0 && <strong> ({selectedLocations.length} selected)</strong>}
          </Typography>
          <TextField
            size="small"
            placeholder="Filter by name..."
            value={dialogSearch}
            onChange={(e) => setDialogSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 1 }}
          />
          {locationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredAvailableLocations.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {dialogSearch ? 'No matching locations.' : 'No available locations.'}
            </Typography>
          ) : (
            <List
              dense
              sx={{ flex: 1, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              {filteredAvailableLocations.map((loc) => {
                const isSelected = selectedLocations.some((l) => l.id === loc.id);
                const locType = getLocationType(loc);
                return (
                  <ListItemButton key={loc.id} onClick={() => toggleLocation(loc)} dense>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={isSelected} disableRipple size="small" />
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {locType === 'virtual' ? (
                        <VideocamIcon fontSize="small" color="info" />
                      ) : (
                        <PlaceIcon fontSize="small" color="action" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={getLocationDisplayName(loc)}
                      secondary={loc.description || (locType === 'virtual' ? 'Virtual' : 'Physical')}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setSelectedLocations([]);
              setDialogSearch('');
            }}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={selectedLocations.length === 0 || associating}
            sx={{ textTransform: 'none' }}
          >
            {associating
              ? 'Associating...'
              : `Associate${selectedLocations.length > 0 ? ` (${selectedLocations.length})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
