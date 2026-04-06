import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { LoadingButton } from '@mui/lab';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { deleteTemplate, listTemplates, renameTemplate } from 'src/api/api';
import { GLOBAL_TEMPLATES_URL } from 'src/App';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { ExamType, ListTemplatesZambdaOutput, TemplateInfo } from 'utils';

export default function GlobalTemplatesAdminPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const { data, isLoading, error } = useQuery<ListTemplatesZambdaOutput, Error>({
    queryKey: ['list-templates', ExamType.IN_PERSON],
    queryFn: async () => {
      if (!oystehrZambda) {
        throw new Error('API client not available');
      }
      return await listTemplates(oystehrZambda, { examType: ExamType.IN_PERSON });
    },
    enabled: !!oystehrZambda,
    staleTime: QUERY_STALE_TIME,
  });

  React.useEffect(() => {
    if (error) {
      console.error('Error loading templates:', error);
      enqueueSnackbar('Failed to load templates', { variant: 'error' });
    }
  }, [error]);

  const sortedTemplates = useMemo(() => {
    if (!data?.templates) return [];
    const sorted = [...data.templates].sort((a, b) => a.title.localeCompare(b.title));
    if (!searchFilter.trim()) return sorted;
    const query = searchFilter.toLowerCase();
    return sorted.filter((t) => t.title.toLowerCase().includes(query));
  }, [data, searchFilter]);

  const handleOpenRenameDialog = (template: TemplateInfo): void => {
    setSelectedTemplate(template);
    setNewName(template.title);
    setRenameDialogOpen(true);
  };

  const handleCloseRenameDialog = (): void => {
    setRenameDialogOpen(false);
    setSelectedTemplate(null);
    setNewName('');
  };

  const handleRename = async (): Promise<void> => {
    if (!oystehrZambda) throw new Error('oystehrZambda was null');
    if (!selectedTemplate) throw new Error('selectedTemplate was undefined');
    if (!newName.trim()) {
      enqueueSnackbar('Template name is required', { variant: 'warning' });
      return;
    }

    setIsRenaming(true);
    try {
      await renameTemplate(oystehrZambda, {
        templateId: selectedTemplate.id,
        newName: newName.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['list-templates'] });
      enqueueSnackbar('Template renamed successfully', { variant: 'success' });
      handleCloseRenameDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename template';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenDeleteDialog = (template: TemplateInfo): void => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = (): void => {
    setDeleteDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda) throw new Error('oystehrZambda was null');
    if (!selectedTemplate) throw new Error('selectedTemplate was undefined');

    setIsDeleting(true);
    try {
      await deleteTemplate(oystehrZambda, { templateId: selectedTemplate.id });
      await queryClient.invalidateQueries({ queryKey: ['list-templates'] });
      enqueueSnackbar('Template deleted successfully', { variant: 'success' });
      handleCloseDeleteDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Paper sx={{ padding: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Templates are created from the progress note. Use this page to manage existing templates.
      </Typography>

      <TextField
        size="small"
        placeholder="Filter templates..."
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        sx={{ mb: 2, width: 300 }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : sortedTemplates.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No templates found. Templates can be created from the progress note on a visit.
        </Typography>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 650 }} aria-label="templates table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Template Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Version Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <RouterLink
                      to={`${GLOBAL_TEMPLATES_URL}/${template.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline', color: 'primary.main' },
                        }}
                      >
                        {template.title}
                      </Typography>
                    </RouterLink>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={template.isCurrentVersion ? 'Current' : 'Stale'}
                      color={template.isCurrentVersion ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenRenameDialog(template)} title="Rename template">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDeleteDialog(template)}
                      title="Delete template"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleCloseRenameDialog} disableScrollLock maxWidth="sm" fullWidth>
        <DialogTitle>Rename Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New template name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isRenaming}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseRenameDialog} disabled={isRenaming}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleRename}
            loading={isRenaming}
            disabled={!newName.trim() || newName.trim() === selectedTemplate?.title}
          >
            Rename
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} disableScrollLock>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the template <strong>{selectedTemplate?.title}</strong>? This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            Cancel
          </Button>
          <LoadingButton variant="contained" color="error" onClick={handleDelete} loading={isDeleting}>
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
