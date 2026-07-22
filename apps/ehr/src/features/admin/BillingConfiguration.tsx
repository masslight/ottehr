import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Chip,
  CircularProgress,
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
import { PAYMENT_LOCATIONS_URL } from 'src/features/admin/adminRoutes';
import { PaymentLocation } from 'src/rcm/state/payments/payments.api';
import { usePaymentLocationsQuery } from 'src/rcm/state/payments/payments.queries';

export function PaymentLocationsList(): ReactElement {
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
    <Box>
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
    </Box>
  );
}
