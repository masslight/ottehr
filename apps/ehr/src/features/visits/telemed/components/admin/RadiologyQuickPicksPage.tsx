import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
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
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { getRadiologyQuickPicks, removeRadiologyQuickPick, updateRadiologyQuickPick } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { RadiologyQuickPickData } from 'utils';

const RadiologyQuickPicksPage: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const [quickPicks, setQuickPicks] = useState<RadiologyQuickPickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<RadiologyQuickPickData | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const fetchQuickPicks = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    try {
      const response = await getRadiologyQuickPicks(oystehrZambda);
      setQuickPicks(response.quickPicks.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to load radiology quick picks:', error);
      enqueueSnackbar('Failed to load radiology quick picks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    void fetchQuickPicks();
  }, [fetchQuickPicks]);

  const handleRename = async (): Promise<void> => {
    if (!oystehrZambda || !renameTarget?.id || !renameName.trim()) return;
    setRenaming(true);
    try {
      const { id: _id, ...rest } = renameTarget;
      await updateRadiologyQuickPick(oystehrZambda, renameTarget.id, { ...rest, name: renameName.trim() });
      enqueueSnackbar('Quick pick renamed', { variant: 'success' });
      setRenameTarget(null);
      void fetchQuickPicks();
    } catch (error) {
      console.error('Failed to rename quick pick:', error);
      enqueueSnackbar('Failed to rename quick pick', { variant: 'error' });
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (qp: RadiologyQuickPickData): Promise<void> => {
    if (!oystehrZambda || !qp.id) return;
    if (!window.confirm(`Delete quick pick "${qp.name}"?`)) return;
    try {
      await removeRadiologyQuickPick(oystehrZambda, qp.id);
      enqueueSnackbar('Quick pick deleted', { variant: 'success' });
      void fetchQuickPicks();
    } catch (error) {
      console.error('Failed to delete quick pick:', error);
      enqueueSnackbar('Failed to delete quick pick', { variant: 'error' });
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
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <Typography variant="h6" sx={{ mb: 1, color: '#0F347C' }}>
        Radiology Quick Picks
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quick picks can be created from the Radiology Order page by filling in the order fields and selecting "Add or
        Update Quick Pick".
      </Typography>

      {quickPicks.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          No radiology quick picks yet.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Study Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>CPT Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickPicks.map((qp, index) => (
                <TableRow key={qp.id ?? `default-${index}`}>
                  <TableCell>{qp.name}</TableCell>
                  <TableCell>{qp.studyName ?? ''}</TableCell>
                  <TableCell>{qp.cptCode ? `${qp.cptCode} — ${qp.cptDisplay ?? ''}` : ''}</TableCell>
                  <TableCell>
                    <Tooltip title="Rename">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setRenameTarget(qp);
                          setRenameName(qp.name);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => void handleDelete(qp)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle variant="h4" color="primary.dark">
          Rename Quick Pick
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            sx={{ mt: 1 }}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameTarget(null)} disabled={renaming} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!renameName.trim() || renaming}
            onClick={() => void handleRename()}
            sx={{ textTransform: 'none' }}
          >
            {renaming ? <CircularProgress size={20} /> : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default RadiologyQuickPicksPage;
