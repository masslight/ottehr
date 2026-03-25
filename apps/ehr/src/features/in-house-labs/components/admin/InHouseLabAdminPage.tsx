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
import { useAdminListInHouseLabs } from 'src/features/visits/telemed/components/admin/admin.queries';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { InHouseLabsAdminListItem } from 'utils';

const DEFAULT_ROWS_PER_PAGE = 10;

export default function InHouseLabAdminPage(): ReactElement {
  const theme = useTheme();
  const currentUser = useEvolveUser();
  const { data, isPending, isError } = useAdminListInHouseLabs(currentUser?.id ?? '');
  const [labFilter, setLabFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const filteredLabs: InHouseLabsAdminListItem[] =
    data?.labs?.filter((lab) => lab.name.toLowerCase().includes(labFilter.toLowerCase())) ?? [];

  const currentPageLabs = filteredLabs.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage);

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
        <Skeleton width={200} height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton width={30} height="100%" />
      </TableCell>
    </TableRow>
  );

  const populatedDataRow = (item: InHouseLabsAdminListItem, key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Link
          to={`admin/in-house-labs/${item.activityDefinitionId}`}
          style={{
            display: 'contents',
            color: theme.palette.primary.main,
          }}
        >
          {item.name}
        </Link>
      </TableCell>
      <TableCell>
        <BooleanStateChip label={item.status === 'active' ? 'Active' : 'Inactive'} state={item.status === 'active'} />
      </TableCell>
    </TableRow>
  );

  console.log('>>> this is labs data', data);

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        {/* Filter fields grid container */}
        <Grid container spacing={2} display="flex" alignItems="center" justifyContent="space-between">
          <Grid item xs={12} sm={10}>
            <TextField
              fullWidth
              id="lab-search-field"
              label="In-House Lab"
              onChange={(e) => {
                setLabFilter(e.target.value);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            ></TextField>
          </Grid>
          <Grid item xs={12} sm={2} display="flex">
            <Button
              component={Link}
              to="/admin/in-house-labs/add"
              sx={{ marginLeft: 1 }}
              color="primary"
              variant="contained"
              startIcon={<Add />}
            >
              Add In House Lab
            </Button>
          </Grid>
        </Grid>

        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* load fake rows for nice effect */}
            {isPending &&
              [...Array(NUM_LOADING_EFFECT_ROWS).keys()].map((id) => loadingEffectRow(`loading-effect-row-${id}`))}
            {currentPageLabs && currentPageLabs.map((lab) => populatedDataRow(lab, lab.activityDefinitionId))}
            {isError && <Typography>An error occurred</Typography>}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredLabs.length}
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
