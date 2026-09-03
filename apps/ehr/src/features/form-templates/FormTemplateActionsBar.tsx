import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { FormControlLabel, Stack, Switch, Tooltip, Typography, useTheme } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { deleteFormTemplate, updateFormTemplate } from './form-templates.api';
import { FORM_TEMPLATES_QUERY_KEY } from './useFormTemplates';

/**
 * Publishing and removal: the two things that act on a template as a whole.
 *
 * Above the forms below rather than inside either, because neither belongs to one of them — publishing a
 * template is not part of editing its name, and both take effect immediately rather than on a save.
 */
export const FormTemplateActionsBar: FC<{ item: FormTemplateItem }> = ({ item }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  // By prefix: publishing changes what the *chart* sees, which is a separately cached query.
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: [FORM_TEMPLATES_QUERY_KEY] });
  };

  const publishMutation = useMutation({
    mutationFn: async (published: boolean) => {
      if (!oystehrZambda) throw new Error('API client not available');
      return updateFormTemplate(oystehrZambda, { documentReferenceId: item.documentReferenceId, published });
    },
    onSuccess: (_result, published) => {
      enqueueSnackbar(published ? 'Template published' : 'Template returned to draft', { variant: 'success' });
      invalidate();
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to update: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      return deleteFormTemplate(oystehrZambda, { documentReferenceId: item.documentReferenceId });
    },
    onSuccess: () => {
      enqueueSnackbar('Form template removed', { variant: 'success' });
      invalidate();
      // The page this is on describes a template that no longer exists.
      navigate('/admin/form-templates');
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to remove: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  const isBusy = publishMutation.isPending || deleteMutation.isPending;

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
      <Tooltip title={item.published ? 'Remove from patient charts' : 'Make available in patient charts'}>
        <FormControlLabel
          control={
            <Switch
              checked={item.published}
              disabled={isBusy}
              onChange={(e) => publishMutation.mutate(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">{item.published ? 'Published' : 'Draft — not visible in charts'}</Typography>
          }
        />
      </Tooltip>

      <RoundedButton
        startIcon={<DeleteOutlineIcon />}
        disabled={isBusy}
        onClick={() => {
          if (window.confirm(`Remove "${item.title}"?`)) deleteMutation.mutate();
        }}
        sx={{ color: theme.palette.error.main }}
      >
        Remove template
      </RoundedButton>
    </Stack>
  );
};
