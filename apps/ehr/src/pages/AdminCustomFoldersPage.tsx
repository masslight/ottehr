import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { List } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createCustomFolder, renameCustomFolder } from 'src/api/api';
import { FolderNameDialog } from 'src/features/visits/shared/components/patient/docs/FolderNameDialog';
import { CustomFolderDefinition, FOLDERS_CONFIG, parseCustomFoldersCatalog, RoleType } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import { QUERY_KEYS } from '../hooks/useGetPatientDocs';

type DialogState = { mode: 'create' } | { mode: 'rename'; folder: CustomFolderDefinition } | null;

const AdminCustomFoldersPage: FC = () => {
  const evolveUser = useEvolveUser();
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['custom-folders-catalog'],
    queryFn: async (): Promise<CustomFolderDefinition[]> => {
      if (!oystehr) throw new Error('oystehr client not available');
      const bundle = await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'identifier', value: 'ottehr-custom-folders-catalog' }],
      });
      return parseCustomFoldersCatalog(bundle.unbundle()[0]);
    },
  });

  if (!evolveUser?.hasRole([RoleType.Administrator])) {
    return <Navigate to="/" replace />;
  }

  const allFolderDisplayNames = [...FOLDERS_CONFIG.map((f) => f.display), ...folders.map((f) => f.displayName)];

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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Custom Folders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Folders defined here apply to every patient.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ mode: 'create' })}>
          New Folder
        </Button>
      </Box>

      <Paper>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : folders.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No custom folders yet.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogState({ mode: 'create' })}>
              New Folder
            </Button>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Folder Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {folders.map((folder) => (
                <TableRow
                  key={folder.internalName}
                  sx={{
                    backgroundColor: highlightedName === folder.displayName ? 'action.selected' : undefined,
                    transition: 'background-color 1s ease',
                  }}
                >
                  <TableCell>{folder.displayName}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDialogState({ mode: 'rename', folder })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <FolderNameDialog
        open={dialogState !== null}
        mode={dialogState?.mode ?? 'create'}
        initialName={dialogState?.mode === 'rename' ? dialogState.folder.displayName : ''}
        existingNames={
          dialogState?.mode === 'rename'
            ? allFolderDisplayNames.filter((n) => n !== dialogState.folder.displayName)
            : allFolderDisplayNames
        }
        onSubmit={dialogState?.mode === 'rename' ? handleRename : handleCreate}
        onClose={() => setDialogState(null)}
      />
    </Box>
  );
};

export default AdminCustomFoldersPage;
