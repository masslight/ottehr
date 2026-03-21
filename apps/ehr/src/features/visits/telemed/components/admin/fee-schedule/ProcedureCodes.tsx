import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ChargeItemDefinition } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useCmAddProcedureCodeMutation,
  useCmBulkAddProcedureCodesMutation,
  useCmDeleteProcedureCodeMutation,
  useCmUpdateProcedureCodeMutation,
} from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  useAddProcedureCodeMutation,
  useBulkAddProcedureCodesMutation,
  useDeleteProcedureCodeMutation,
  useUpdateProcedureCodeMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { ChargeItemMode } from '../FeeSchedule';

interface ProcedureCodesProps {
  feeSchedule: ChargeItemDefinition | undefined;
  isFetching: boolean;
  mode?: ChargeItemMode;
}

interface CptOption {
  code: string;
  display: string;
}

interface ProcedureCodeRow {
  index: number;
  code: string;
  description: string;
  modifier: string;
  amount: number;
}

const ROW_HEIGHT = 45;
const MAX_VISIBLE_ROWS = 20;
const DESCRIPTION_TRUNCATE_LENGTH = 60;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function extractProcedureCodes(feeSchedule: ChargeItemDefinition | undefined): ProcedureCodeRow[] {
  if (!feeSchedule?.propertyGroup) return [];
  return feeSchedule.propertyGroup.map((pg, idx) => {
    const pc = pg.priceComponent?.[0];
    const coding = pc?.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
    const cptCode = coding?.code || '';
    const description = coding?.display || '';
    const modifier = pc?.extension?.find((ext) => ext.url === CPT_MODIFIER_EXTENSION_URL)?.valueCode || '';
    const amount = pc?.amount?.value ?? 0;
    return { index: idx, code: cptCode, description, modifier, amount };
  });
}

