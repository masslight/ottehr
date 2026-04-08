import SearchIcon from '@mui/icons-material/Search';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { BILLING_URL, PAYMENT_LOCATIONS_URL } from 'src/App';
import Invoicing from 'src/rcm/features/invoicing/Invoicing';
import PatientDunning from 'src/rcm/features/patient-dunning/PatientDunning';
import { PaymentLocation } from 'src/rcm/state/payments/payments.api';
import { usePaymentLocationsQuery } from 'src/rcm/state/payments/payments.queries';
import FeeSchedule from './ChargeItemList';
import EmployersTab from './employers/EmployersTab';
import Insurances from './Insurance';

type BillingSubTab =
  | 'insurance'
  | 'fee-schedules'
  | 'charge-masters'
  | 'employers'
  | 'payment-locations'
  | 'invoicing'
  | 'patient-ar';

function PaymentLocationsList(): ReactElement {
  const navigate = useNavigate();
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');

  const { data, isLoading } = usePaymentLocationsQuery();
  const locations: PaymentLocation[] = React.useMemo(() => data || [], [data]);

  const filteredLocations = React.useMemo(
    () => locations.filter((item) => item.location.name?.toLowerCase().includes(searchText.toLowerCase())),
    [searchText, locations]
  );

  const pageLocations = React.useMemo(
    () => filteredLocations.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [pageNumber, filteredLocations, rowsPerPage]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (locations.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        No payment locations found.
      </Typography>
    );
  }

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Box sx={{ pb: 1 }}>
          <TextField
            label="Search by location name"
            variant="outlined"
            size="small"
            onChange={(e) => {
              if (pageNumber !== 0) setPageNumber(0);
              setSearchText(e.target.value);
            }}
            InputProps={{ endAdornment: <SearchIcon /> }}
            sx={{ marginBottom: 1, minWidth: 350 }}
          />
        </Box>

        <Table sx={{ minWidth: 500 }} aria-label="Payment locations">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '45%' }}>Address</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Virtual Visits</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageLocations.map((item) => (
              <TableRow
                key={item.location.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`${PAYMENT_LOCATIONS_URL}/${item.location.id}`)}
              >
                <TableCell>{item.location.name}</TableCell>
                <TableCell>
                  {item.supportsVirtualVisits
                    ? item.location.address?.state || '—'
                    : [
                        item.location.address?.line?.join(', '),
                        item.location.address?.city,
                        item.location.address?.state,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.supportsVirtualVisits ? 'Yes' : 'No'}
                    color={item.supportsVirtualVisits ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredLocations.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={(_, newPage) => setPageNumber(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value));
            setPageNumber(0);
          }}
        />
      </TableContainer>
    </Paper>
  );
}

export default function BillingConfiguration({ billingTab }: { billingTab?: string }): ReactElement {
  const navigate = useNavigate();
  const subTab: BillingSubTab = (billingTab as BillingSubTab) || 'insurance';

  const handleSubTabChange = (_: unknown, newValue: BillingSubTab): void => {
    navigate(`${BILLING_URL}/${newValue}`);
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleSubTabChange} aria-label="Billing configuration tabs">
            <Tab label="Insurance" value="insurance" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Fee Schedules" value="fee-schedules" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Charge Masters" value="charge-masters" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Employers" value="employers" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Payment Locations" value="payment-locations" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Invoicing" value="invoicing" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Patient AR" value="patient-ar" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </TabList>
        </Box>
        <TabPanel value="insurance" sx={{ padding: 0 }}>
          <Insurances />
        </TabPanel>
        <TabPanel value="fee-schedules" sx={{ padding: 0 }}>
          <FeeSchedule />
        </TabPanel>
        <TabPanel value="charge-masters" sx={{ padding: 0 }}>
          <FeeSchedule mode="charge-master" />
        </TabPanel>
        <TabPanel value="employers" sx={{ padding: 0 }}>
          <EmployersTab />
        </TabPanel>
        <TabPanel value="payment-locations" sx={{ padding: 0 }}>
          <PaymentLocationsList />
        </TabPanel>
        <TabPanel value="invoicing" sx={{ padding: 0 }}>
          <Invoicing />
        </TabPanel>
        <TabPanel value="patient-ar" sx={{ padding: 0 }}>
          <PatientDunning />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
