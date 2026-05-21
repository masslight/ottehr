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
import React, { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { ImmunizationQuickPickData } from 'utils';
import {
  useImmunizationQuickPicksQuery,
  useRemoveQuickPickMutation,
  useRenameImmunizationQuickPickMutation,
} from './admin.queries';

export default function ImmunizationQuickPicksPage(): ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingQuickPick, setRenamingQuickPick] = useState<ImmunizationQuickPickData | null>(null);
  const [newName, setNewName] = useState('');

  const { data: quickPicks = [], isLoading } = useImmunizationQuickPicksQuery();
  const renameMutation = useRenameImmunizationQuickPickMutation();
  const removeMutation = useRemoveQuickPickMutation();

  const handleOpenRename = (qp: ImmunizationQuickPickData): void => {
    setRenamingQuickPick(qp);
    setNewName(qp.name);
    setRenameDialogOpen(true);
  };

  const handleRename = async (): Promise<void> => {
    if (!renamingQuickPick) return;
    if (!newName.trim()) {
      enqueueSnackbar('Name is required', { variant: 'warning' });
      return;
    }
    renameMutation.mutate(
      { quickPick: renamingQuickPick, newName: newName.trim() },
      {
        onSuccess: () => {
          enqueueSnackbar('Quick pick renamed successfully', { variant: 'success' });
          setRenameDialogOpen(false);
          setRenamingQuickPick(null);
        },
        onError: (error) => {
          console.error('Failed to rename quick pick:', error);
          enqueueSnackbar('Failed to rename quick pick', { variant: 'error' });
        },
      }
    );
  };

  const handleDelete = (qp: ImmunizationQuickPickData): void => {
    if (!qp.id) return;
    removeMutation.mutate(qp.id, {
      onSuccess: () => enqueueSnackbar('Quick pick removed successfully', { variant: 'success' }),
      onError: (error) => {
        console.error('Failed to remove quick pick:', error);
        enqueueSnackbar('Failed to remove quick pick', { variant: 'error' });
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Immunization Quick Picks
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Quick picks are created from the Immunization Order or Vaccine Details page. Use this page to rename or remove
          existing quick picks.
        </Typography>
      </Box>

      {quickPicks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No immunization quick picks configured. Quick picks can be created from the Immunization Order or Vaccine
            Details page by clicking &quot;Add or Update Quick Pick&quot; in the Quick Picks menu.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Vaccine</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Dose</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>CVX</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickPicks.map((qp, index) => (
                <TableRow
                  key={qp.id ?? `default-${index}`}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => qp.id && navigate(`/admin/quick-picks/immunization/${qp.id}`)}
                >
                  <TableCell>{qp.name}</TableCell>
                  <TableCell>{qp.vaccine?.name || '-'}</TableCell>
                  <TableCell>{qp.dose ? `${qp.dose} ${qp.units ?? ''}`.trim() : '-'}</TableCell>
                  <TableCell>{qp.cvx || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => handleOpenRename(qp)} title="Rename">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(`Remove quick pick "${qp.name}"?`)) {
                          handleDelete(qp);
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
          <RoundedButton onClick={() => setRenameDialogOpen(false)} disabled={renameMutation.isPending}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={handleRename} disabled={renameMutation.isPending}>
            {renameMutation.isPending ? <CircularProgress size={20} /> : 'Rename'}
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
