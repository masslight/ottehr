import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useApiClients } from 'src/hooks/useAppClients';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { deleteFormTemplate, listFormTemplates, updateFormTemplate } from './form-templates.api';
import { FormTemplateDialog } from './FormTemplateDialog';

export const FORM_TEMPLATES_QUERY_KEY = ['form-templates'];

export const FormTemplatesAdminPage = (): ReactElement => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplateItem | null>(null);

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: FORM_TEMPLATES_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      // Admin sees drafts too; the patient chart omits this and gets published templates only.
      return listFormTemplates(oystehrZambda, { includeUnpublished: true });
    },
    enabled: !!oystehrZambda,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: FORM_TEMPLATES_QUERY_KEY });
  };

  const publishMutation = useMutation({
    mutationFn: async ({ documentReferenceId, published }: { documentReferenceId: string; published: boolean }) => {
      if (!oystehrZambda) throw new Error('API client not available');
      return updateFormTemplate(oystehrZambda, { documentReferenceId, published });
    },
    onSuccess: (_result, variables) => {
      enqueueSnackbar(variables.published ? 'Template published' : 'Template returned to draft', {
        variant: 'success',
      });
      invalidate();
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to update: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentReferenceId: string) => {
      if (!oystehrZambda) throw new Error('API client not available');
      return deleteFormTemplate(oystehrZambda, { documentReferenceId });
    },
    onSuccess: () => {
      enqueueSnackbar('Form template removed', { variant: 'success' });
      invalidate();
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to remove: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  const items: FormTemplateItem[] = (data?.items ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
  const isMutating = publishMutation.isPending || deleteMutation.isPending;

  return (
    <Box>
      <AdminHeaderActionSlot>
        <RoundedButton variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add
        </RoundedButton>
      </AdminHeaderActionSlot>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fillable PDF forms that providers can open from the Plan section of a patient chart. Only published templates
        appear there.
      </Typography>

      {isLoading && <CircularProgress />}

      {isSuccess && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                  Published
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No form templates yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow key={item.documentReferenceId}>
                  <TableCell>
                    <Link
                      href={item.pdfPresignedUrl}
                      target="_blank"
                      rel="noopener"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <PictureAsPdfIcon fontSize="small" color="error" />
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={item.published ? 'success' : 'default'}
                      label={item.published ? 'Published' : 'Draft'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={item.published ? 'Remove from patient charts' : 'Make available in patient charts'}>
                      <span>
                        <Switch
                          size="small"
                          checked={item.published}
                          disabled={isMutating}
                          onChange={(e) =>
                            publishMutation.mutate({
                              documentReferenceId: item.documentReferenceId,
                              published: e.target.checked,
                            })
                          }
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                    <IconButton size="small" onClick={() => setEditing(item)} title="Edit details">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(`Remove "${item.title}"?`)) {
                          deleteMutation.mutate(item.documentReferenceId);
                        }
                      }}
                      disabled={isMutating}
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

      {addOpen && <FormTemplateDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {editing && (
        <FormTemplateDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          item={editing}
          key={editing.documentReferenceId}
        />
      )}
    </Box>
  );
};
