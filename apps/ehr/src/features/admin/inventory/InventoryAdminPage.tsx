import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAllLocations } from 'src/features/notifications/notifications.queries';
import { ListMedicationInventoryInput } from 'utils/lib/types/api/config/in-house-medications';
import { AllLocationsDrugRows, LocationDrugRows } from './DrugRows';
import { storedLocationId, useToggleSet } from './inventory.helpers';
import { useMedicationInventory } from './inventory.queries';

const ALL_LOCATIONS = '';
const NUM_LOADING_ROWS = 3;

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const matchesNdc = (ndc: string | undefined, search: string): boolean => {
  const digits = digitsOnly(search);
  return search.trim() === '' || (digits !== '' && digitsOnly(ndc ?? '').includes(digits));
};

const matchesLotNumber = (lotNumber: string, search: string): boolean =>
  lotNumber.toLowerCase().includes(search.trim().toLowerCase());

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  disabled?: boolean;
}

const SearchField = ({ label, value, onChange, testId, disabled }: SearchFieldProps): ReactElement => {
  return (
    <TextField
      size="small"
      label={label}
      placeholder="Search"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }}
      inputProps={{ 'data-testid': testId }}
      InputProps={{ endAdornment: <SearchIcon color={disabled ? 'disabled' : 'action'} /> }}
      sx={{ flex: '1 1 200px' }}
    />
  );
};

const InventoryAdminPage = (): ReactElement => {
  const locationsQuery = useGetAllLocations({ inPersonOnly: true });
  const locations = locationsQuery.data ?? [];
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [nameSearch, setNameSearch] = useState('');
  const [ndcSearch, setNdcSearch] = useState('');
  const [lotSearch, setLotSearch] = useState('');
  const [expandedDrugs, toggleDrug] = useToggleSet();

  useEffect(() => {
    if (locationsQuery.isSuccess && locationId === undefined) {
      setLocationId(storedLocationId(locationsQuery.data) ?? ALL_LOCATIONS);
    }
  }, [locationsQuery.isSuccess, locationsQuery.data, locationId]);

  const today = DateTime.now().toISODate();
  const view: ListMedicationInventoryInput | undefined =
    locationId === undefined
      ? undefined
      : locationId === ALL_LOCATIONS
      ? { view: 'all-locations', today }
      : { view: 'location', locationId, today };
  const { data, isPending, isError, error } = useMedicationInventory(view);

  const lotSearched = ndcSearch.trim() !== '' || lotSearch.trim() !== '';
  const drugs = (data?.drugs ?? [])
    .filter((drug) => drug.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
    .map((drug) =>
      lotSearched
        ? {
            ...drug,
            lots: drug.lots.filter(
              (lot) => matchesNdc(lot.ndc, ndcSearch) && matchesLotNumber(lot.lotNumber, lotSearch)
            ),
          }
        : drug
    )
    .filter((drug) => !lotSearched || drug.lots.length > 0);
  const locationView = view?.view === 'location';
  const locationName = locations.find((location) => location.id === locationId)?.name ?? '';

  const changeLocation = (value: string): void => {
    setLocationId(value);
    if (value === ALL_LOCATIONS) {
      setNdcSearch('');
      setLotSearch('');
    }
  };

  return (
    <Box>
      <Grid container sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <FormControl size="small" fullWidth required>
            <InputLabel id="inventory-location-label" shrink>
              Clinic
            </InputLabel>
            <Select
              labelId="inventory-location-label"
              label="Clinic"
              sx={{ backgroundColor: 'background.paper' }}
              data-testid={dataTestIds.inventoryPage.locationSelect}
              notched
              displayEmpty
              value={locationId ?? ALL_LOCATIONS}
              renderValue={(value) => (value === ALL_LOCATIONS ? 'All clinics' : locationName)}
              onChange={(e) => changeLocation(e.target.value)}
            >
              <MenuItem value={ALL_LOCATIONS}>All clinics</MenuItem>
              {locations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {isError ? (
        <Typography sx={{ py: 1 }} color="error">
          An error occurred getting the inventory: {error.message}
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, p: 2 }}>
            <SearchField
              label="Medication name"
              value={nameSearch}
              onChange={setNameSearch}
              testId={dataTestIds.inventoryPage.searchField}
            />
            <Tooltip title={locationView ? '' : 'Select a clinic to search by NDC or lot'} placement="top">
              <Box sx={{ display: 'flex', flex: '2 1 416px', flexWrap: 'wrap', gap: 2 }}>
                <SearchField
                  label="NDC"
                  value={ndcSearch}
                  onChange={setNdcSearch}
                  testId={dataTestIds.inventoryPage.ndcSearchField}
                  disabled={!locationView}
                />
                <SearchField
                  label="Lot"
                  value={lotSearch}
                  onChange={setLotSearch}
                  testId={dataTestIds.inventoryPage.lotSearchField}
                  disabled={!locationView}
                />
              </Box>
            </Tooltip>
          </Box>
          <Table sx={{ minWidth: 650 }} aria-label="inventoryTable">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
                <TableCell sx={{ fontWeight: 'bold' }}>{locationView ? 'Medication / Lot' : 'Medication'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>On Hand</TableCell>
                {locationView ? (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Expiration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>NDC · Manufacturer</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">
                      Actions
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ fontWeight: 'bold' }}>Clinics at or Below Reorder Level</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Earliest Expiration</TableCell>
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
};

export default InventoryAdminPage;
