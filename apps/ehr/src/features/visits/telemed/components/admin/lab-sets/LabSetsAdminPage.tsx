import { Add } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
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
import { ReactElement, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAdminGetLabSetsList } from 'src/features/visits/telemed/components/admin/admin.queries';
import { LabSetDTO, LabSetStatus, LabTypeDisplay } from 'utils';

const DEFAULT_ROWS_PER_PAGE = 10;

export default function LabSetsAdminPage(): ReactElement {
  const theme = useTheme();
  const { data, isPending, isError } = useAdminGetLabSetsList();
  const [labSetFilter, setLabSetFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const filteredLabSets: LabSetDTO[] =
    data?.labSetDTO?.filter((labSet) => labSet.listName.toLowerCase().includes(labSetFilter.toLowerCase())) ?? [];

  const currentPageLabSets = filteredLabSets.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage);

  // the unknown is a MUI thing for the pagination component
  const handlePageChange = useCallback((_: unknown, newPage: number): void => {
    setPageNumber(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  }, []);

  const NUM_LOADING_EFFECT_ROWS = 3;
  const loadingEffectRow = (key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width="40%" height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton width="20%" height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton height="100%" />
      </TableCell>
    </TableRow>
  );

  const populatedDataRow = (set: LabSetDTO, key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Link
          to={`/admin/lab-sets/${set.listId}`}
          style={{
            display: 'contents',
            color: theme.palette.primary.main,
          }}
        >
          {set.listName}
        </Link>
      </TableCell>
      <TableCell>{LabTypeDisplay[set.listType]}</TableCell>
      <TableCell>
        <BooleanStateChip label={set.listStatus} state={set.listStatus === LabSetStatus.active} />
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        {/* Filter fields grid container */}
        <Grid container spacing={2} display="flex" alignItems="center" justifyContent="space-between">
          <Grid item xs={12} sm={10}>
            <TextField
              fullWidth
              id="lab-set-search-field"
              label="Lab Sets"
              onChange={(e) => {
                setLabSetFilter(e.target.value);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            ></TextField>
          </Grid>
          <Grid item xs={12} sm={2} display="flex">
            <Button
              component={Link}
              to="/admin/lab-sets/add"
              sx={{ marginLeft: 1 }}
              color="primary"
              variant="contained"
              startIcon={<Add />}
            >
              Add Lab Set
            </Button>
          </Grid>
        </Grid>

        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* load fake rows for nice effect */}
            {isPending &&
              [...Array(NUM_LOADING_EFFECT_ROWS).keys()].map((id) => loadingEffectRow(`loading-effect-row-${id}`))}
            {currentPageLabSets && currentPageLabSets.map((lab) => populatedDataRow(lab, lab.listId))}
            {isError && <Typography>An error occurred</Typography>}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredLabSets.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          data-testid={dataTestIds.pagination.paginationContainer}
        />
      </TableContainer>
    </Paper>
  );
}
