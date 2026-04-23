import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useEMCodes } from '../../../shared/hooks/useEMCodes';
import {
  useAdminCreateEmCodeMutation,
  useAdminDeleteEmCodeMutation,
  useAdminUpdateEmCodeMutation,
} from './admin.queries';

interface DialogState {
  open: boolean;
  editCode: string | null;
}

export default function EMCodesAdminPage(): ReactElement {
  const { emCodes, isLoading } = useEMCodes();
  const createMutation = useAdminCreateEmCodeMutation();
  const updateMutation = useAdminUpdateEmCodeMutation();
  const deleteMutation = useAdminDeleteEmCodeMutation();

  const [dialog, setDialog] = useState<DialogState>({ open: false, editCode: null });
  const [codeInput, setCodeInput] = useState('');
  const [displayInput, setDisplayInput] = useState('');

  const isEditing = dialog.editCode !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openAddDialog = (): void => {
    setCodeInput('');
    setDisplayInput('');
    setDialog({ open: true, editCode: null });
  };

  const openEditDialog = (code: string, display: string): void => {
    setCodeInput(code);
    setDisplayInput(display);
    setDialog({ open: true, editCode: code });
  };

  const closeDialog = (): void => {
    setDialog({ open: false, editCode: null });
    setCodeInput('');
    setDisplayInput('');
  };

  const handleSave = (): void => {
    if (!codeInput.trim() || !displayInput.trim()) return;
    const mutation = isEditing ? updateMutation : createMutation;
    mutation.mutate({ code: codeInput.trim(), display: displayInput.trim() }, { onSuccess: closeDialog });
  };

  const handleDelete = (code: string): void => {
    deleteMutation.mutate({ code });
  };

  return (
    <Paper sx={{ marginTop: 2, padding: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">E&M Codes</Typography>
        <Button variant="contained" onClick={openAddDialog} data-testid={dataTestIds.emCodesAdminPage.addButton}>
          Add E&M Code
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : emCodes.length === 0 ? (
        <Typography color="text.secondary">No E&M codes configured.</Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Display</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {emCodes.map((entry) => (
                <TableRow key={entry.code} data-testid={dataTestIds.emCodesAdminPage.codeRow(entry.code)}>
                  <TableCell>{entry.code}</TableCell>
                  <TableCell>{entry.display}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(entry.code, entry.display)}
                        data-testid={dataTestIds.emCodesAdminPage.editButton(entry.code)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(entry.code)}
                        disabled={deleteMutation.isPending}
                        data-testid={dataTestIds.emCodesAdminPage.deleteButton(entry.code)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialog.open}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        data-testid={dataTestIds.emCodesAdminPage.dialog}
      >
        <DialogTitle>{isEditing ? 'Edit E&M Code' : 'Add E&M Code'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              disabled={isEditing}
              fullWidth
              inputProps={{ 'data-testid': dataTestIds.emCodesAdminPage.codeField }}
            />
            <TextField
              label="Display"
              value={displayInput}
              onChange={(e) => setDisplayInput(e.target.value)}
              fullWidth
              inputProps={{ 'data-testid': dataTestIds.emCodesAdminPage.displayField }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <LoadingButton
            loading={isSaving}
            onClick={handleSave}
            disabled={!codeInput.trim() || !displayInput.trim()}
            variant="contained"
            data-testid={dataTestIds.emCodesAdminPage.saveButton}
          >
            Save
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
