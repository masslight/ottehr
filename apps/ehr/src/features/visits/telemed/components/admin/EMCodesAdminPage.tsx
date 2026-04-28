import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useIsMutating } from '@tanstack/react-query';
import { ReactElement, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeOption } from 'utils';
import { useEMCodes } from '../../../shared/hooks/useEMCodes';
import EMCodeDeleteDialog from './EMCodeDeleteDialog';
import EMCodeDialog from './EMCodeDialog';

interface DialogState {
  open: boolean;
  existingCode?: CPTCodeOption;
}

export default function EMCodesAdminPage(): ReactElement {
  const { emCodes, isLoading } = useEMCodes();
  const isMutating = useIsMutating({ mutationKey: ['em-codes'] }) > 0;

  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);

  const openAddDialog = (): void => setDialog({ open: true });

  const openEditDialog = (code: string, display: string): void =>
    setDialog({ open: true, existingCode: { code, display } });

  const closeDialog = (): void => setDialog({ open: false });

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
                        disabled={isMutating}
                        aria-label={`Edit E&M code ${entry.code}`}
                        data-testid={dataTestIds.emCodesAdminPage.editButton(entry.code)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setConfirmDeleteCode(entry.code)}
                        disabled={isMutating}
                        color="error"
                        aria-label={`Delete E&M code ${entry.code}`}
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

      <EMCodeDialog open={dialog.open} onClose={closeDialog} existingCode={dialog.existingCode} />

      <EMCodeDeleteDialog code={confirmDeleteCode} onClose={() => setConfirmDeleteCode(null)} />
    </Paper>
  );
}
