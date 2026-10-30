import { Add } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  MenuItem,
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
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useAdminListInHouseLabs } from 'src/features/visits/telemed/components/admin/admin.queries';
import { InHouseLabsAdminListItem } from 'utils/lib/types/data/in-house/in-house.types';

const DEFAULT_ROWS_PER_PAGE = 10;

type StatusFilter = 'all' | 'active' | 'inactive';

export default function InHouseLabAdminPage(): ReactElement {
  const theme = useTheme();
  const { data, isPending, isError } = useAdminListInHouseLabs();
  const [labFilter, setLabFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const filteredLabs: InHouseLabsAdminListItem[] =
    data?.labs?.filter((lab) => {
      if (statusFilter === 'active' && lab.status !== 'active') return false;
      if (statusFilter === 'inactive' && lab.status === 'active') return false;
      return lab.name.toLowerCase().includes(labFilter.toLowerCase());
    }) ?? [];

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
          to={`/admin/in-house-labs/${item.activityDefinitionId}`}
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

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Button component={Link} to="/admin/in-house-labs/add" color="primary" variant="contained" startIcon={<Add />}>
          Add In House Lab
        </Button>
      </AdminHeaderActionSlot>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            id="lab-search-field"
            label="In-House Lab"
            onChange={(e) => {
              setLabFilter(e.target.value);
              setPageNumber(0);
            }}
            InputProps={{ endAdornment: <SearchIcon /> }}
            margin="dense"
          ></TextField>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPageNumber(0);
            }}
            margin="dense"
            sx={{ width: 200, flexShrink: 0 }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </Box>

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
    </Box>
  );
}
