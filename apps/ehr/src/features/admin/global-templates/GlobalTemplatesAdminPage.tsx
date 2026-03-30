import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
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
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { AdminListTemplateItem } from 'utils';
import {
  useDeleteTemplateMutation,
  useListAllTemplatesQuery,
  useRenameTemplateMutation,
} from './globalTemplates.queries';

export const GlobalTemplatesAdminPage: FC = () => {
  const { data: templates, isLoading } = useListAllTemplatesQuery();
  const renameMutation = useRenameTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();

  const [filterText, setFilterText] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AdminListTemplateItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminListTemplateItem | null>(null);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const lower = filterText.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(lower)).sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, filterText]);

  const handleOpenRename = (template: AdminListTemplateItem): void => {
    setRenameTarget(template);
    setRenameValue(template.name);
    setRenameDialogOpen(true);
  };

  const handleRename = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameMutation.mutateAsync({ templateId: renameTarget.id, newName: renameValue.trim() });
      enqueueSnackbar('Template renamed successfully', { variant: 'success' });
      setRenameDialogOpen(false);
      setRenameTarget(null);
    } catch {
      enqueueSnackbar('Failed to rename template', { variant: 'error' });
    }
  };

  const handleOpenDelete = (template: AdminListTemplateItem): void => {
    setDeleteTarget(template);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ templateId: deleteTarget.id });
      enqueueSnackbar('Template deleted successfully', { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch {
      enqueueSnackbar('Failed to delete template', { variant: 'error' });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      <TextField
        placeholder="Filter templates..."
        size="small"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        sx={{ mb: 2, minWidth: 300 }}
      />

      {filteredTemplates.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {/* todo are we sure this will be the only way? */}
          No templates found. Templates can be created from the progress note on a visit.
        </Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Template Name</TableCell>
                <TableCell>Version Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    {/* todo link is not working yet */}
                    {/* <Link
                      to={`/admin/global-templates/${template.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    > */}
                    <Typography color="primary" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                      {template.name}
                    </Typography>
                    {/* </Link> */}
                  </TableCell>
                  <TableCell>
                    {/* todo custom chips */}
                    <Chip
                      label={template.versionStatus === 'current' ? 'Up To Date' : 'Outdated'}
                      color={template.versionStatus === 'current' ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenRename(template)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleOpenDelete(template)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* todo dialog styling */}
      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rename Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRename} disabled={!renameValue.trim() || renameMutation.isPending}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the template &apos;{deleteTarget?.name}&apos;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
