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
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
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
import { dataTestIds } from 'src/constants/data-test-ids';
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
  useGetVersionHistoryQuery,
  useUpdateProcedureCodeMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { ChargeItemMode } from '../ChargeItemList';

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

/** Strip UTF-8 BOM and normalize whitespace */
function cleanHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

/** Priority-ordered patterns for each CSV column type. First match wins. */
const CODE_PATTERNS = [
  /^proc(edure)?\s*code$/,
  /^cpt\s*(\/\s*hcpcs|code)?$/,
  /^hcpcs(\s*code)?$/,
  /^service\s*code$/,
  /^code$/,
  /proc(edure)?/,
  /^cpt/,
];
const AMOUNT_PATTERNS = [/amount/, /price/, /^rate$/, /^fee$/, /^charge$/, /^cost$/];
const MODIFIER_PATTERNS = [/^mod(ifier)?$/];

function findColumnIndex(headers: string[], patterns: RegExp[], exclude: Set<number>): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((c, i) => !exclude.has(i) && pattern.test(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

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

type DeltaStatus = 'Added' | 'Removed' | 'Changed';

interface DeltaRow {
  status: DeltaStatus;
  code: string;
  modifier: string;
  oldAmount?: number;
  newAmount?: number;
}

function codeKey(code: string, modifier: string): string {
  return modifier ? `${code}|${modifier}` : code;
}

function computeDelta(current: ProcedureCodeRow[], previous: ProcedureCodeRow[]): DeltaRow[] {
  const prevMap = new Map<string, ProcedureCodeRow>();
  for (const row of previous) {
    prevMap.set(codeKey(row.code, row.modifier), row);
  }
  const currMap = new Map<string, ProcedureCodeRow>();
  for (const row of current) {
    currMap.set(codeKey(row.code, row.modifier), row);
  }

  const rows: DeltaRow[] = [];

  for (const [key, curr] of currMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      rows.push({ status: 'Added', code: curr.code, modifier: curr.modifier, newAmount: curr.amount });
    } else if (prev.amount !== curr.amount) {
      rows.push({
        status: 'Changed',
        code: curr.code,
        modifier: curr.modifier,
        oldAmount: prev.amount,
        newAmount: curr.amount,
      });
    }
  }

  for (const [key, prev] of prevMap) {
    if (!currMap.has(key)) {
      rows.push({ status: 'Removed', code: prev.code, modifier: prev.modifier, oldAmount: prev.amount });
    }
  }

  return rows;
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

  // Upload preview state
  const [uploadPreviewOpen, setUploadPreviewOpen] = useState(false);
  const [uploadedCodes, setUploadedCodes] = useState<{ code: string; modifier?: string; amount: number }[]>([]);

  const procedureCodes = useMemo(() => extractProcedureCodes(feeSchedule), [feeSchedule]);

  // Compute delta between uploaded CSV codes and current procedure codes
  const uploadDelta = useMemo(() => {
    if (uploadedCodes.length === 0) return [];
    const uploadedRows: ProcedureCodeRow[] = uploadedCodes.map((c, i) => ({
      index: i,
      code: c.code,
      description: '',
      modifier: c.modifier || '',
      amount: c.amount,
    }));
    return computeDelta(uploadedRows, procedureCodes);
  }, [uploadedCodes, procedureCodes]);

  const uploadUnchangedCount = useMemo(() => {
    if (uploadedCodes.length === 0) return 0;
    return uploadedCodes.length - uploadDelta.filter((d) => d.status === 'Added' || d.status === 'Changed').length;
  }, [uploadedCodes, uploadDelta]);

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

    const newKey = codeKey(formData.code, formData.modifier);
    const duplicate = procedureCodes.some((pc, idx) => idx !== editIndex && codeKey(pc.code, pc.modifier) === newKey);
    if (duplicate) {
      enqueueSnackbar(
        `A procedure code with code ${formData.code}${
          formData.modifier ? ` / modifier ${formData.modifier}` : ''
        } already exists.`,
        { variant: 'error' }
      );
      return;
    }

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

      const headerCols = parseCsvLine(cleanHeader(lines[0])).map((col) => col.trim().toLowerCase());
      const claimed = new Set<number>();
      const codeIdx = findColumnIndex(headerCols, CODE_PATTERNS, claimed);
      if (codeIdx >= 0) claimed.add(codeIdx);
      const amountIdx = findColumnIndex(headerCols, AMOUNT_PATTERNS, claimed);
      if (amountIdx >= 0) claimed.add(amountIdx);
      const modifierIdx = findColumnIndex(headerCols, MODIFIER_PATTERNS, claimed);

      if (codeIdx < 0 || amountIdx < 0) {
        enqueueSnackbar('CSV must have "Procedure Code" and "Amount" columns.', { variant: 'error' });
        return;
      }

      const codes: { code: string; modifier?: string; amount: number }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const code = values[codeIdx]?.trim();
        const modifier = modifierIdx >= 0 ? values[modifierIdx]?.trim() || undefined : undefined;
        const amount = parseFloat(values[amountIdx]?.trim());
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

      // Deduplicate by code+modifier (last occurrence wins)
      const dedupMap = new Map<string, { code: string; modifier?: string; amount: number }>();
      for (const c of codes) {
        dedupMap.set(codeKey(c.code, c.modifier || ''), c);
      }
      const dedupedCodes = Array.from(dedupMap.values());
      const dupCount = codes.length - dedupedCodes.length;
      if (dupCount > 0) {
        enqueueSnackbar(`${dupCount} duplicate code/modifier row(s) removed from CSV (last value kept).`, {
          variant: 'warning',
        });
      }

      setUploadedCodes(dedupedCodes);
      setUploadPreviewOpen(true);
    } catch {
      enqueueSnackbar('Error reading CSV file. Please try again.', { variant: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const closeUploadPreview = (): void => {
    setUploadPreviewOpen(false);
    setUploadedCodes([]);
  };

  const handleImportDelta = async (): Promise<void> => {
    if (!feeSchedule?.id) return;
    // Build a map of uploaded codes keyed by code+modifier
    const uploadedMap = new Map<string, { code: string; modifier?: string; amount: number }>();
    for (const c of uploadedCodes) {
      uploadedMap.set(codeKey(c.code, c.modifier || ''), c);
    }
    // Identify which keys are Added or Changed
    const deltaKeys = new Set(
      uploadDelta.filter((d) => d.status === 'Added' || d.status === 'Changed').map((d) => codeKey(d.code, d.modifier))
    );
    if (deltaKeys.size === 0) {
      enqueueSnackbar('No new or changed codes to import.', { variant: 'info' });
      closeUploadPreview();
      return;
    }
    // Merge: start with existing codes, replacing changed ones with new amounts, then append added ones
    const mergedCodes: { code: string; modifier?: string; amount: number }[] = [];
    for (const pc of procedureCodes) {
      const key = codeKey(pc.code, pc.modifier);
      const uploaded = uploadedMap.get(key);
      if (uploaded && deltaKeys.has(key)) {
        // Replace with the uploaded version (new amount)
        mergedCodes.push(uploaded);
      } else {
        mergedCodes.push({ code: pc.code, modifier: pc.modifier || undefined, amount: pc.amount });
      }
    }
    // Append newly added codes (not in existing)
    for (const d of uploadDelta) {
      if (d.status === 'Added') {
        const uploaded = uploadedMap.get(codeKey(d.code, d.modifier));
        if (uploaded) mergedCodes.push(uploaded);
      }
    }
    try {
      await bulkAdd({ [idField]: feeSchedule.id, codes: mergedCodes, replaceAll: true } as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      const changedCount = uploadDelta.filter((d) => d.status === 'Changed').length;
      const addedCount = uploadDelta.filter((d) => d.status === 'Added').length;
      enqueueSnackbar(`Updated ${changedCount} and added ${addedCount} procedure code(s).`, { variant: 'success' });
      closeUploadPreview();
    } catch {
      enqueueSnackbar('Error importing procedure codes. Please try again.', { variant: 'error' });
    }
  };

  const handleReplaceAll = async (): Promise<void> => {
    if (!feeSchedule?.id) return;
    try {
      await bulkAdd({ [idField]: feeSchedule.id, codes: uploadedCodes, replaceAll: true } as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`All procedure codes replaced (${uploadedCodes.length} total).`, { variant: 'success' });
      closeUploadPreview();
    } catch {
      enqueueSnackbar('Error replacing procedure codes. Please try again.', { variant: 'error' });
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
    closeDownloadDialog();
  };

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadMode, setDownloadMode] = useState<'latest' | 'delta'>('latest');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [deltaRows, setDeltaRows] = useState<DeltaRow[]>([]);

  // Fetch version history via zambda when download dialog opens
  const {
    data: historyData,
    isFetching: loadingHistory,
    isError: historyError,
  } = useGetVersionHistoryQuery(feeSchedule?.id, downloadDialogOpen);

  const versionHistory = useMemo(() => {
    if (!historyData?.entries) return [];
    // Skip the latest (current) version for delta comparison
    return historyData.entries.length > 1 ? historyData.entries.slice(1) : [];
  }, [historyData]);

  // Compute delta when a comparison version is selected
  const loadingDelta = false; // delta is computed synchronously from cached data
  useMemo(() => {
    if (downloadMode !== 'delta' || !selectedVersionId || !historyData?.entries) {
      setDeltaRows([]);
      return;
    }
    const oldEntry = historyData.entries.find((e) => e.versionId === selectedVersionId);
    if (!oldEntry) {
      setDeltaRows([]);
      return;
    }
    const oldCodes = extractProcedureCodes(oldEntry.resource);
    const delta = computeDelta(procedureCodes, oldCodes);
    setDeltaRows(delta);
  }, [downloadMode, selectedVersionId, historyData, procedureCodes]);

  const closeDownloadDialog = (): void => {
    setDownloadDialogOpen(false);
    setDownloadMode('latest');
    setSelectedVersionId('');
    setDeltaRows([]);
  };

  const handleDownloadDelta = (): void => {
    const rows = [['Status', 'Procedure Code', 'Modifier', 'Old Amount', 'New Amount']];
    for (const dr of deltaRows) {
      rows.push([
        dr.status,
        dr.code,
        dr.modifier,
        dr.oldAmount != null ? dr.oldAmount.toFixed(2) : '',
        dr.newAmount != null ? dr.newAmount.toFixed(2) : '',
      ]);
    }
    const csvContent = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const title = feeSchedule?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'fee-schedule';
    const selectedVersion = versionHistory.find((v) => v.versionId === selectedVersionId);
    const versionDate = selectedVersion
      ? new Date(selectedVersion.lastUpdated).toISOString().replace(/[:.]/g, '-').slice(0, 19)
      : 'unknown';
    link.download = `${title}_delta_since_${versionDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    closeDownloadDialog();
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
            data-testid={dataTestIds.procedureCodes.searchInput}
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
            onClick={() => setDownloadDialogOpen(true)}
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
            data-testid={dataTestIds.procedureCodes.addButton}
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
            noOptionsText={
              cptSearchTerm.length === 0
                ? 'Start typing to search'
                : 'No codes found — type a custom code and press Enter'
            }
            handleHomeEndKeys
            renderInput={(params) => (
              <TextField
                {...params}
                label={formData.code ? 'Change Code (CPT/HCPCS)' : 'Code (CPT/HCPCS)'}
                required={!formData.code}
                margin="dense"
                placeholder="Search or enter a custom code..."
                helperText={!formData.code ? 'Search for a standard code or type any code and press Enter' : undefined}
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
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            fullWidth
            margin="dense"
            placeholder="e.g. Office visit, new patient"
          />
          <TextField
            label="Modifier"
            value={formData.modifier}
            onChange={(e) => setFormData((prev) => ({ ...prev, modifier: e.target.value }))}
            fullWidth
            margin="dense"
            placeholder="e.g. 25"
            data-testid={dataTestIds.procedureCodes.modifierInput}
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
            data-testid={dataTestIds.procedureCodes.saveButton}
          >
            {isSaving ? 'Saving...' : editIndex != null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={downloadDialogOpen} onClose={closeDownloadDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Download CSV</DialogTitle>
        <DialogContent>
          <RadioGroup value={downloadMode} onChange={(e) => setDownloadMode(e.target.value as 'latest' | 'delta')}>
            <FormControlLabel value="latest" control={<Radio />} label="Latest version (all procedure codes)" />
            <FormControlLabel
              value="delta"
              control={<Radio />}
              label={
                loadingHistory
                  ? 'Delta since a previous version (loading...)'
                  : historyError
                  ? 'Delta since a previous version (unavailable)'
                  : !loadingHistory && versionHistory.length === 0
                  ? 'Delta since a previous version (no prior versions)'
                  : 'Delta since a previous version'
              }
              disabled={loadingHistory || historyError || versionHistory.length === 0}
            />
          </RadioGroup>

          {loadingHistory && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, pl: 4 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Loading version history...
              </Typography>
            </Box>
          )}

          {downloadMode === 'delta' && !loadingHistory && (
            <Box sx={{ mt: 1 }}>
              <TextField
                select
                label="Compare against version"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              >
                {versionHistory.map((v) => (
                  <MenuItem key={v.versionId} value={v.versionId}>
                    {new Date(v.lastUpdated).toLocaleString()}
                  </MenuItem>
                ))}
              </TextField>

              {loadingDelta && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Computing changes...
                  </Typography>
                </Box>
              )}

              {!loadingDelta && selectedVersionId && deltaRows.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No changes found between the selected version and the current version.
                </Typography>
              )}

              {!loadingDelta && deltaRows.length > 0 && (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'grey.50',
                      px: 1.5,
                      py: 0.75,
                    }}
                  >
                    <Typography variant="caption" sx={{ width: '25%', fontWeight: 600 }}>
                      Status
                    </Typography>
                    <Typography variant="caption" sx={{ width: '25%', fontWeight: 600 }}>
                      Code
                    </Typography>
                    <Typography variant="caption" sx={{ width: '15%', fontWeight: 600 }}>
                      Modifier
                    </Typography>
                    <Typography variant="caption" sx={{ width: '17.5%', fontWeight: 600 }}>
                      Old Amt
                    </Typography>
                    <Typography variant="caption" sx={{ width: '17.5%', fontWeight: 600 }}>
                      New Amt
                    </Typography>
                  </Box>
                  {deltaRows.map((dr, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        px: 1.5,
                        py: 0.5,
                        borderBottom: idx < deltaRows.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        backgroundColor:
                          dr.status === 'Added' ? '#E8F5E9' : dr.status === 'Removed' ? '#FFEBEE' : '#FFF8E1',
                      }}
                    >
                      <Typography variant="caption" sx={{ width: '25%', fontWeight: 500 }}>
                        {dr.status}
                      </Typography>
                      <Typography variant="caption" sx={{ width: '25%', fontFamily: 'monospace' }}>
                        {dr.code}
                      </Typography>
                      <Typography variant="caption" sx={{ width: '15%', fontFamily: 'monospace' }}>
                        {dr.modifier || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ width: '17.5%' }}>
                        {dr.oldAmount != null ? `$${dr.oldAmount.toFixed(2)}` : '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ width: '17.5%' }}>
                        {dr.newAmount != null ? `$${dr.newAmount.toFixed(2)}` : '—'}
                      </Typography>
                    </Box>
                  ))}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      backgroundColor: 'grey.50',
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {deltaRows.length} change{deltaRows.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDownloadDialog} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={downloadMode === 'latest' ? handleDownloadFeeSchedule : handleDownloadDelta}
            disabled={downloadMode === 'delta' && (loadingDelta || deltaRows.length === 0)}
            sx={{ textTransform: 'none' }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={uploadPreviewOpen}
        onClose={closeUploadPreview}
        maxWidth="sm"
        fullWidth
        data-testid={dataTestIds.procedureCodes.uploadPreviewDialog}
      >
        <DialogTitle>Upload Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Parsed <strong>{uploadedCodes.length}</strong> code(s) from CSV.
          </Typography>

          {uploadDelta.length === 0 && uploadedCodes.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No changes detected — all uploaded codes match the existing list.
            </Typography>
          )}

          {uploadDelta.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {uploadDelta.filter((d) => d.status === 'Added').length} added,{' '}
                {uploadDelta.filter((d) => d.status === 'Changed').length} changed,{' '}
                {uploadDelta.filter((d) => d.status === 'Removed').length} removed, {uploadUnchangedCount} unchanged
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'grey.50',
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  <Typography variant="caption" sx={{ width: '25%', fontWeight: 600 }}>
                    Status
                  </Typography>
                  <Typography variant="caption" sx={{ width: '25%', fontWeight: 600 }}>
                    Code
                  </Typography>
                  <Typography variant="caption" sx={{ width: '15%', fontWeight: 600 }}>
                    Modifier
                  </Typography>
                  <Typography variant="caption" sx={{ width: '17.5%', fontWeight: 600 }}>
                    Old Amt
                  </Typography>
                  <Typography variant="caption" sx={{ width: '17.5%', fontWeight: 600 }}>
                    New Amt
                  </Typography>
                </Box>
                {uploadDelta.map((dr, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      px: 1.5,
                      py: 0.5,
                      borderBottom: idx < uploadDelta.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      backgroundColor:
                        dr.status === 'Added' ? '#E8F5E9' : dr.status === 'Removed' ? '#FFEBEE' : '#FFF8E1',
                    }}
                  >
                    <Typography variant="caption" sx={{ width: '25%', fontWeight: 500 }}>
                      {dr.status}
                    </Typography>
                    <Typography variant="caption" sx={{ width: '25%', fontFamily: 'monospace' }}>
                      {dr.code}
                    </Typography>
                    <Typography variant="caption" sx={{ width: '15%', fontFamily: 'monospace' }}>
                      {dr.modifier || '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ width: '17.5%' }}>
                      {dr.oldAmount != null ? `$${dr.oldAmount.toFixed(2)}` : '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ width: '17.5%' }}>
                      {dr.newAmount != null ? `$${dr.newAmount.toFixed(2)}` : '—'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeUploadPreview} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={handleImportDelta}
            disabled={
              bulkAdding || uploadDelta.filter((d) => d.status === 'Added' || d.status === 'Changed').length === 0
            }
            sx={{ textTransform: 'none' }}
            data-testid={dataTestIds.procedureCodes.importDeltaButton}
          >
            {bulkAdding ? 'Importing...' : 'Import Delta'}
          </Button>
          <Button
            variant="contained"
            onClick={handleReplaceAll}
            disabled={bulkAdding}
            sx={{ textTransform: 'none' }}
            data-testid={dataTestIds.procedureCodes.replaceAllButton}
          >
            {bulkAdding ? 'Replacing...' : 'Replace All'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
