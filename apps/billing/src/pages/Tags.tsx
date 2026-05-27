import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { BillingTag, chooseJson } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

export default function Tags(): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [tags, setTags] = useState<BillingTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BillingTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const response = await oystehrZambda.zambda.execute({ id: 'search-billing-tags' });
      setTags(chooseJson(response).tags ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchTags();
  }, [oystehrZambda, fetchTags]);

  const openCreate = (): void => {
    setEditingTag(null);
    setTagName('');
    setTagDescription('');
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (tag: BillingTag): void => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description);
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !tagName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = { name: tagName.trim(), description: tagDescription.trim() };
      if (editingTag) body.tagId = editingTag.id;
      await oystehrZambda.zambda.execute({ id: 'save-billing-tag', ...body });
      setDialogOpen(false);
      await fetchTags();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: BillingTag): Promise<void> => {
    if (!oystehrZambda) return;
    if (!window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    try {
      await oystehrZambda.zambda.execute({ id: 'delete-billing-tag', tagId: tag.id });
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Tags
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Create
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : tags.length === 0 ? (
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No tags yet. Create one to get started.</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#FAFAFA' }}>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'primary.dark',
                    borderBottom: `1px solid ${otherColors.lightDivider}`,
                  }}
                >
                  Name
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'primary.dark',
                    borderBottom: `1px solid ${otherColors.lightDivider}`,
                  }}
                >
                  Description
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'primary.dark',
                    borderBottom: `1px solid ${otherColors.lightDivider}`,
                    width: 100,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id} sx={{ '&:hover': { bgcolor: otherColors.apptHover } }}>
                  <TableCell sx={{ borderBottom: `1px solid ${otherColors.lightDivider}`, fontSize: 14 }}>
                    <Chip label={tag.name} size="small" variant="outlined" sx={{ borderRadius: '4px' }} />
                  </TableCell>
                  <TableCell
                    sx={{
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                      fontSize: 14,
                      color: otherColors.tableRow,
                    }}
                  >
                    {tag.description || '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: `1px solid ${otherColors.lightDivider}` }}>
                    <IconButton size="small" onClick={() => openEdit(tag)} sx={{ mr: 0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => void handleDelete(tag)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Description"
            value={tagDescription}
            onChange={(e) => setTagDescription(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !tagName.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