export default function ProcedureCodes({
  feeSchedule,
  isFetching,
  mode = 'fee-schedule',
}: ProcedureCodesProps): ReactElement {
  const isChargeMaster = mode === 'charge-master';
  const queryKey = isChargeMaster ? 'charge-masters' : 'fee-schedules';
  const idField = isChargeMaster ? 'chargeMasterId' : 'feeScheduleId';
  const [searchText, setSearchText] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState({ code: '', description: '', modifier: '', amount: '' });

  // CPT/HCPCS search for autocomplete
  const [cptSearchTerm, setCptSearchTerm] = useState('');
  const [cptInputValue, setCptInputValue] = useState('');
  const { debounce } = useDebounce(400);
  const { isFetching: isSearchingCpt, data: cptData } = useGetCPTHCPCSSearch({
    search: cptSearchTerm,
    type: 'both',
  });
  const cptOptions: CptOption[] = useMemo(
    () => (cptData?.codes || []).map((c) => ({ code: c.code, display: c.display })),
    [cptData]
  );

  const queryClient = useQueryClient();
  const fsAdd = useAddProcedureCodeMutation();
  const fsUpdate = useUpdateProcedureCodeMutation();
  const fsDelete = useDeleteProcedureCodeMutation();
  const fsBulkAdd = useBulkAddProcedureCodesMutation();
  const cmAdd = useCmAddProcedureCodeMutation();
  const cmUpdate = useCmUpdateProcedureCodeMutation();
  const cmDelete = useCmDeleteProcedureCodeMutation();
  const cmBulkAdd = useCmBulkAddProcedureCodesMutation();
  const { mutateAsync: addCode, isPending: adding } = isChargeMaster ? cmAdd : fsAdd;
  const { mutateAsync: updateCode, isPending: updating } = isChargeMaster ? cmUpdate : fsUpdate;
  const { mutateAsync: deleteCode, isPending: deleting } = isChargeMaster ? cmDelete : fsDelete;
  const { mutateAsync: bulkAdd, isPending: bulkAdding } = isChargeMaster ? cmBulkAdd : fsBulkAdd;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const procedureCodes = useMemo(() => extractProcedureCodes(feeSchedule), [feeSchedule]);

  const filteredCodes = useMemo(() => {
    if (!searchText) return procedureCodes;
    const lower = searchText.toLowerCase();
    return procedureCodes.filter(
      (pc) =>
        pc.code.toLowerCase().includes(lower) ||
        pc.description.toLowerCase().includes(lower) ||
        pc.modifier.toLowerCase().includes(lower)
    );
  }, [procedureCodes, searchText]);

  const openAddDialog = (): void => {
    setEditIndex(null);
    setFormData({ code: '', description: '', modifier: '', amount: '' });
    setCptSearchTerm('');
    setCptInputValue('');
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((row: ProcedureCodeRow): void => {
    setEditIndex(row.index);
    setFormData({
      code: row.code,
      description: row.description,
      modifier: row.modifier,
      amount: row.amount.toString(),
    });
    setCptSearchTerm('');
    setCptInputValue('');
    setDialogOpen(true);
  }, []);

  const closeDialog = (): void => {
    setDialogOpen(false);
    setEditIndex(null);
    setFormData({ code: '', description: '', modifier: '', amount: '' });
    setCptSearchTerm('');
    setCptInputValue('');
  };

  const handleSave = async (): Promise<void> => {
    if (!feeSchedule?.id) return;
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum)) return;

    try {
      if (editIndex != null) {
        await updateCode({
          [idField]: feeSchedule.id,
          index: editIndex,
          code: formData.code,
          description: formData.description || undefined,
          modifier: formData.modifier || undefined,
          amount: amountNum,
        } as any);
        enqueueSnackbar('Procedure code updated', { variant: 'success' });
      } else {
        await addCode({
          [idField]: feeSchedule.id,
          code: formData.code,
          description: formData.description || undefined,
          modifier: formData.modifier || undefined,
          amount: amountNum,
        } as any);
        enqueueSnackbar('Procedure code added', { variant: 'success' });
      }
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
    } catch {
      enqueueSnackbar('Error saving procedure code. Please try again.', { variant: 'error' });
    }
  };

  const handleDelete = useCallback(
    async (index: number): Promise<void> => {
      if (!feeSchedule?.id) return;
      try {
        await deleteCode({ [idField]: feeSchedule.id, index } as any);
        await queryClient.invalidateQueries({ queryKey: [queryKey] });
        enqueueSnackbar('Procedure code removed', { variant: 'success' });
      } catch {
        enqueueSnackbar('Error removing procedure code. Please try again.', { variant: 'error' });
      }
    },
    [feeSchedule?.id, deleteCode, queryClient, idField, queryKey]
  );

  const isSaving = adding || updating;

  const handleUploadCsv = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !feeSchedule?.id) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        enqueueSnackbar('CSV file must have a header row and at least one data row.', { variant: 'error' });
        return;
      }

      const header = lines[0].toLowerCase();
      if (!header.includes('procedure code') || !header.includes('amount')) {
        enqueueSnackbar('CSV must have "Procedure Code" and "Amount" columns.', { variant: 'error' });
        return;
      }

      const codes: { code: string; modifier?: string; amount: number }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < 3) continue;
        const code = values[0].trim();
        const modifier = values[1].trim() || undefined;
        const amount = parseFloat(values[2].trim());
        if (!code || isNaN(amount)) {
          enqueueSnackbar(`Row ${i + 1}: invalid code or amount, skipping.`, { variant: 'warning' });
          continue;
        }
        codes.push({ code, modifier, amount });
      }

      if (codes.length === 0) {
        enqueueSnackbar('No valid rows found in CSV.', { variant: 'error' });
        return;
      }

      await bulkAdd({ [idField]: feeSchedule.id, codes } as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`${codes.length} procedure code(s) uploaded successfully.`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Error uploading CSV. Please try again.', { variant: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = (): void => {
    const link = document.createElement('a');
    link.href = '/fee-schedule-template.csv';
    link.download = 'fee-schedule-template.csv';
    link.click();
  };

  const handleDownloadFeeSchedule = (): void => {
    const rows = [['Procedure Code', 'Modifier', 'Amount']];
    for (const pc of procedureCodes) {
      rows.push([pc.code, pc.modifier, pc.amount.toFixed(2)]);
    }
    const csvContent = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const title = feeSchedule?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'fee-schedule';
    link.download = `${title}_procedure_codes.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderRow = useCallback(
    ({ index: rowIdx, style }: ListChildComponentProps) => {
      const row = filteredCodes[rowIdx];
      const isTruncated = row.description.length > DESCRIPTION_TRUNCATE_LENGTH;
      const displayDescription = isTruncated
        ? `${row.description.substring(0, DESCRIPTION_TRUNCATE_LENGTH)}...`
        : row.description;

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
          <Box sx={{ width: '35%', px: 2, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isTruncated ? (
              <Tooltip title={row.description} arrow>
                <Typography variant="body2" component="span">
                  {displayDescription}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="body2" component="span">
                {displayDescription || '—'}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: '15%', px: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>{row.modifier || '—'}</Box>
          <Box sx={{ width: '20%', px: 2, fontSize: '0.875rem' }}>${row.amount.toFixed(2)}</Box>
          <Box sx={{ width: '15%', px: 2, display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEditDialog(row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => handleDelete(row.index)} disabled={deleting}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      );
    },
    [filteredCodes, deleting, openEditDialog, handleDelete]
  );

  if (isFetching) {
    return <Skeleton height={300} sx={{ marginY: -5 }} />;
  }

  if (!feeSchedule) {
    return <></>;
  }

  return (
    <>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important', mb: 1 }}>
          Procedure Codes &amp; Amounts
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
            ({procedureCodes.length} total)
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage the procedure codes (CPT/HCPCS) and their associated amounts for this fee schedule.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search procedure codes..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={handleDownloadTemplate}
          >
            Download template
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={handleDownloadFeeSchedule}
            disabled={procedureCodes.length === 0}
          >
            Download CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkAdding}
          >
            {bulkAdding ? 'Uploading...' : 'Upload CSV'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={(e) => void handleUploadCsv(e)} />
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={openAddDialog}
          >
            Add procedure code
          </Button>
        </Box>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.50',
              height: ROW_HEIGHT,
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
              {procedureCodes.length === 0
                ? 'No procedure codes yet. Click "Add procedure code" to add a code and amount.'
                : 'No matching procedure codes found.'}
            </Box>
          ) : (
            <FixedSizeList
              height={Math.min(filteredCodes.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT}
              itemCount={filteredCodes.length}
              itemSize={ROW_HEIGHT}
              width="100%"
              overscanCount={10}
            >
              {renderRow}
            </FixedSizeList>
          )}
          {searchText && filteredCodes.length > 0 && filteredCodes.length !== procedureCodes.length && (
            <Box sx={{ px: 2, py: 1, backgroundColor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {filteredCodes.length} of {procedureCodes.length} codes
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editIndex != null ? 'Edit Procedure Code' : 'Add Procedure Code'}</DialogTitle>
        <DialogContent>
          {formData.code && (
            <Box
              sx={{
                mb: 1,
                p: 1.5,
                backgroundColor: 'grey.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {formData.code}
              </Typography>
              {formData.description && (
                <Typography variant="caption" color="text.secondary">
                  {formData.description}
                </Typography>
              )}
            </Box>
          )}
          <Autocomplete<CptOption, false, false, true>
            freeSolo
            options={cptOptions}
            getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} — ${option.display}`)}
            inputValue={cptInputValue}
            value={null}
            loading={isSearchingCpt}
            filterOptions={(x) => x}
            onInputChange={(_e, value, reason) => {
              setCptInputValue(value);
              if (reason === 'input') {
                debounce(() => setCptSearchTerm(value));
              }
            }}
            onChange={(_e, value) => {
              if (value && typeof value !== 'string') {
                setFormData((prev) => ({ ...prev, code: value.code, description: value.display }));
              } else if (typeof value === 'string') {
                setFormData((prev) => ({ ...prev, code: value, description: '' }));
              } else {
                setFormData((prev) => ({ ...prev, code: '', description: '' }));
              }
              setCptInputValue('');
            }}
            noOptionsText={cptSearchTerm.length === 0 ? 'Start typing to search' : 'No codes found'}
            renderInput={(params) => (
              <TextField
                {...params}
                label={formData.code ? 'Change Code (CPT/HCPCS)' : 'Code (CPT/HCPCS)'}
                required={!formData.code}
                margin="dense"
                placeholder="Search by code or description..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isSearchingCpt ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.code}>
                <Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {option.code}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.display}
                  </Typography>
                </Box>
              </li>
            )}
            isOptionEqualToValue={(option, value) => option.code === value.code}
          />
          <TextField
            label="Modifier"
            value={formData.modifier}
            onChange={(e) => setFormData((prev) => ({ ...prev, modifier: e.target.value }))}
            fullWidth
            margin="dense"
            placeholder="e.g. 25"
          />
          <TextField
            label="Amount"
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            fullWidth
            required
            margin="dense"
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            inputProps={{ step: '0.01', min: '0' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.code || !formData.amount || isSaving}
            sx={{ textTransform: 'none' }}
          >
            {isSaving ? 'Saving...' : editIndex != null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
