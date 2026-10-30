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
import { storedClinicId } from 'src/components/dialogs/ReceiveShipmentDialog';
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

const ALL_CLINICS = '';
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

/** Admin → Inventory (requirement 7): what is on hand per clinic, by drug and lot, with each lot's stock history. */
export default function InventoryAdminPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const locationsQuery = useGetAllLocations({ inPersonOnly: true });
  const clinics = locationsQuery.data ?? [];
  // undefined until the clinics load, then the Tracking Board's clinic when it is one of them, else all clinics
  const [clinicId, setClinicId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [expandedDrugs, toggleDrug] = useToggleSet();

  useEffect(() => {
    if (locationsQuery.isSuccess && clinicId === undefined) {
      setClinicId(storedClinicId(locationsQuery.data) ?? ALL_CLINICS);
    }
  }, [locationsQuery.isSuccess, locationsQuery.data, clinicId]);

  const view: ListMedicationInventoryInput | undefined =
    clinicId === undefined
      ? undefined
      : clinicId === ALL_CLINICS
      ? { view: 'all-clinics' }
      : { view: 'clinic', locationId: clinicId };
  const { data, isPending, isError, error } = useQuery({
    queryKey: [INVENTORY_QUERY_KEY, view],
    queryFn: () => listMedicationInventory(oystehrZambda!, view!),
    enabled: !!oystehrZambda && !!view,
  });

  const drugs = (data?.drugs ?? []).filter((drug) => drug.name.toLowerCase().includes(search.trim().toLowerCase()));
  const clinicView = view?.view === 'clinic';
  const clinicName = clinics.find((clinic) => clinic.id === clinicId)?.name ?? '';

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ width: 260 }}>
            <InputLabel id="inventory-clinic-label">Clinic</InputLabel>
            <Select
              labelId="inventory-clinic-label"
              label="Clinic"
              value={clinicId ?? ALL_CLINICS}
              onChange={(e) => setClinicId(e.target.value)}
            >
              <MenuItem value={ALL_CLINICS}>All clinics</MenuItem>
              {clinics.map((clinic) => (
                <MenuItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
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
                <TableCell sx={{ fontWeight: 'bold' }}>{clinicView ? 'Medication / lot' : 'Medication'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>On hand</TableCell>
                {clinicView ? (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Expiration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>NDC · manufacturer</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">
                      Actions
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Clinics below reorder level</TableCell>
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
                    <TableCell colSpan={clinicView ? 5 : 4}>
                      <Skeleton width="40%" />
                    </TableCell>
                  </TableRow>
                ))}
              {drugs.map((drug) =>
                clinicView ? (
                  <ClinicDrugRows
                    key={drug.medicationId}
                    drug={drug}
                    clinicName={clinicName}
                    open={expandedDrugs.has(drug.medicationId)}
                    onToggle={() => toggleDrug(drug.medicationId)}
                  />
                ) : (
                  <AllClinicsDrugRows
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

function AllClinicsDrugRows({
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
        <TableCell sx={{ fontWeight: 500 }}>{drug.name}</TableCell>
        <TableCell>
          {formatOnHand(drug.onHand, drug.countedAs)}
          <MarkerChips markers={drug.markers} only={['below-zero']} />
        </TableCell>
        <TableCell>
          {drug.clinicsBelowReorderLevel} of {drug.clinicsWithReorderLevel}
          <MarkerChips markers={drug.markers} only={['low']} />
        </TableCell>
        <TableCell>
          {formatExpiration(drug.earliestExpiration)}
          <MarkerChips markers={drug.markers} only={['expiring', 'expired']} />
        </TableCell>
      </TableRow>
      {open &&
        drug.clinics.map((clinic) => (
          <TableRow key={clinic.locationId}>
            <TableCell />
            <TableCell sx={{ pl: 3.5, color: 'text.secondary' }}>{clinic.locationName}</TableCell>
            <TableCell>
              {formatOnHand(clinic.onHand, drug.countedAs)}
              <MarkerChips markers={clinic.markers} only={['low', 'below-zero']} />
            </TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{reorderLabel(clinic.reorderLevel)}</TableCell>
            <TableCell>{formatExpiration(clinic.earliestExpiration)}</TableCell>
          </TableRow>
        ))}
    </>
  );
}

function ClinicDrugRows({
  drug,
  clinicName,
  open,
  onToggle,
}: {
  drug: InventoryDrugRow;
  clinicName: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const [expandedLots, toggleLot] = useToggleSet();
  const [dialog, setDialog] = useState<{ kind: 'adjust' | 'count'; lot: InventoryLotRow } | undefined>(undefined);
  const refresh = (): void => void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });

  return (
    <>
      <TableRow sx={{ backgroundColor: open ? '#FAFBFC' : undefined }}>
        <TableCell>
          <ExpandButton open={open} onClick={onToggle} />
        </TableCell>
        <TableCell sx={{ fontWeight: 500 }}>{drug.name}</TableCell>
        <TableCell>
          {formatOnHand(drug.onHand, drug.countedAs)}
          <MarkerChips markers={drug.markers} only={['low', 'below-zero']} />
        </TableCell>
        <TableCell>{reorderLabel(drug.reorderLevel)}</TableCell>
        <TableCell />
        <TableCell />
      </TableRow>
      {open &&
        drug.lots.map((lot) => (
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
      {dialog?.kind === 'adjust' && (
        <AdjustStockDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          clinicName={clinicName}
        />
      )}
      {dialog?.kind === 'count' && (
        <CountLotDialog
          open
          onClose={() => setDialog(undefined)}
          onSaved={refresh}
          drug={drug}
          lot={dialog.lot}
          clinicName={clinicName}
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
