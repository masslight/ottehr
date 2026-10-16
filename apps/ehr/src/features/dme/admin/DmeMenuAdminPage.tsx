import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
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
} from '@mui/material';
import { ReactElement, useMemo, useState } from 'react';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { DmeMenuItem, formatDmeBillingCode } from 'utils/lib/types/api/dme.types';
import { useDmeMenuItems } from '../dme.queries';
import { DeleteDmeMenuItemDialog } from './DeleteDmeMenuItemDialog';
import { DmeMenuItemDialog } from './DmeMenuItemDialog';
import { dmeMenuTestIds } from './dmeMenuTestIds';

const DEFAULT_ROWS_PER_PAGE = 25;

interface DialogState {
  open: boolean;
  item?: DmeMenuItem;
}

const matchesSearch = (item: DmeMenuItem, term: string): boolean =>
  item.name.toLowerCase().includes(term) ||
  item.hcpcsCodes.some((code) => code.code.toLowerCase().includes(term) || code.display.toLowerCase().includes(term));

export function DmeMenuAdminPage(): ReactElement {
  const { data, isPending, isError, error } = useDmeMenuItems();
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<DmeMenuItem | null>(null);

  const items = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [data]
  );

  const searchTerm = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () => (searchTerm ? items.filter((item) => matchesSearch(item, searchTerm)) : items),
    [items, searchTerm]
  );

  const lastPage = Math.max(0, Math.ceil(filteredItems.length / rowsPerPage) - 1);
  const page = Math.min(pageNumber, lastPage);
  const pageItems = filteredItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const renderContent = (): ReactElement => {
    if (isPending) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (isError) {
      return <Typography color="error">Failed to load the DME menu: {error.message}</Typography>;
    }
    if (filteredItems.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ py: 2 }} data-testid={dmeMenuTestIds.emptyState}>
          {items.length === 0
            ? 'No DME items configured yet. Use "Add DME item" to build the DME menu.'
            : `No DME items match "${search.trim()}".`}
        </Typography>
      );
    }
    return (
      <TableContainer>
        <Table data-testid={dmeMenuTestIds.table}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>DME</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>HCPCS code(s)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow key={item.id} hover data-testid={dmeMenuTestIds.itemRow(item.id)}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.hcpcsCodes.length > 0 ? (
                    item.hcpcsCodes.map((code) => (
                      <Typography key={code.code} variant="body2">
                        {formatDmeBillingCode(code)}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      No HCPCS code
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => setDialog({ open: true, item })}
                        aria-label={`Edit ${item.name}`}
                        data-testid={dmeMenuTestIds.editButton(item.id)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${item.name}`}
                        data-testid={dmeMenuTestIds.deleteButton(item.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_e, newPage) => setPageNumber(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPageNumber(0);
          }}
        />
      </TableContainer>
    );
  };

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ open: true })}
          data-testid={dmeMenuTestIds.addButton}
        >
          Add DME item
        </Button>
      </AdminHeaderActionSlot>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The durable medical equipment providers can choose from when placing a DME order, with the HCPCS code(s) that
        describe each item.
      </Typography>

      <TextField
        label="Search by name or HCPCS code"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPageNumber(0);
        }}
        InputProps={{ endAdornment: <SearchIcon /> }}
        inputProps={{ 'data-testid': dmeMenuTestIds.searchField }}
        sx={{ width: { xs: '100%', md: '50%' }, mb: 2 }}
      />

      {renderContent()}

      <DmeMenuItemDialog
        open={dialog.open}
        item={dialog.item}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
      <DeleteDmeMenuItemDialog item={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </Box>
  );
}
