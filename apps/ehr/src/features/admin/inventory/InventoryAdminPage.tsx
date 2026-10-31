import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { listMedicationInventory } from 'src/api/api';
import { storedLocationId } from 'src/components/dialogs/ReceiveShipmentDialog';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useGetAllLocations } from 'src/features/notifications/notifications.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  InventoryDrugRow,
  InventoryLotRow,
  ListMedicationInventoryInput,
} from 'utils/lib/types/api/config/in-house-medications';
import AdjustStockDialog from './AdjustStockDialog';
import CountLotDialog from './CountLotDialog';
import {
  describeChange,
  describeReason,
  formatExpiration,
  formatOnHand,
  formatWhen,
  MarkerChips,
} from './inventory.helpers';

const ALL_LOCATIONS = '';
const INVENTORY_QUERY_KEY = 'medication-inventory';
const RECENT_HISTORY_ENTRIES = 7;
const NUM_LOADING_ROWS = 3;

const reorderLabel = (reorderLevel: number | undefined): string =>
  reorderLevel === undefined ? 'no reorder level' : `reorder at ${reorderLevel}`;

const useToggleSet = (): [Set<string>, (id: string) => void] => {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = (id: string): void =>
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return [set, toggle];
};

function ExpandButton({
  open,
  onClick,
  indent,
}: {
  open: boolean;
  onClick: () => void;
  indent?: boolean;
}): ReactElement {
  return (
    <IconButton size="small" onClick={onClick} aria-label={open ? 'Collapse' : 'Expand'} sx={{ ml: indent ? 2 : 0 }}>
      {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
    </IconButton>
  );
}

/** Admin → Inventory (requirement 7): what is on hand per location, by drug and lot, with each lot's stock history. */
export default function InventoryAdminPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const locationsQuery = useGetAllLocations({ inPersonOnly: true });
  const locations = locationsQuery.data ?? [];
  // undefined until the locations load, then the Tracking Board's location when it is one of them, else all locations
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [expandedDrugs, toggleDrug] = useToggleSet();

  useEffect(() => {
    if (locationsQuery.isSuccess && locationId === undefined) {
      setLocationId(storedLocationId(locationsQuery.data) ?? ALL_LOCATIONS);
    }
  }, [locationsQuery.isSuccess, locationsQuery.data, locationId]);

  const view: ListMedicationInventoryInput | undefined =
    locationId === undefined
      ? undefined
      : locationId === ALL_LOCATIONS
      ? { view: 'all-locations' }
      : { view: 'location', locationId };
  const { data, isPending, isError, error } = useQuery({
    queryKey: [INVENTORY_QUERY_KEY, view],
    queryFn: () => listMedicationInventory(oystehrZambda!, view!),
    enabled: !!oystehrZambda && !!view,
  });

  const drugs = (data?.drugs ?? []).filter((drug) => drug.name.toLowerCase().includes(search.trim().toLowerCase()));
  const locationView = view?.view === 'location';
  const locationName = locations.find((location) => location.id === locationId)?.name ?? '';

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ width: 260 }}>
            <InputLabel id="inventory-location-label" shrink>
              Location
            </InputLabel>
            <Select
              labelId="inventory-location-label"
              label="Location"
              notched
              displayEmpty
              value={locationId ?? ALL_LOCATIONS}
              renderValue={(value) => (value === ALL_LOCATIONS ? 'All locations' : locationName)}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <MenuItem value={ALL_LOCATIONS}>All locations</MenuItem>
              {locations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Search"
            placeholder="Medication name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ endAdornment: <SearchIcon /> }}
            sx={{ width: 240 }}
          />
        </Box>
      </AdminHeaderActionSlot>

      {isError ? (
        <Typography sx={{ py: 1 }} color="error">
          An error occurred getting the inventory: {error.message}
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
                <TableCell sx={{ fontWeight: 'bold' }}>{locationView ? 'Medication / lot' : 'Medication'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>On hand</TableCell>
                {locationView ? (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Expiration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>NDC · manufacturer</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">
                      Actions
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Locations at or below reorder level</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Earliest expiration</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(isPending || !view) &&
                [...Array(NUM_LOADING_ROWS).keys()].map((index) => (
                  <TableRow key={`loading-${index}`}>
                    <TableCell />
                    <TableCell colSpan={locationView ? 5 : 4}>
                      <Skeleton width="40%" />
                    </TableCell>
                  </TableRow>
                ))}
              {drugs.map((drug) =>
                locationView ? (
                  <LocationDrugRows
                    key={drug.medicationId}
                    drug={drug}
                    locationName={locationName}
                    open={expandedDrugs.has(drug.medicationId)}
                    onToggle={() => toggleDrug(drug.medicationId)}
                  />
                ) : (
                  <AllLocationsDrugRows
                    key={drug.medicationId}
                    drug={drug}
                    open={expandedDrugs.has(drug.medicationId)}
                    onToggle={() => toggleDrug(drug.medicationId)}
                  />
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Only medications set up for inventory appear here.
      </Typography>
    </Box>
  );
}

function AllLocationsDrugRows({
  drug,
  open,
  onToggle,
}: {
  drug: InventoryDrugRow;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <>
      <TableRow sx={{ backgroundColor: open ? '#FAFBFC' : undefined }}>
        <TableCell>
          <ExpandButton open={open} onClick={onToggle} />
        </TableCell>
        <TableCell sx={{ fontWeight: 500 }}>
          <Link component={RouterLink} to={`/admin/medication/${drug.medicationId}`} underline="hover">
            {drug.name}
          </Link>
        </TableCell>
        <TableCell>
          {formatOnHand(drug.onHand, drug.countedAs)}
          <MarkerChips markers={drug.markers} only={['below-zero']} />
        </TableCell>
        <TableCell>
          {drug.locationsBelowReorderLevel} of {drug.locationsWithReorderLevel}
          <MarkerChips markers={drug.markers} only={['low']} />
        </TableCell>
        <TableCell>
          {formatExpiration(drug.earliestExpiration)}
          <MarkerChips markers={drug.markers} only={['expiring', 'expired']} />
        </TableCell>
      </TableRow>
      {open &&
        drug.locations.map((line) => (
          <TableRow key={line.locationId}>
            <TableCell />
            <TableCell sx={{ pl: 3.5, color: 'text.secondary' }}>{line.locationName}</TableCell>
            <TableCell>
              {formatOnHand(line.onHand, drug.countedAs)}
              <MarkerChips markers={line.markers} only={['low', 'below-zero']} />
            </TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{reorderLabel(line.reorderLevel)}</TableCell>
            <TableCell>{formatExpiration(line.earliestExpiration)}</TableCell>
          </TableRow>
        ))}
    </>
  );
}

function LocationDrugRows({
  drug,
  locationName,
  open,
  onToggle,
}: {
  drug: InventoryDrugRow;
  locationName: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const [expandedLots, toggleLot] = useToggleSet();
  const [dialog, setDialog] = useState<{ kind: 'adjust' | 'count'; lot: InventoryLotRow } | undefined>(undefined);
  const refresh = (): void => void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });
  // Empty lots stay out of the way but can still be counted and adjusted once shown.
  const [showEmptyLots, setShowEmptyLots] = useState(false);
  const emptyLotCount = drug.lots.filter((lot) => lot.onHand === 0).length;
  const visibleLots = showEmptyLots ? drug.lots : drug.lots.filter((lot) => lot.onHand !== 0);

  return (
    <>
      <TableRow sx={{ backgroundColor: open ? '#FAFBFC' : undefined }}>
        <TableCell>
          <ExpandButton open={open} onClick={onToggle} />
        </TableCell>
        <TableCell sx={{ fontWeight: 500 }}>
          <Link component={RouterLink} to={`/admin/medication/${drug.medicationId}`} underline="hover">
            {drug.name}
          </Link>
        </TableCell>
        <TableCell>
          {formatOnHand(drug.onHand, drug.countedAs)}
          <MarkerChips markers={drug.markers} only={['low', 'below-zero']} />
        </TableCell>
        <TableCell>{reorderLabel(drug.reorderLevel)}</TableCell>
        <TableCell />
        <TableCell />
      </TableRow>
      {open &&
        visibleLots.map((lot) => (
          <Fragment key={lot.id}>
            <TableRow>
              <TableCell>
                <ExpandButton open={expandedLots.has(lot.id)} onClick={() => toggleLot(lot.id)} indent />
              </TableCell>
              <TableCell>Lot {lot.lotNumber}</TableCell>
              <TableCell>
                {formatOnHand(lot.onHand, lot.unit)}
                <MarkerChips markers={lot.markers} only={['below-zero']} />
              </TableCell>
              <TableCell>
                {formatExpiration(lot.expirationDate)}
                <MarkerChips markers={lot.markers} only={['expiring', 'expired']} />
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {[lot.ndc, lot.manufacturer].filter(Boolean).join(' · ')}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Button size="small" onClick={() => setDialog({ kind: 'count', lot })} sx={{ textTransform: 'none' }}>
                  Count
                </Button>
                <Button size="small" onClick={() => setDialog({ kind: 'adjust', lot })} sx={{ textTransform: 'none' }}>
                  Adjust
                </Button>
              </TableCell>
            </TableRow>
            {expandedLots.has(lot.id) && (
              <TableRow>
                <TableCell />
                <TableCell colSpan={5} sx={{ pl: 5, pb: 2 }}>
                  <LotHistory lot={lot} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      {open && emptyLotCount > 0 && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={5}>
            <Link component="button" type="button" variant="body2" onClick={() => setShowEmptyLots((prev) => !prev)}>
              {showEmptyLots
                ? 'Hide empty lots'
                : `Show ${emptyLotCount} empty ${emptyLotCount === 1 ? 'lot' : 'lots'}`}
            </Link>
          </TableCell>
        </TableRow>
      )}
      {dialog?.kind === 'adjust' && (
        <AdjustStockDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          locationName={locationName}
        />
      )}
      {dialog?.kind === 'count' && (
        <CountLotDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          locationName={locationName}
        />
      )}
    </>
  );
}

function LotHistory({ lot }: { lot: InventoryLotRow }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [showAll, setShowAll] = useState(false);
  const { data, isPending, isError, error } = useQuery({
    queryKey: [INVENTORY_QUERY_KEY, { view: 'lot-history', lotId: lot.id }],
    queryFn: () => listMedicationInventory(oystehrZambda!, { view: 'lot-history', lotId: lot.id }),
    enabled: !!oystehrZambda,
  });

  const entries = data?.entries ?? [];
  const shown = showAll ? entries : entries.slice(0, RECENT_HISTORY_ENTRIES);
  const hidden = entries.length - shown.length;

  return (
    <>
      <Typography variant="overline" color="primary.dark" fontWeight={500} sx={{ display: 'block', mb: 1 }}>
        Stock history
      </Typography>
      {isError ? (
        <Typography color="error">An error occurred getting the stock history: {error.message}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Change</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Visit</TableCell>
              <TableCell>By</TableCell>
              <TableCell>On hand after</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton width="40%" />
                </TableCell>
              </TableRow>
            )}
            {shown.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatWhen(entry.effectiveDateTime)}</TableCell>
                <TableCell>{describeChange(entry)}</TableCell>
                <TableCell>{describeReason(entry, lot)}</TableCell>
                <TableCell>
                  {entry.visit
                    ? (() => {
                        const label = [
                          entry.visit.patientName,
                          entry.visit.date ? DateTime.fromISO(entry.visit.date).toLocal().toFormat('MM/dd') : undefined,
                        ]
                          .filter(Boolean)
                          .join(', ');
                        return entry.visit.appointmentId ? (
                          <Link component={RouterLink} to={`/in-person/${entry.visit.appointmentId}`}>
                            {label || 'Visit'}
                          </Link>
                        ) : (
                          label
                        );
                      })()
                    : null}
                </TableCell>
                <TableCell>{entry.performerName}</TableCell>
                <TableCell>{entry.onHandAfter}</TableCell>
              </TableRow>
            ))}
            {hidden > 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Link component="button" type="button" variant="body2" onClick={() => setShowAll(true)}>
                    Show {hidden} earlier {hidden === 1 ? 'entry' : 'entries'}
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
}
