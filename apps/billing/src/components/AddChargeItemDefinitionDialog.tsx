import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { ChargeItemDefinitionType, CreateChargeItemDefinitionInputSchema, getApiError } from 'utils';
import z from 'zod';
import { createChargeItemDefinition } from '../api/api';
import { ChargeItemDefinitionLabels, CIDDefaultInputValue } from '../constants/chargeItemDefinition';
import { useApiClients } from '../hooks/useAppClients';
import { Field } from './Field';

interface AddChargeItemDefinitionDialogProps {
  type: ChargeItemDefinitionType;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddChargeItemDefinitionDialog({
  type,
  open,
  onClose,
  onCreated,
}: AddChargeItemDefinitionDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [name, setName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [description, setDescription] = useState('');
  const [cidDefault, setCidDefault] = useState<CIDDefaultInputValue>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEffectiveDate('');
    setDescription('');
    setCidDefault('');
    setSaving(false);
    setError(null);
  }, [open]);

  const canSave = !!name.trim();

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !canSave) return;
    if (!name.trim()) {
      throw 'Name is required';
    }
    setSaving(true);
    setError(null);
    try {
      const payload: z.input<typeof CreateChargeItemDefinitionInputSchema> = {
        type: type,
        name: name.trim(),
        description: description.trim(),
        effectiveDate: effectiveDate.trim(),
        default: cidDefault || undefined,
      };
      const data = await createChargeItemDefinition(oystehrZambda, payload);
      if (!data.id) throw new Error(`${ChargeItemDefinitionLabels[type].singularTitle} was not created`);
      onCreated();
      onClose();
    } catch (err) {
      setError(
        getApiError({ error: err, defaultError: `Failed to create ${ChargeItemDefinitionLabels[type].singularText}` })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add {ChargeItemDefinitionLabels[type].singularTitle}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Field label="Name">
              <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <TextField size="small" fullWidth value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Effective Date">
              <TextField
                size="small"
                fullWidth
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </Field>
            <Field label="Is Default For">
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={cidDefault}
                onChange={(e) => setCidDefault(e.target.value as CIDDefaultInputValue)}
                renderValue={
                  cidDefault
                    ? undefined
                    : () => (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          Select...
                        </Box>
                      )
                }
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="insurance">Insurance</MenuItem>
                <MenuItem value="self-pay">Self-Pay</MenuItem>
              </Select>
            </Field>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
