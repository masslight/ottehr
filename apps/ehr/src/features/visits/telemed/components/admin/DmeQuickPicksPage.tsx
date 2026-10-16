import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
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
import React, { ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { useDmeQuickPicksQuery, useRemoveDmeQuickPickMutation, useRenameDmeQuickPickMutation } from './admin.queries';

const matchesSearch = (qp: DmeQuickPickData, term: string): boolean =>
  qp.name.toLowerCase().includes(term) ||
  (qp.itemName ?? '').toLowerCase().includes(term) ||
  (qp.billingCodes ?? []).some(
    (code) => code.code.toLowerCase().includes(term) || code.display.toLowerCase().includes(term)
  );

const formatOrderSettings = (qp: DmeQuickPickData): string =>
  [
    qp.quantity !== undefined ? `Qty ${qp.quantity}` : undefined,
    qp.laterality === 'NA' ? 'N/A' : qp.laterality,
    qp.modifier,
  ]
    .filter(Boolean)
    .join(' · ');

export default function DmeQuickPicksPage(): ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [renamingQuickPick, setRenamingQuickPick] = useState<DmeQuickPickData | null>(null);
  const [newName, setNewName] = useState('');

  const { data: quickPicks = [], isLoading } = useDmeQuickPicksQuery();
  const renameMutation = useRenameDmeQuickPickMutation();
  const removeMutation = useRemoveDmeQuickPickMutation();

  const searchTerm = search.trim().toLowerCase();
  const filteredQuickPicks = useMemo(
    () => (searchTerm ? quickPicks.filter((qp) => matchesSearch(qp, searchTerm)) : quickPicks),
    [quickPicks, searchTerm]
  );

  const handleOpenRename = (qp: DmeQuickPickData): void => {
    setRenamingQuickPick(qp);
    setNewName(qp.name);
  };

  const handleRename = (): void => {
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
          setRenamingQuickPick(null);
        },
        onError: (error) => {
          console.error('Failed to rename quick pick:', error);
          enqueueSnackbar('Failed to rename quick pick', { variant: 'error' });
        },
      }
    );
  };

  const handleDelete = (qp: DmeQuickPickData): void => {
    if (!qp.id || !window.confirm(`Remove quick pick "${qp.name}"?`)) return;
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

  const renderList = (): ReactElement => {
    if (quickPicks.length === 0) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No DME quick picks configured. Quick picks can be created from the Order DME form by opening Quick Picks and
            selecting &quot;Add or Update Quick Pick&quot;.
          </Typography>
        </Paper>
      );
    }
    if (filteredQuickPicks.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No DME quick picks match &quot;{search.trim()}&quot;.
        </Typography>
      );
    }
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>DME</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>HCPCS / CPT Codes</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Qty / Laterality / Modifier</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredQuickPicks.map((qp, index) => (
              <TableRow
                key={qp.id ?? `default-${index}`}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => qp.id && navigate(`/admin/quick-picks/dme/${qp.id}`)}
              >
                <TableCell>{qp.name}</TableCell>
                <TableCell>{qp.itemName || '-'}</TableCell>
                <TableCell>{qp.billingCodes?.map((c) => c.code).join(', ') || '-'}</TableCell>
                <TableCell>{formatOrderSettings(qp) || '-'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenRename(qp)}
                    title="Rename"
                    aria-label={`Rename ${qp.name}`}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(qp)}
                    title="Remove"
                    aria-label={`Remove ${qp.name}`}
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
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          DME Quick Picks
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Quick picks are created from the Order DME form. Use this page to rename or remove existing quick picks.
        </Typography>
      </Box>

      {quickPicks.length > 0 && (
        <TextField
          label="Search by name, DME or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ endAdornment: <SearchIcon /> }}
          sx={{ width: { xs: '100%', md: '50%' }, mb: 2 }}
        />
      )}

      {renderList()}

      <Dialog open={!!renamingQuickPick} onClose={() => setRenamingQuickPick(null)} maxWidth="sm" fullWidth>
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
          <RoundedButton onClick={() => setRenamingQuickPick(null)} disabled={renameMutation.isPending}>
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
