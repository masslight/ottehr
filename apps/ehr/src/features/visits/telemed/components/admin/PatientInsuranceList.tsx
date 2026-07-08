import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { List, Organization } from 'fhir/r4b';
import { ChangeEvent, ReactElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { INSURANCE_ROWS_PER_PAGE } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BILLING_URL, INSURANCES_URL } from 'src/features/admin/adminRoutes';
import { useApiClients } from 'src/hooks/useAppClients';
import { extractPayerIdFromUrl, getPayerId, getPayerUrl } from 'utils';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { useInsurancesQuery } from './admin.queries';

export default function PatientInsuranceList(): ReactElement {
  const theme = useTheme();
  // set up the pagination stats
  const [rowsPerPage, setRowsPerPage] = useState(INSURANCE_ROWS_PER_PAGE);
  const [pageNumber, setPageNumber] = useState(0);
  const [searchText, setSearchText] = useState('');

  const { oystehrZambda } = useApiClients();
  const { data: patientInsuranceOverrideList } = useQuery({
    queryKey: ['insurance-override-list', 'patient'],
    queryFn: async () => {
      if (!oystehrZambda) return undefined;
      const result = await oystehrZambda.zambda.execute({
        id: 'get-insurance-override-list',
        listName: 'patient',
      });
      return result.output as List;
    },
    enabled: !!oystehrZambda,
  });
  const payerIds = (
    patientInsuranceOverrideList?.entry?.map((entry) => extractPayerIdFromUrl(entry.item.reference)) ?? []
  ).filter((id): id is string => !!id);
  const { data, isPending } = useInsurancesQuery(payerIds, true);

  // Filter insurances based on filters and search
  const filteredInsurances = useMemo(() => {
    const newData: Organization[] | undefined = data
      ?.sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? 0)
      .filter((insurance: Organization) => {
        if (!searchText) {
          return true;
        }
        let result = false;
        if (insurance.name?.toLowerCase().includes(searchText.toLowerCase())) {
          result ||= true;
        }
        if (
          patientInsuranceOverrideList?.entry
            ?.find((e) => e.item.reference === getPayerUrl(getPayerId(insurance) ?? ''))
            ?.extension?.find((e) => e.url === ottehrExtensionUrl('insurance-override-name'))
            ?.valueString?.toLowerCase()
            .includes(searchText.toLowerCase())
        ) {
          result ||= true;
        }
        return result;
      });

    return newData || [];
  }, [data, patientInsuranceOverrideList, searchText]);

  // Reset page number to 0 if current page has no items after filtering
  useEffect(() => {
    if (filteredInsurances.length === 0 || pageNumber * rowsPerPage >= filteredInsurances.length) {
      setPageNumber(0);
    }
  }, [filteredInsurances.length, pageNumber, rowsPerPage]);

  // For pagination, only include the rows that are on the current page
  const currentPagesEntities = useMemo(
    () =>
      filteredInsurances.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [pageNumber, filteredInsurances, rowsPerPage]
  );

  // Handle pagination
  const handleChangePage = (_: unknown, newPageNumber: number): void => {
    setPageNumber(newPageNumber);
  };

  // Handle changing the number of rows per page
  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  };

  // Handle changing the search text
  const handleChangeSearchText = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void =>
    setSearchText(event.target.value);

  const skeletonRow = (key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width={20} height={20} />
      </TableCell>
      <TableCell>
        <Skeleton width={100} height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton width={100} height="100%" />
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          backgroundColor: 'info.light',
          color: 'info.dark',
          borderRadius: 1,
          px: 2,
          py: 1.5,
          mb: 2,
          fontSize: '0.875rem',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: '1.25rem', mt: '2px', flexShrink: 0 }} />
        <Typography variant="body2" color="inherit">
          This list controls which insurances are shown to patients for selection while filling out paperwork. If this
          list is empty, all insurances are shown to the patient. You can also override each insurance payer's name for
          the purposes of displaying it to patients in paperwork. This does not affect how the insurance is displayed to
          staff.
        </Typography>
      </Box>
      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              id="outlined-basic"
              label="Search by name or patient-facing name..."
              onChange={(e) => {
                if (pageNumber !== 0) setPageNumber(0);
                handleChangeSearchText(e);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={0} sm={4} />
          <Grid item xs={12} sm={3} display={'flex'}>
            <Link to={`${BILLING_URL}/insurance/patient/new`} style={{ width: '100%' }}>
              <Button
                sx={{
                  borderRadius: 100,
                  textTransform: 'none',
                  width: '100%',
                  fontWeight: 600,
                }}
                color="primary"
                variant="contained"
              >
                <AddIcon />
                <Typography fontWeight="bold">Add to patient list</Typography>
              </Button>
            </Link>
          </Grid>
        </Grid>

        <Table sx={{ minWidth: 650 }} aria-label="insurancesTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Official Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Name in Patient Paperwork</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Payer ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending && [1, 2, 3].map((id) => skeletonRow('skeleton-row-' + id))}
            {currentPagesEntities.map((insurance: Organization, idx: number) => {
              const officialName = insurance.name;
              const patientName = patientInsuranceOverrideList?.entry
                ?.find((e) => e.item.reference === getPayerUrl(getPayerId(insurance) ?? ''))
                ?.extension?.find((e) => e.url === ottehrExtensionUrl('insurance-override-name'))?.valueString;
              const payerId = getPayerId(insurance);
              return (
                <TableRow key={idx}>
                  <TableCell>
                    <Link
                      to={`${INSURANCES_URL}/patient/${insurance.id}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {officialName}
                    </Link>
                  </TableCell>
                  <TableCell>{patientName ?? <Skeleton width={100} height="100%" />}</TableCell>
                  <TableCell>{payerId}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Table Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredInsurances.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          data-testid={dataTestIds.pagination.paginationContainer}
        />
      </TableContainer>
    </Paper>
  );
}
