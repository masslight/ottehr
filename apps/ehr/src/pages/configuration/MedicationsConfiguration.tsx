import { otherColors } from '@ehrTheme/colors';
import Add from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  capitalize,
  Chip,
  Grid,
  IconButton,
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
  useTheme,
} from '@mui/material';
import { Medication } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import Loading from 'src/components/Loading';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser, { EvolveUser } from 'src/hooks/useEvolveUser';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM, RoleType } from 'utils';

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

  const fetchMedications = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      return;
    }
    const medicationsTemp = await getInHouseMedications(oystehrZambda);
    setMedications(medicationsTemp);
  }, [oystehrZambda]);

  useEffect(() => {
    fetchMedications().catch((error) => console.log('Error fetching medications', error));
  }, [fetchMedications]);

  return (
    <Box sx={{ marginTop: 2 }}>
      <MedicationsTable
        medications={medications}
        currentUser={currentUser}
        pageNumber={pageState.pageNumber}
        rowsPerPage={pageState.rowsPerPage}
        searchText={pageState.searchText}
        onPageStateChange={handlePageStateChange}
        onRefresh={fetchMedications}
      />
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
  onRefresh: () => Promise<void>;
}

function MedicationsTable({
  medications,
  currentUser,
  pageNumber,
  rowsPerPage,
  searchText,
  onPageStateChange,
  onRefresh,
}: MedicationsTableProps): ReactElement {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;

  // Filter and sort: active first, then by name
  const filteredMedications: Medication[] = useMemo(
    () =>
      (
        medications?.filter((medication: Medication) => {
          const name = medication.identifier?.find(
            (identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
          )?.value;
          return name?.toLowerCase().includes(searchText.toLowerCase());
        }) || []
      ).sort((a, b) => {
        const statusA = a.status ?? 'active';
        const statusB = b.status ?? 'active';
        if (statusA === 'active' && statusB !== 'active') return -1;
        if (statusA !== 'active' && statusB === 'active') return 1;
        const nameA =
          a.identifier?.find((i) => i.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value?.toLowerCase() ?? '';
        const nameB =
          b.identifier?.find((i) => i.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value?.toLowerCase() ?? '';
        return nameA.localeCompare(nameB);
      }),
    [medications, searchText]
  );

  const pageMedications: Medication[] = useMemo(
    () => filteredMedications.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [filteredMedications, pageNumber, rowsPerPage]
  );

  const handleChangePage = useCallback(
    (_event: unknown, newPageNumber: number): void => {
      onPageStateChange({ pageNumber: newPageNumber });
    },
    [onPageStateChange]
  );

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onPageStateChange({ rowsPerPage: parseInt(event.target.value), pageNumber: 0 });
    },
    [onPageStateChange]
  );

  const handleChangeSearchText = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
      onPageStateChange({ searchText: event.target.value, pageNumber: 0 });
    },
    [onPageStateChange]
  );

  const handleToggleStatus = async (medication: Medication): Promise<void> => {
    if (!oystehrZambda || !medication.id) return;
    const currentStatus = medication.status ?? 'active';
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateInHouseMedication(oystehrZambda, {
        medicationID: medication.id,
        status: newStatus,
      });
      enqueueSnackbar(`Medication ${newStatus === 'active' ? 'activated' : 'deactivated'}`, { variant: 'success' });
      await onRefresh();
    } catch (error) {
      console.error('Failed to update medication status:', error);
      enqueueSnackbar('Failed to update medication status', { variant: 'error' });
    }
  };

  return (
    <>
      <Paper sx={{ padding: 2 }}>
        <TableContainer>
          <Grid container direction="row" justifyContent="start" alignItems="center" marginTop={1}>
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
              {isAdmin ? (
                <Link to={`/admin/medications/add`}>
                  <Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<Add />}>
                    Add medication
                  </Button>
                </Link>
              ) : (
                <Tooltip title="You must be an administrator to add new medications" placement="top">
                  <span>
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

          <Table sx={{ minWidth: 650 }} aria-label="medicationsTable">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '40%' }}>Name</TableCell>
                <TableCell sx={{ width: '30%' }}>Status</TableCell>
                {isAdmin && <TableCell sx={{ width: '30%' }}>Actions</TableCell>}
              </TableRow>
            </TableHead>

            <TableBody>
              {pageMedications.map((medication) => {
                const name = medication.identifier?.find(
                  (identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
                )?.value;
                const status = medication.status ?? 'active';
                const isActive = status === 'active';

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
                        label={capitalize(status)}
                        sx={{
                          backgroundColor: isActive
                            ? otherColors.employeeActiveChip
                            : otherColors.employeeDeactivatedChip,
                          color: isActive ? otherColors.employeeActiveText : otherColors.employeeDeactivatedText,
                          borderRadius: '4px',
                          height: '17px',
                          '& .MuiChip-label': {
                            padding: '2px 8px 0px 8px',
                          },
                          ...theme.typography.subtitle2,
                        }}
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Tooltip title={isActive ? 'Deactivate' : 'Activate'}>
                          <IconButton
                            size="small"
                            onClick={() => void handleToggleStatus(medication)}
                            sx={{ color: isActive ? theme.palette.error.main : theme.palette.success.main }}
                          >
                            {isActive ? <BlockIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
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
