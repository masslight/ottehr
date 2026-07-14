import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { BillingTag, getApiError, REQUIRED_FIELD_ERROR_MESSAGE, SaveBillingTagInput } from 'utils';
import { deleteBillingTag, saveBillingTag, searchBillingTags } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

interface AddTagForm {
  name: string | null;
  description: string | null;
}

const defaultValues = {
  name: null,
  description: null,
};
export default function Tags(): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [tags, setTags] = useState<BillingTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const methods = useForm<AddTagForm>({ defaultValues });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BillingTag | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchBillingTags(oystehrZambda);
      setTags(data.tags ?? []);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load tags' }));
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

  // only client side filter here, tag list is small and already loaded
  const filtered = useMemo(() => {
    if (!search) return tags;
    const q = search.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [tags, search]);

  const openCreate = (): void => {
    setEditingTag(null);
    setSaveError(null);
    reset();
    setDialogOpen(true);
  };

  const openEdit = (tag: BillingTag): void => {
    setEditingTag(tag);
    reset({ name: tag.name, description: tag.description });
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async (data: AddTagForm): Promise<void> => {
    if (!oystehrZambda) return;
    setSaveError(null);
    try {
      const body: SaveBillingTagInput = { name: data.name!.trim(), description: data.description?.trim() };
      if (editingTag) body.tagId = editingTag.id;
      await saveBillingTag(oystehrZambda, body);
      setDialogOpen(false);
      await fetchTags();
    } catch (err) {
      setSaveError(getApiError({ error: err, defaultError: 'Failed to save tag' }));
    }
  };

  const handleDelete = async (tag: BillingTag): Promise<void> => {
    if (!oystehrZambda) return;
    if (!window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    try {
      await deleteBillingTag(oystehrZambda, { tagId: tag.id });
      await fetchTags();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to delete tag' }));
    }
  };

  const thSx = {
    fontWeight: 600,
    fontSize: 13,
    color: 'primary.dark',
    borderBottom: `1px solid ${otherColors.lightDivider}`,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Tags
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Reusable labels for organizing claims.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New tag
        </Button>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Search tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.primary" fontWeight={500}>
            {tags.length === 0 ? 'No tags yet' : 'No results'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tags.length === 0 ? 'Create your first tag to start organizing claims.' : 'Try a different search term.'}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA' }}>
                <th style={{ ...thSx, padding: '11px 16px', paddingLeft: 22, width: 240, textAlign: 'left' }}>Name</th>
                <th style={{ ...thSx, padding: '11px 16px', textAlign: 'left' }}>Description</th>
                <th style={{ ...thSx, padding: '11px 16px', textAlign: 'right', width: 70 }}>Usage</th>
                <th style={{ ...thSx, padding: '11px 16px', textAlign: 'left', width: 110 }}>Updated</th>
                <th style={{ ...thSx, padding: '11px 16px', paddingRight: 22, width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tag) => (
                <tr
                  key={tag.id}
                  style={{ cursor: 'pointer', transition: 'background 0.08s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = otherColors.apptHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td
                    style={{
                      padding: '14px 16px',
                      paddingLeft: 22,
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '3px 10px 3px 9px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        border: `1px solid ${otherColors.solidLine}`,
                      }}
                    >
                      <span
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#2169F5', flexShrink: 0 }}
                      />
                      {tag.name}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                      color: otherColors.tableRow,
                    }}
                  >
                    {tag.description || '—'}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                      textAlign: 'right',
                      color: otherColors.tableRow,
                    }}
                  >
                    {tag.usage.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                      fontSize: 13,
                    }}
                  >
                    {tag.updatedAt ? formatDaysAgo(tag.updatedAt) : '—'}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      paddingRight: 22,
                      borderBottom: `1px solid ${otherColors.lightDivider}`,
                      textAlign: 'right',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(tag);
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'action.disabled',
                          '&:hover': { bgcolor: otherColors.apptHover, color: 'primary.dark' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(tag);
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'action.disabled',
                          '&:hover': { bgcolor: 'error.light', color: 'error.dark' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h5">{editingTag ? 'Edit Tag' : 'Create Tag'}</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          <FormProvider {...methods}>
            <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      autoFocus
                      fullWidth
                      size="small"
                      label="Name *"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      fullWidth
                      size="small"
                      label="Description"
                      placeholder="What is this tag used for?"
                      multiline
                      rows={2}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
              </Box>
            </Box>
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={handleSubmit(handleSave)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function formatDaysAgo(iso: string): string {
  return DateTime.fromISO(iso).toRelative() ?? '';
}
