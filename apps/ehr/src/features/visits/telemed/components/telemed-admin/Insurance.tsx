import { otherColors } from '@ehrTheme/colors';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
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
import { useQueryClient } from '@tanstack/react-query';
import { Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { INSURANCES_URL } from 'src/App';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { INSURANCE_ROWS_PER_PAGE } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useBulkInsuranceStatusMutation, useInsurancesQuery } from './telemed-admin.queries';

enum IsActiveStatus {
  active,
  deactivated,
}

export default function Insurances(): ReactElement {
  const theme = useTheme();
  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(INSURANCE_ROWS_PER_PAGE);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<IsActiveStatus | ''>('');

  const [selectedInsurances, setSelectedInsurances] = React.useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { data, isFetching, isPending } = useInsurancesQuery();
  const bulkStatusMutation = useBulkInsuranceStatusMutation();

  // Filter insurances based on filters and search
  const filteredInsurances = React.useMemo(() => {
    const newData: Organization[] | undefined = data
      ?.sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? 0)
      .filter((insurance: Organization) => {
        if (activeFilter === IsActiveStatus.deactivated && insurance.active !== false) {
          return false;
        }
        return searchText ? insurance.name?.toLowerCase().includes(searchText.toLowerCase()) : true;
      });

    return newData || [];
  }, [activeFilter, data, searchText]);

  // For pagination, only include the rows that are on the current page
  const currentPagesEntities = React.useMemo(
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
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  };

  // Handle changing the search text
  const handleChangeSearchText = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void =>
    setSearchText(event.target.value);

  // Handle change status
  const handleStatusChange = (ev: SelectChangeEvent<IsActiveStatus | ''>): void => {
    setActiveFilter(ev.target.value as IsActiveStatus | '');
  };

  const handleInsuranceSelect = (insuranceId: string, checked: boolean): void => {
    const newSelected = new Set(selectedInsurances);
    if (checked) {
      newSelected.add(insuranceId);
    } else {
      newSelected.delete(insuranceId);
    }
    setSelectedInsurances(newSelected);
  };

  const handleSelectAll = (checked: boolean): void => {
    if (checked) {
      const allIds = new Set(currentPagesEntities.map((insurance) => insurance.id!));
      setSelectedInsurances(allIds);
    } else {
      setSelectedInsurances(new Set());
    }
  };

  const handleSelectAllPages = (checked: boolean): void => {
    if (checked) {
      const allIds = new Set(filteredInsurances.map((insurance) => insurance.id!));
      setSelectedInsurances(allIds);
    } else {
      setSelectedInsurances(new Set());
    }
  };

  const confirmBulkAction = async (action: 'activate' | 'deactivate'): Promise<void> => {
    const selectedIds = Array.from(selectedInsurances);
    const desiredActiveState = action === 'activate';

    const insurancesToUpdate = selectedIds.filter((insuranceId) => {
      const insurance = data?.find((org) => org.id === insuranceId);
      if (!insurance) return false;

      const currentActiveState = insurance.active !== false;
      return currentActiveState !== desiredActiveState;
    });

    if (insurancesToUpdate.length === 0) {
      const alreadyInState = action === 'activate' ? 'already activated' : 'already deactivated';
      enqueueSnackbar(`Selected insurance(s) are ${alreadyInState}.`, {
        variant: 'info',
      });
      setSelectedInsurances(new Set());
      return;
    }

    if (insurancesToUpdate.length < selectedIds.length) {
      const skippedCount = selectedIds.length - insurancesToUpdate.length;
      enqueueSnackbar(
        `${skippedCount} insurance(s) ${
          action === 'activate' ? 'already activated' : 'already deactivated'
        } and will be skipped`,
        {
          variant: 'info',
        }
      );
    }

    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < insurancesToUpdate.length; i += BATCH_SIZE) {
      batches.push(insurancesToUpdate.slice(i, i + BATCH_SIZE));
    }

    let totalUpdated = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batches.length > 1) {
        enqueueSnackbar(`Processing batch ${i + 1} of ${batches.length}...`, {
          variant: 'info',
        });
      }

      await bulkStatusMutation.mutateAsync({
        insuranceIds: batch,
        active: desiredActiveState,
      });

      totalUpdated += batch.length;
    }

    await queryClient.invalidateQueries({ queryKey: ['insurances'] });

    enqueueSnackbar(`Successfully ${action}d ${totalUpdated} insurance(s)`, {
      variant: 'success',
    });

    setSelectedInsurances(new Set());
  };

  const isAllSelected =
    currentPagesEntities.length > 0 && currentPagesEntities.every((insurance) => selectedInsurances.has(insurance.id!));

  const isIndeterminate =
    currentPagesEntities.some((insurance) => selectedInsurances.has(insurance.id!)) && !isAllSelected;

  const isAllPagesSelected =
    filteredInsurances.length > 0 && filteredInsurances.every((insurance) => selectedInsurances.has(insurance.id!));

  const skeletonRow = (key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width={20} height={20} />
      </TableCell>
      <TableCell>
        <Skeleton width={100} height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton width={35} height={20} />
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ padding: 2 }}>
      <TableContainer>
        <Grid container spacing={2} paddingTop={1} display="flex" alignItems="center">
          <Grid item xs={12} sm={5} marginTop={-0.5}>
            <TextField
              fullWidth
              id="outlined-basic"
              label="Insurance"
              onChange={(e) => {
                if (pageNumber !== 0) setPageNumber(0);
                handleChangeSearchText(e);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={12} sm={5} paddingTop={5}>
            <FormControl fullWidth>
              <InputLabel id="select-insurance-status-filter">Status</InputLabel>
              <Select
                labelId="select-insurance-status-filter"
                margin="dense"
                defaultValue={''}
                input={<OutlinedInput label="Status" />}
                onChange={handleStatusChange}
              >
                <MenuItem value={''}>None</MenuItem>
                <MenuItem value={IsActiveStatus.active}>Active</MenuItem>
                <MenuItem value={IsActiveStatus.deactivated}>Deactivated</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2} display={'flex'}>
            <Link to={`${INSURANCES_URL}/new`} style={{ width: '100%' }}>
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
                <Typography fontWeight="bold">Add new</Typography>
              </Button>
            </Link>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {filteredInsurances.length > 0 && (
            <Box sx={{ mt: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={isAllPagesSelected}
                indeterminate={selectedInsurances.size > 0 && !isAllPagesSelected}
                onChange={(e) => handleSelectAllPages(e.target.checked)}
                inputProps={{ 'aria-label': 'select all insurances on all pages' }}
              />
              <Typography
                variant="body2"
                onClick={() => handleSelectAllPages(!isAllPagesSelected)}
                sx={{ cursor: 'pointer' }}
              >
                Select all (on all pages)
              </Typography>
            </Box>
          )}

          {selectedInsurances.size > 0 && (
            <Box sx={{ mt: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {selectedInsurances.size} insurance(s) selected
              </Typography>
              <ConfirmationDialog
                title="Confirm Activation"
                description={`Are you sure you want to activate ${selectedInsurances.size} insurance(s)?`}
                response={() => confirmBulkAction('activate')}
                actionButtons={{
                  proceed: {
                    text: 'Confirm',
                    loading: bulkStatusMutation.isPending || isFetching,
                    disabled: bulkStatusMutation.isPending || isFetching,
                  },
                  back: {
                    text: 'Cancel',
                  },
                }}
              >
                {(showDialog) => (
                  <RoundedButton
                    variant="outlined"
                    onClick={showDialog}
                    disabled={bulkStatusMutation.isPending || isFetching}
                  >
                    Activate
                  </RoundedButton>
                )}
              </ConfirmationDialog>
              <ConfirmationDialog
                title="Confirm Deactivation"
                description={`Are you sure you want to deactivate ${selectedInsurances.size} insurance(s)?`}
                response={() => confirmBulkAction('deactivate')}
                actionButtons={{
                  proceed: {
                    text: 'Confirm',
                    color: 'error',
                    loading: bulkStatusMutation.isPending || isFetching,
                    disabled: bulkStatusMutation.isPending || isFetching,
                  },
                  back: {
                    text: 'Cancel',
                  },
                }}
              >
                {(showDialog) => (
                  <RoundedButton
                    variant="outlined"
                    color="error"
                    onClick={showDialog}
                    disabled={bulkStatusMutation.isPending || isFetching}
                  >
                    Deactivate
                  </RoundedButton>
                )}
              </ConfirmationDialog>
            </Box>
          )}
        </Box>

        <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  inputProps={{ 'aria-label': 'select all insurances on current page' }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Display name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending && [1, 2, 3].map((id) => skeletonRow('skeleton-row-' + id))}
            {currentPagesEntities.map((insurance: Organization, idx: number) => {
              const displayName = insurance.name;
              const isActive = insurance.active !== false;
              const isActiveLabel = isActive ? 'ACTIVE' : 'DEACTIVATED';
              return (
                <TableRow key={idx}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedInsurances.has(insurance.id!)}
                      onChange={(e) => handleInsuranceSelect(insurance.id!, e.target.checked)}
                      inputProps={{ 'aria-label': `select insurance ${displayName}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`${INSURANCES_URL}/${insurance.id}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {displayName}
                    </Link>
                  </TableCell>
                  <TableCell
                    align="left"
                    sx={{
                      color: otherColors.tableRow,
                    }}
                  >
                    {isFetching ? (
                      <Skeleton width={35} height={20} />
                    ) : (
                      <BooleanStateChip label={isActiveLabel} state={isActive} />
                    )}
                  </TableCell>
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
