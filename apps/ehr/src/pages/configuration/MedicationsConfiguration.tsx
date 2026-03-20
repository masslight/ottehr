import { otherColors } from '@ehrTheme/colors';
import Add from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  capitalize,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Medication } from 'fhir/r4b';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInHouseMedications } from 'src/api/api';
import Loading from 'src/components/Loading';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser, { EvolveUser } from 'src/hooks/useEvolveUser';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM, RoleType } from 'utils';
import MedicationsQuickPicksConfiguration from './MedicationsQuickPicksConfiguration';

export default function MedicationsConfigurationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [medications, setMedications] = useState<Medication[] | undefined>(undefined);
  const currentUser = useEvolveUser();
  const [pageState, setPageState] = useState({
    pageNumber: 0,
    rowsPerPage: 10,
    searchText: '',
  });
  const handlePageStateChange = useCallback(
    (newPageState: { pageNumber?: number; rowsPerPage?: number; searchText?: string }): void => {
      setPageState((prev) => ({ ...prev, ...newPageState }));
    },
    []
  );
  useEffect(() => {
    async function fetchMedications(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const medicationsTemp = await getInHouseMedications(oystehrZambda);
      setMedications(medicationsTemp);
    }
    fetchMedications().catch((error) => console.log('Error fetching medications', error));
  }, [oystehrZambda]);

  return (
    <Box sx={{ marginTop: 2 }}>
      <MedicationsTable
        medications={medications}
        currentUser={currentUser}
        pageNumber={pageState.pageNumber}
        rowsPerPage={pageState.rowsPerPage}
        searchText={pageState.searchText}
        onPageStateChange={handlePageStateChange}
      />
      <MedicationsQuickPicksConfiguration />
    </Box>
  );
}

interface MedicationsTableProps {
  medications: Medication[] | undefined;
  currentUser: EvolveUser | undefined;
  pageNumber: number;
  rowsPerPage: number;
  searchText: string;
  onPageStateChange: (newPageState: { pageNumber?: number; rowsPerPage?: number; searchText?: string }) => void;
}

function MedicationsTable({
  medications,
  currentUser,
  pageNumber,
  rowsPerPage,
  searchText,
  onPageStateChange,
}: MedicationsTableProps): ReactElement {
  const theme = useTheme();

  // Filter the medications based on the search text
  const filteredMedications: Medication[] = useMemo(
    () =>
      medications?.filter((medication: Medication) => {
        const name = medication.identifier?.find(
          (identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
        )?.value;
        return name?.toLowerCase().includes(searchText.toLowerCase());
      }) || [],
    [medications, searchText]
  );

  // For pagination, only include the rows that are on the current page
  const pageMedications: Medication[] = useMemo(
    () =>
      filteredMedications.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [filteredMedications, pageNumber, rowsPerPage]
  );

  // Handle pagination
  const handleChangePage = useCallback(
    (event: unknown, newPageNumber: number): void => {
      onPageStateChange({ pageNumber: newPageNumber });
    },
    [onPageStateChange]
  );

  // Handle changing the number of rows per page
  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onPageStateChange({ rowsPerPage: parseInt(event.target.value), pageNumber: 0 });
    },
    [onPageStateChange]
  );

  // Handle changing the search text
  const handleChangeSearchText = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
      onPageStateChange({ searchText: event.target.value, pageNumber: 0 });
    },
    [onPageStateChange]
  );

  return (
    <>
      <Paper sx={{ padding: 2 }}>
        <Typography variant="h4">Medications</Typography>
        <TableContainer>
          <Grid container direction="row" justifyContent="start" alignItems="center" marginTop={1}>
            {/* Medication Name Search Box */}
            <Grid item xs={6}>
              <TextField
                id="outlined-basic"
                label="Search by name"
                variant="outlined"
                onChange={handleChangeSearchText}
                value={searchText}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ width: '100%', paddingRight: 2 }}
              />
            </Grid>
            <Grid item xs={3}>
              {currentUser?.hasRole([RoleType.Administrator]) ? (
                <Link to={`/admin/medications/add`}>
                  <Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<Add />}>
                    Add medication
                  </Button>
                </Link>
              ) : (
                <Tooltip title="You must be an administrator to add new medications" placement="top">
                  <span>
                    {/* https://mui.com/material-ui/react-tooltip/#disabled-elements */}
                    <Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<Add />} disabled>
                      Add medication
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Grid>
            <Grid item xs={3}>
              {medications === undefined && (
                <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Loading />
                </Box>
              )}
            </Grid>
          </Grid>

          {/* Medications Table */}
          <Table sx={{ minWidth: 650 }} aria-label="medicationsTable">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '25%' }}>Name</TableCell>
                <TableCell sx={{ width: '25%' }}>Status</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {pageMedications.map((medication) => {
                const name = medication.identifier?.find(
                  (identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
                )?.value;
                let status = medication.status;
                if (status === undefined) {
                  status = 'active';
                }

                return (
                  <TableRow key={medication.id} sx={{ '& .MuiTableCell-body': { textAlign: 'left' } }}>
                    <TableCell>
                      <Link
                        to={`/admin/medication/${medication.id}`}
                        style={{
                          display: 'contents',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={status ? capitalize(status) : 'Unknown'}
                        sx={{
                          backgroundColor:
                            status === 'active' ? otherColors.employeeActiveChip : otherColors.employeeDeactivatedChip,
                          color:
                            status === 'active' ? otherColors.employeeActiveText : otherColors.employeeDeactivatedText,
                          borderRadius: '4px',
                          height: '17px',
                          '& .MuiChip-label': {
                            padding: '2px 8px 0px 8px',
                          },
                          ...theme.typography.subtitle2,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredMedications.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </>
  );
}
