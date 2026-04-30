import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';

export interface QuickPickEditorColumn<T> {
  label: string;
  getValue: (item: T) => string;
  width?: number;
}

export interface QuickPickEditorField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  renderField?: (
    value: string,
    onChange: (value: string) => void,
    onExtraData?: (data: Record<string, string>) => void
  ) => React.ReactNode;
}

interface QuickPickEditorProps<T extends { id?: string }> {
  title: string;
  description: string;
  itemLabel?: string;
  columns: QuickPickEditorColumn<T>[];
  fields: QuickPickEditorField[];
  editable?: boolean;
  fetchItems: () => Promise<T[]>;
  createItem: (data: Omit<T, 'id'>) => Promise<T>;
  updateItem?: (id: string, data: Omit<T, 'id'>) => Promise<T>;
  removeItem: (id: string) => Promise<void>;
  buildItemFromFields: (values: Record<string, string>) => Omit<T, 'id'>;
  getFieldValues?: (item: T) => Record<string, string>;
}

export default function QuickPickEditor<T extends { id?: string }>({
  title,
  description,
  itemLabel = 'Quick Pick',
  columns,
  fields,
  editable = true,
  fetchItems,
  createItem,
  updateItem,
  removeItem,
  buildItemFromFields,
  getFieldValues,
}: QuickPickEditorProps<T>): ReactElement {
  const theme = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchItems();
      setItems(result);
    } catch (error) {
      console.error(`Failed to fetch ${title}:`, error);
      enqueueSnackbar(`Failed to load ${title.toLowerCase()}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fetchItems, title]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const sortedItems = useMemo(() => {
    const firstCol = columns[0];
    if (!firstCol) return items;
    return [...items].sort((a, b) =>
      firstCol.getValue(a).localeCompare(firstCol.getValue(b), undefined, { sensitivity: 'base' })
    );
  }, [items, columns]);

  const openAddDialog = (): void => {
    setEditingItem(null);
    const emptyValues: Record<string, string> = {};
    for (const field of fields) {
      emptyValues[field.key] = '';
    }
    setFieldValues(emptyValues);
    setDialogOpen(true);
  };

  const openEditDialog = (item: T): void => {
    if (!getFieldValues) return;
    setEditingItem(item);
    setFieldValues(getFieldValues(item));
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    const requiredFields = fields.filter((f) => f.required);
    for (const field of requiredFields) {
      if (!fieldValues[field.key]?.trim()) {
        enqueueSnackbar(`${field.label} is required`, { variant: 'warning' });
        return;
      }
    }

    setSaving(true);
    try {
      const data = buildItemFromFields(fieldValues);
      if (editingItem?.id && updateItem) {
        await updateItem(editingItem.id, data);
        enqueueSnackbar('Quick pick updated', { variant: 'success' });
      } else {
        await createItem(data);
        enqueueSnackbar('Quick pick created', { variant: 'success' });
      }
      setDialogOpen(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: T): Promise<void> => {
    if (!item.id) return;
    try {
      await removeItem(item.id);
      enqueueSnackbar('Quick pick removed', { variant: 'success' });
      await loadItems();
    } catch (error) {
      console.error('Failed to remove quick pick:', error);
      enqueueSnackbar('Failed to remove quick pick', { variant: 'error' });
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog} size="small">
          Add
        </Button>
      </Box>

      {sortedItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No quick picks configured yet.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.label} sx={{ fontWeight: 600, width: col.width }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.map((item, index) => (
                <TableRow key={item.id ?? `item-${index}`} hover>
                  {columns.map((col) => (
                    <TableCell key={col.label}>{col.getValue(item) || '-'}</TableCell>
                  ))}
                  <TableCell>
                    {editable && getFieldValues && updateItem && (
                      <IconButton size="small" onClick={() => openEditDialog(item)} title="Edit">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => {
                        const displayName = columns[0]?.getValue(item) ?? '';
                        const message = displayName
                          ? `Remove ${itemLabel} "${displayName}"?`
                          : `Remove this ${itemLabel.toLowerCase()}?`;
                        if (window.confirm(message)) {
                          void handleDelete(item);
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            pt: 3,
            pb: 1,
          }}
        >
          <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 600 }}>
            {editingItem ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
          </Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 1 }}>
          {fields.map((field, index) =>
            field.renderField ? (
              <Box key={field.key} sx={{ mt: index === 0 ? 1 : 2 }}>
                {field.renderField(
                  fieldValues[field.key] ?? '',
                  (value) => setFieldValues((prev) => ({ ...prev, [field.key]: value })),
                  (extraData) => setFieldValues((prev) => ({ ...prev, ...extraData }))
                )}
              </Box>
            ) : (
              <TextField
                key={field.key}
                label={field.label}
                value={fieldValues[field.key] ?? ''}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                fullWidth
                sx={{ mt: index === 0 ? 1 : 2 }}
                autoFocus={index === 0}
                placeholder={field.placeholder}
                required={field.required}
                multiline={field.multiline}
                rows={field.multiline ? field.rows ?? 4 : undefined}
                inputProps={field.maxLength ? { maxLength: field.maxLength } : undefined}
                helperText={
                  field.maxLength ? `${(fieldValues[field.key] ?? '').length} / ${field.maxLength}` : undefined
                }
              />
            )
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <RoundedButton onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editingItem ? 'Save' : `Add ${itemLabel}`}
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
