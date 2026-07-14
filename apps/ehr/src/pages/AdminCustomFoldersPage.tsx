import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { List } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useMemo, useState } from 'react';
import { createCustomFolder, deleteCustomFolder, renameCustomFolder } from 'src/api/api';
import Loading from 'src/components/Loading';
import { RoundedButton } from 'src/components/RoundedButton';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { ConfirmDeleteFolderDialog } from 'src/features/visits/shared/components/patient/docs/ConfirmDeleteFolderDialog';
import { FolderNameDialog } from 'src/features/visits/shared/components/patient/docs/FolderNameDialog';
import {
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  CustomFolderDefinition,
  FOLDERS_CONFIG,
  parseCustomFoldersCatalog,
} from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { QUERY_KEYS } from '../hooks/useGetPatientDocs';

type DialogState =
  | { mode: 'create' }
  | { mode: 'rename'; folder: CustomFolderDefinition }
  | { mode: 'delete'; folder: CustomFolderDefinition }
  | null;

const AdminCustomFoldersPage: FC = () => {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [pageState, setPageState] = useState({
    pageNumber: 0,
    rowsPerPage: 10,
    searchText: '',
  });

  const { data: folders, isLoading } = useQuery({
    queryKey: ['custom-folders-catalog'],
    queryFn: async (): Promise<CustomFolderDefinition[]> => {
      if (!oystehr) throw new Error('oystehr client not available');
      const bundle = await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
      });
      return parseCustomFoldersCatalog(bundle.unbundle()[0]);
    },
  });

  type FolderRow = { displayName: string; isCustom: boolean; customFolder?: CustomFolderDefinition };

  const mergedFolders: FolderRow[] = useMemo(() => {
    const systemRows: FolderRow[] = FOLDERS_CONFIG.map((c) => ({ displayName: c.display, isCustom: false }));
    const customRows: FolderRow[] = (folders ?? []).map((f) => ({
      displayName: f.displayName,
      isCustom: true,
      customFolder: f,
    }));
    return [...systemRows, ...customRows].sort((a, b) =>
      a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
    );
  }, [folders]);

  const filteredFolders: FolderRow[] = useMemo(
    () =>
      mergedFolders.filter((folder) => folder.displayName.toLowerCase().includes(pageState.searchText.toLowerCase())),
    [mergedFolders, pageState.searchText]
  );

  const pageFolders: FolderRow[] = useMemo(
    () =>
      filteredFolders.slice(
        pageState.pageNumber * pageState.rowsPerPage,
        (pageState.pageNumber + 1) * pageState.rowsPerPage
      ),
    [filteredFolders, pageState.pageNumber, pageState.rowsPerPage]
  );

  const handleChangePage = useCallback((_event: unknown, newPageNumber: number): void => {
    setPageState((prev) => ({ ...prev, pageNumber: newPageNumber }));
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setPageState((prev) => ({ ...prev, rowsPerPage: parseInt(event.target.value), pageNumber: 0 }));
  }, []);

  const handleChangeSearchText = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
      setPageState((prev) => ({ ...prev, searchText: event.target.value, pageNumber: 0 }));
    },
    []
  );

  const allFolderDisplayNames = [...FOLDERS_CONFIG.map((f) => f.display), ...(folders ?? []).map((f) => f.displayName)];

  const handleCreate = async (name: string): Promise<void> => {
    if (!oystehrZambda) throw new Error('Client not available');
    const created = await createCustomFolder(oystehrZambda, { folderName: name });
    await queryClient.invalidateQueries({ queryKey: ['custom-folders-catalog'] });
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS] });
    setHighlightedName(created.displayName);
    enqueueSnackbar(`Folder "${name}" created`, { variant: 'success' });
    setTimeout(() => setHighlightedName(null), 2000);
  };

  const handleRename = async (name: string): Promise<void> => {
    if (!oystehrZambda) throw new Error('Client not available');
    if (dialogState?.mode !== 'rename') return;
    await renameCustomFolder(oystehrZambda, {
      internalName: dialogState.folder.internalName,
      newName: name,
    });
    await queryClient.invalidateQueries({ queryKey: ['custom-folders-catalog'] });
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS] });
    enqueueSnackbar(`Folder renamed to "${name}"`, { variant: 'success' });
  };

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda) throw new Error('Client not available');
    if (dialogState?.mode !== 'delete') return;
    const { displayName, internalName } = dialogState.folder;
    await deleteCustomFolder(oystehrZambda, { internalName });
    await queryClient.invalidateQueries({ queryKey: ['custom-folders-catalog'] });
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS] });
    enqueueSnackbar(`Folder "${displayName}" deleted`, { variant: 'success' });
  };

  return (
    <Box>
      <AdminHeaderActionSlot>
        <RoundedButton variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ mode: 'create' })}>
          Add Folder
        </RoundedButton>
      </AdminHeaderActionSlot>
      <Box>
        <TableContainer>
          <Grid container direction="row" justifyContent="start" alignItems="center" sx={{ py: 2 }}>
            <Grid item xs={6}>
              <TextField
                id="outlined-basic"
                label="Folder"
                placeholder="Search"
                variant="outlined"
                onChange={handleChangeSearchText}
                value={pageState.searchText}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ width: '100%', paddingRight: 2 }}
                size="small"
              />
            </Grid>
            <Grid item xs={3}>
              {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Loading />
                </Box>
              )}
            </Grid>
          </Grid>

          <Table sx={{ minWidth: 650 }} aria-label="customFoldersTable">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '90%' }}>Folder</TableCell>
                <TableCell sx={{ width: '10%' }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageFolders.map((row) => (
                <TableRow
                  key={`${row.isCustom ? 'custom' : 'system'}:${row.displayName}`}
                  sx={{
                    '& .MuiTableCell-body': { textAlign: 'left' },
                    backgroundColor: highlightedName === row.displayName ? 'action.selected' : undefined,
                    transition: 'background-color 1s ease',
                  }}
                >
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell align="right" sx={{ py: 0 }}>
                    {row.isCustom && row.customFolder && (
                      <>
                        <IconButton
                          size="large"
                          aria-label="rename"
                          onClick={() => setDialogState({ mode: 'rename', folder: row.customFolder! })}
                        >
                          <EditOutlinedIcon fontSize="medium" color="primary" />
                        </IconButton>
                        <IconButton
                          size="large"
                          aria-label="delete"
                          onClick={() => setDialogState({ mode: 'delete', folder: row.customFolder! })}
                        >
                          <DeleteIcon fontSize="medium" color="error" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredFolders.length}
            rowsPerPage={pageState.rowsPerPage}
            page={pageState.pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Box>

      <FolderNameDialog
        open={dialogState?.mode === 'create' || dialogState?.mode === 'rename'}
        mode={dialogState?.mode === 'rename' ? 'rename' : 'create'}
        initialName={dialogState?.mode === 'rename' ? dialogState.folder.displayName : ''}
        existingNames={
          dialogState?.mode === 'rename'
            ? allFolderDisplayNames.filter((n) => n !== dialogState.folder.displayName)
            : allFolderDisplayNames
        }
        onSubmit={dialogState?.mode === 'rename' ? handleRename : handleCreate}
        onClose={() => setDialogState(null)}
      />

      <ConfirmDeleteFolderDialog
        open={dialogState?.mode === 'delete'}
        folderName={dialogState?.mode === 'delete' ? dialogState.folder.displayName : ''}
        onConfirm={handleDelete}
        onClose={() => setDialogState(null)}
      />
    </Box>
  );
};

export default AdminCustomFoldersPage;
