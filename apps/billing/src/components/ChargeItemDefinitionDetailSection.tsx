import { Add as AddIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import {
  BillingChargeItemDefinition,
  BillingChargeItemDefinitionProcedureCode,
  ChargeItemDefinitionType,
  getApiError,
  UpdateChargeItemDefinitionInputSchema,
} from 'utils';
import z from 'zod';
import { updateChargeItemDefinition } from '../api/api';
import {
  ChargeItemDefinitionLabels,
  CIDDefaultInputValue,
  formatChargeItemDefinitionDefault,
} from '../constants/chargeItemDefinition';
import { useApiClients } from '../hooks/useAppClients';
import { EditableSection } from './claim/EditableSection';
import { DetailRow } from './DetailRow';
import { Field } from './Field';

export function ChargeItemDefinitionDetailSection({
  type,
  cid,
  onSaved,
}: {
  type: ChargeItemDefinitionType;
  cid: BillingChargeItemDefinition;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [name, setName] = useState(cid.name ?? 'unknown');
  const [effectiveDate, setEffectiveDate] = useState(cid.description ?? '');
  const [description, setDescription] = useState(cid.effectiveDate ?? '');
  const [cidDefault, setCidDefault] = useState<CIDDefaultInputValue>(cid.default ?? '');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [procCodeSearch, setProcCodeSearch] = useState('');

  const filteredCodes = useMemo(
    () => cid.procedureCodes.filter((pc) => pc.code.includes(procCodeSearch)),
    [cid, procCodeSearch]
  );

  const resetFields = useCallback((): void => {
    setName(cid.name ?? 'unknown');
    setEffectiveDate(cid.effectiveDate ?? '');
    setDescription(cid.description ?? '');
    setCidDefault(cid.default ?? '');
  }, [cid]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = useCallback(async (): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    if (!name.trim()) {
      return 'Name is required';
    }

    const payload: z.input<typeof UpdateChargeItemDefinitionInputSchema> = {
      type: type,
      chargeItemDefinitionId: cid.id!,
      name: name.trim(),
      description: description.trim(),
      effectiveDate: effectiveDate.trim(),
      default: cidDefault || undefined,
    };

    try {
      await updateChargeItemDefinition(oystehrZambda, payload);
    } catch (err) {
      return getApiError({
        error: err,
        defaultError: 'Failed to save changes',
      });
    }
    await onSaved();
    return null;
  }, [cid.id, cidDefault, description, effectiveDate, name, onSaved, oystehrZambda, type]);

  const addProcedureCode = useCallback(
    async (code: BillingChargeItemDefinitionProcedureCode): Promise<void> => {
      if (!oystehrZambda) throw new Error('Client not ready');
      const payload: z.input<typeof UpdateChargeItemDefinitionInputSchema> = {
        type: type,
        chargeItemDefinitionId: cid.id!,
        procedureCodes: [...cid.procedureCodes, code],
      };

      try {
        await updateChargeItemDefinition(oystehrZambda, payload);
      } catch (err) {
        throw getApiError({ error: err, defaultError: 'Failed ot add procedure code' });
      }
      await onSaved();
    },
    [cid.id, cid.procedureCodes, onSaved, oystehrZambda, type]
  );

  const removeProcedureCode = useCallback(
    async (rowIdx: number) => {
      if (!oystehrZambda) throw new Error('Client not ready');
      const payload: z.input<typeof UpdateChargeItemDefinitionInputSchema> = {
        type: type,
        chargeItemDefinitionId: cid.id!,
        procedureCodes: [...cid.procedureCodes.slice(0, rowIdx), ...cid.procedureCodes.slice(rowIdx + 1)],
      };

      try {
        await updateChargeItemDefinition(oystehrZambda, payload);
      } catch (err) {
        throw getApiError({ error: err, defaultError: 'Failed ot add procedure code' });
      }
      await onSaved();
    },
    [cid.id, cid.procedureCodes, onSaved, oystehrZambda, type]
  );

  return (
    <>
      <EditableSection
        title={`${ChargeItemDefinitionLabels[type].singularTitle} Details`}
        onSave={handleSave}
        onCancel={resetFields}
        editForm={
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
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
        }
      >
        <DetailRow label="Name" value={cid.name ?? 'unknown'} />
        <DetailRow label="Description" value={cid.description ?? ''} />
        <DetailRow label="Effective Date" value={cid.effectiveDate ?? ''} />
        <DetailRow label="Is Default For" value={formatChargeItemDefinitionDefault(cid.default)} />
      </EditableSection>
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
          Procedure Codes &amp; Amounts
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
            ({cid.procedureCodes.length} total)
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage the procedure codes (CPT/HCPCS) and their associated amounts for this{' '}
          {ChargeItemDefinitionLabels[type].singularText}.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search procedure codes..."
            value={procCodeSearch}
            onChange={(e) => setProcCodeSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)}>
            Add procedure code
          </Button>
        </Box>
        <Box sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.50',
              height: 45,
            }}
          >
            <Box sx={{ width: '15%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Code</Box>
            <Box sx={{ width: '35%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Description</Box>
            <Box sx={{ width: '15%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Modifier</Box>
            <Box sx={{ width: '20%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Amount</Box>
            <Box sx={{ width: '15%', px: 2 }} />
          </Box>
          {filteredCodes.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              {cid.procedureCodes.length === 0
                ? 'No procedure codes yet. Click "Add procedure code" to add a code and amount.'
                : 'No matching procedure codes found.'}
            </Box>
          ) : (
            <FixedSizeList
              height={Math.min(filteredCodes.length, 20) * 45}
              itemCount={filteredCodes.length}
              itemSize={45}
              width="100%"
              overscanCount={10}
            >
              {({ index: rowIdx, style }: ListChildComponentProps) => {
                const row = filteredCodes[rowIdx];
                return (
                  <Box
                    style={style}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ width: '15%', px: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>{row.code}</Box>
                    <Box sx={{ width: '35%', px: 2 }}>
                      {row.description ? row.description.substring(0, Math.min(row.description.length, 60)) : '—'}
                    </Box>
                    <Box sx={{ width: '15%', px: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {row.modifier || '—'}
                    </Box>
                    <Box sx={{ width: '20%', px: 2, fontSize: '0.875rem' }}>${row.amount.toFixed(2)}</Box>
                    <Box sx={{ width: '15%', px: 2, display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => removeProcedureCode(rowIdx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              }}
            </FixedSizeList>
          )}
          {procCodeSearch && filteredCodes.length > 0 && filteredCodes.length !== cid.procedureCodes.length && (
            <Box sx={{ px: 2, py: 1, backgroundColor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {filteredCodes.length} of {cid.procedureCodes.length} codes
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      {addDialogOpen ? (
        <AddProcedureCodeDialog
          open={addDialogOpen}
          handleSave={addProcedureCode}
          onClose={() => setAddDialogOpen(false)}
        />
      ) : (
        <></>
      )}
    </>
  );
}

function AddProcedureCodeDialog({
  open,
  handleSave,
  onClose,
}: {
  open: boolean;
  handleSave: (code: BillingChargeItemDefinitionProcedureCode) => Promise<void>;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [code, setCode] = useState<{ code: string; display: string } | undefined>(undefined);
  const [modifier, setModifier] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procCodes, setProcCodes] = useState<{ code: string; display: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setCode(undefined);
    setModifier(undefined);
    setAmount(undefined);
    setSaving(false);
    setError(null);
  }, [open]);

  const canSave = !!code && amount !== undefined && !isNaN(amount);

  const searchProcCodes = useCallback(
    async (term?: string): Promise<void> => {
      if (!oystehrZambda) throw new Error('Client not ready');
      if (!term) return;
      try {
        const [cptRes, hcpcsRes] = await Promise.all([
          oystehrZambda.terminology.searchCpt({ query: term, searchType: 'all' }),
          oystehrZambda.terminology.searchHcpcs({ query: term, searchType: 'all' }),
        ]);
        setProcCodes([...cptRes.codes, ...hcpcsRes.codes]);
      } catch (err) {
        setError(
          getApiError({
            error: err,
            defaultError: 'Failed to search procedure codes',
          })
        );
      }
    },
    [oystehrZambda]
  );

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    if (!code) {
      throw 'Code is required';
    }
    if (!amount) {
      throw 'Amount is required';
    }
    setSaving(true);
    setError(null);
    try {
      await handleSave({
        code: code.code,
        description: code.display,
        modifier,
        amount,
      });
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create add procedure code' }));
    } finally {
      setSaving(false);
    }
  }, [amount, canSave, code, handleSave, modifier, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Procedure Code</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Field label="Code">
              <Autocomplete
                options={procCodes}
                value={code}
                onChange={(_, v) => setCode(v || undefined)}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') void searchProcCodes(val || undefined);
                }}
                // onOpen={() => searchPr()}
                filterOptions={(x) => x}
                getOptionLabel={(o) => (o ? `${o.code} ${o.display}` : '')}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.code}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {o.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.display}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    size="small"
                    fullWidth
                    // error={!!fieldError}
                    // helperText={fieldError?.message}
                  />
                )}
                isOptionEqualToValue={(o, v) => o.code === v.code}
              />
            </Field>
            <Field label="Modifier">
              <TextField size="small" fullWidth value={modifier} onChange={(e) => setModifier(e.target.value)} />
            </Field>
            <Field label="Amount">
              <TextField
                size="small"
                type="number"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value, 10))}
              />
            </Field>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
