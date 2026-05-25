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
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadiologyQuickPickData } from 'utils';
import {
  useRadiologyQuickPicksQuery,
  useRemoveRadiologyQuickPickMutation,
  useRenameRadiologyQuickPickMutation,
} from './admin.queries';

const RadiologyQuickPicksPage: React.FC = () => {
  const navigate = useNavigate();
  const [renameTarget, setRenameTarget] = useState<RadiologyQuickPickData | null>(null);
  const [renameName, setRenameName] = useState('');

  const { data: quickPicks = [], isLoading } = useRadiologyQuickPicksQuery();
  const renameMutation = useRenameRadiologyQuickPickMutation();
  const removeMutation = useRemoveRadiologyQuickPickMutation();

  const handleRename = (): void => {
    if (!renameTarget || !renameName.trim()) return;
    renameMutation.mutate(
      { quickPick: renameTarget, newName: renameName.trim() },
      {
        onSuccess: () => {
          enqueueSnackbar('Quick pick renamed', { variant: 'success' });
          setRenameTarget(null);
        },
        onError: (error) => {
          console.error('Failed to rename quick pick:', error);
          enqueueSnackbar('Failed to rename quick pick', { variant: 'error' });
        },
      }
    );
  };

  const handleDelete = (qp: RadiologyQuickPickData): void => {
    if (!qp.id || !window.confirm(`Delete quick pick "${qp.name}"?`)) return;
    removeMutation.mutate(qp.id, {
      onSuccess: () => enqueueSnackbar('Quick pick deleted', { variant: 'success' }),
      onError: (error) => {
        console.error('Failed to delete quick pick:', error);
        enqueueSnackbar('Failed to delete quick pick', { variant: 'error' });
      },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Radiology Quick Picks
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quick picks can be created from the Radiology Order page by filling in the order fields and selecting &ldquo;Add
        or Update Quick Pick&rdquo;.
      </Typography>

      {quickPicks.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          No radiology quick picks yet.
        </Typography>
      ) : (
        <TableContainer component={Paper}>
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
              {quickPicks.map((qp) => (
                <TableRow
                  key={qp.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => qp.id && navigate(`/admin/quick-picks/radiology/${qp.id}`)}
                >
                  <TableCell>{qp.name}</TableCell>
                  <TableCell>{qp.studyName ?? ''}</TableCell>
                  <TableCell>{qp.cptCode ? `${qp.cptCode} — ${qp.cptDisplay ?? ''}` : ''}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
                      <IconButton size="small" color="error" onClick={() => handleDelete(qp)}>
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
        <DialogTitle>Rename Quick Pick</DialogTitle>
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
          <Button onClick={() => setRenameTarget(null)} disabled={renameMutation.isPending}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!renameName.trim() || renameMutation.isPending} onClick={handleRename}>
            {renameMutation.isPending ? <CircularProgress size={20} /> : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RadiologyQuickPicksPage;
