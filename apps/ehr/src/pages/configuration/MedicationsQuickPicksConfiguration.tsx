/* eslint-disable @typescript-eslint/no-unused-vars */
import { otherColors } from '@ehrTheme/colors';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
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
  Typography,
  useTheme,
} from '@mui/material';
import { InHouseMedicationQuickPick } from 'config-types';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInHouseMedicationsQuickPicks } from 'src/api/api';
import Loading from 'src/components/Loading';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser, { EvolveUser } from 'src/hooks/useEvolveUser';

export default function MedicationsQuickPicksConfiguration(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [medicationsQuickPicks, setMedicationsQuickPicks] = useState<InHouseMedicationQuickPick[] | undefined>(
    undefined
  );
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
    async function fetchMedicationsQuickPicks(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const medicationsQuickPicksTemp = await getInHouseMedicationsQuickPicks(oystehrZambda);
      setMedicationsQuickPicks(medicationsQuickPicksTemp);
    }
    fetchMedicationsQuickPicks().catch((error) =>
      console.log('Error fetching in house quick picks medications', error)
    );
  }, [oystehrZambda]);

  return (
    <Box sx={{ marginTop: 2 }}>
      <MedicationsQuickPicksTable
        medicationsQuickPicks={medicationsQuickPicks}
        currentUser={currentUser}
        pageNumber={pageState.pageNumber}
        rowsPerPage={pageState.rowsPerPage}
        searchText={pageState.searchText}
        onPageStateChange={handlePageStateChange}
      />
    </Box>
  );
}

interface MedicationsQuickPicksTableProps {
  medicationsQuickPicks: InHouseMedicationQuickPick[] | undefined;
  currentUser: EvolveUser | undefined;
  pageNumber: number;
  rowsPerPage: number;
  searchText: string;
  onPageStateChange: (newPageState: { pageNumber?: number; rowsPerPage?: number; searchText?: string }) => void;
}

function MedicationsQuickPicksTable({
  medicationsQuickPicks,
  currentUser,
  pageNumber,
  rowsPerPage,
  searchText,
  onPageStateChange,
}: MedicationsQuickPicksTableProps): ReactElement {
  const theme = useTheme();
  // Filter the medications based on the search text
  const filteredMedicationsQuickPicks: InHouseMedicationQuickPick[] = useMemo(
    () =>
      medicationsQuickPicks?.filter((medicationQuickPick: InHouseMedicationQuickPick) => {
        const name = medicationQuickPick.name;
        return name?.toLowerCase().includes(searchText.toLowerCase());
      }) || [],
    [medicationsQuickPicks, searchText]
  );

  // For pagination, only include the rows that are on the current page
  const pageQuickPicks: InHouseMedicationQuickPick[] = useMemo(
    () =>
      filteredMedicationsQuickPicks.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [filteredMedicationsQuickPicks, pageNumber, rowsPerPage]
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
        <Typography variant="h4">Medications Quick Picks</Typography>
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
              {medicationsQuickPicks === undefined && (
                <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Loading />
                </Box>
              )}
            </Grid>
          </Grid>

          {/* Quick Picks Medications Table */}
          <Table sx={{ minWidth: 650 }} aria-label="medicationsQuickPicksTable">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '25%' }}>Name</TableCell>
                <TableCell sx={{ width: '25%' }}>Dose</TableCell>
                <TableCell sx={{ width: '25%' }}>Route</TableCell>
                <TableCell sx={{ width: '25%' }}>Status</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {pageQuickPicks.map((quickpick) => {
                const name = quickpick.name;
                let status = quickpick.status;
                if (status === undefined) {
                  status = 'active';
                }

                return (
                  <TableRow key={quickpick.id} sx={{ '& .MuiTableCell-body': { textAlign: 'left' } }}>
                    <TableCell>
                      <Link
                        to={`/admin/medication-quick-pick/${quickpick.id}`}
                        style={{
                          display: 'contents',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {quickpick.dose || 'Unknown'} {quickpick.units || 'Unknown'}
                    </TableCell>
                    <TableCell>{quickpick.routeName || 'Unknown'}</TableCell>
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
            count={filteredMedicationsQuickPicks.length}
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
