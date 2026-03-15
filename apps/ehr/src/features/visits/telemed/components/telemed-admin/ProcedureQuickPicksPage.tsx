import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
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
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { getProcedureQuickPicks, removeProcedureQuickPick, updateProcedureQuickPick } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { ProcedureQuickPickData } from 'utils';

export default function ProcedureQuickPicksPage(): ReactElement {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const [quickPicks, setQuickPicks] = useState<ProcedureQuickPickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingQuickPick, setRenamingQuickPick] = useState<ProcedureQuickPickData | null>(null);
  const [newName, setNewName] = useState('');

  const fetchQuickPicks = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    try {
      const response = await getProcedureQuickPicks(oystehrZambda);
      setQuickPicks([...response.quickPicks].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to fetch procedure quick picks:', error);
      enqueueSnackbar('Failed to load procedure quick picks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    void fetchQuickPicks();
  }, [fetchQuickPicks]);

  const handleOpenRename = (qp: ProcedureQuickPickData): void => {
    setRenamingQuickPick(qp);
    setNewName(qp.name);
    setRenameDialogOpen(true);
  };

  const handleRename = async (): Promise<void> => {
    if (!oystehrZambda || !renamingQuickPick?.id) return;
    if (!newName.trim()) {
      enqueueSnackbar('Name is required', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const { id, name: _name, ...rest } = renamingQuickPick;
      await updateProcedureQuickPick(oystehrZambda, id, { ...rest, name: newName.trim() });
      enqueueSnackbar('Quick pick renamed successfully', { variant: 'success' });
      setRenameDialogOpen(false);
      setRenamingQuickPick(null);
      await fetchQuickPicks();
    } catch (error) {
      console.error('Failed to rename quick pick:', error);
      enqueueSnackbar('Failed to rename quick pick', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qp: ProcedureQuickPickData): Promise<void> => {
    if (!oystehrZambda || !qp.id) return;

    try {
      await removeProcedureQuickPick(oystehrZambda, qp.id);
      enqueueSnackbar('Quick pick removed successfully', { variant: 'success' });
      await fetchQuickPicks();
    } catch (error) {
      console.error('Failed to remove quick pick:', error);
      enqueueSnackbar('Failed to remove quick pick', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Procedure Quick Picks
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Quick picks are created from the Document Procedure page. Use this page to rename or remove existing quick
          picks.
        </Typography>
      </Box>

      {quickPicks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No procedure quick picks configured. Quick picks can be created from the Document Procedure page by clicking
            &quot;Save as Quick Pick&quot;.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Procedure Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>CPT Codes</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Body Site</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickPicks.map((qp, index) => (
                <TableRow key={qp.id ?? `default-${index}`} hover>
                  <TableCell>{qp.name}</TableCell>
                  <TableCell>{qp.procedureType || '-'}</TableCell>
                  <TableCell>{qp.cptCodes?.map((c) => c.code).join(', ') || '-'}</TableCell>
                  <TableCell>{qp.bodySite || '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenRename(qp)} title="Rename">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(`Remove quick pick "${qp.name}"?`)) {
                          void handleDelete(qp);
                        }
                      }}
                      title="Remove"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Quick Pick</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <RoundedButton onClick={() => setRenameDialogOpen(false)} disabled={saving}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={handleRename} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Rename'}
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
