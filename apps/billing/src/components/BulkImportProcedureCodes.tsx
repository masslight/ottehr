import { Download as DownloadIcon, Upload as UploadIcon } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import {
  BillingChargeItemDefinition,
  BillingChargeItemDefinitionProcedureCode,
  ChargeItemDefinitionType,
  getApiError,
} from 'utils';
import { bulkAddChargeItemDefinitionProcedureCodes } from '../api/api';
import { ChargeItemDefinitionLabels } from '../constants/chargeItemDefinition';
import { useApiClients } from '../hooks/useAppClients';

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
const DESCRIPTION_PATTERNS = [/^desc(ription)?$/, /desc/];

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

function parseAmount(raw: string | undefined): number {
  const cleaned = raw?.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!cleaned) return NaN;
  // Number('') / parseFloat('12abc') pitfalls: validate the entire cleaned value
  return Number(cleaned);
}

function codeKey(pc: Pick<BillingChargeItemDefinitionProcedureCode, 'code' | 'modifier'>): string {
  return `${pc.code}|${pc.modifier ?? ''}`;
}

type DeltaStatus = 'added' | 'changed' | 'removed';

interface DeltaRow {
  status: DeltaStatus;
  code: BillingChargeItemDefinitionProcedureCode;
  previousAmount?: number;
}

function computeDelta(
  current: BillingChargeItemDefinitionProcedureCode[],
  uploaded: BillingChargeItemDefinitionProcedureCode[],
  csvHasDescriptions: boolean
): { rows: DeltaRow[]; unchangedCount: number } {
  const currentByKey = new Map(current.map((pc) => [codeKey(pc), pc]));
  const uploadedKeys = new Set(uploaded.map(codeKey));
  const rows: DeltaRow[] = [];
  let unchangedCount = 0;
  for (const pc of uploaded) {
    const existing = currentByKey.get(codeKey(pc));
    if (!existing) {
      rows.push({ status: 'added', code: pc });
    } else if (existing.amount !== pc.amount || (csvHasDescriptions && pc.description !== existing.description)) {
      rows.push({ status: 'changed', code: pc, previousAmount: existing.amount });
    } else {
      unchangedCount++;
    }
  }
  for (const pc of current) {
    if (!uploadedKeys.has(codeKey(pc))) {
      rows.push({ status: 'removed', code: pc });
    }
  }
  return { rows, unchangedCount };
}

const DELTA_CHIP_COLOR: Record<DeltaStatus, 'success' | 'warning' | 'error'> = {
  added: 'success',
  changed: 'warning',
  removed: 'error',
};

export function BulkImportProcedureCodes({
  type,
  cid,
  onSaved,
}: {
  type: ChargeItemDefinitionType;
  cid: BillingChargeItemDefinition;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedCodes, setUploadedCodes] = useState<BillingChargeItemDefinitionProcedureCode[]>([]);
  const [csvHasDescriptions, setCsvHasDescriptions] = useState(false);
  const [skippedRows, setSkippedRows] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delta = useMemo(
    () => computeDelta(cid.procedureCodes, uploadedCodes, csvHasDescriptions),
    [cid.procedureCodes, csvHasDescriptions, uploadedCodes]
  );
  const addedCount = delta.rows.filter((r) => r.status === 'added').length;
  const changedCount = delta.rows.filter((r) => r.status === 'changed').length;
  const removedCount = delta.rows.filter((r) => r.status === 'removed').length;

  const handleUploadCsv = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        enqueueSnackbar('CSV file must have a header row and at least one data row.', { variant: 'error' });
        return;
      }
      const headerCols = parseCsvLine(lines[0]).map(cleanHeader);
      const claimed = new Set<number>();
      const codeIdx = findColumnIndex(headerCols, CODE_PATTERNS, claimed);
      if (codeIdx >= 0) claimed.add(codeIdx);
      const amountIdx = findColumnIndex(headerCols, AMOUNT_PATTERNS, claimed);
      if (amountIdx >= 0) claimed.add(amountIdx);
      const modifierIdx = findColumnIndex(headerCols, MODIFIER_PATTERNS, claimed);
      if (modifierIdx >= 0) claimed.add(modifierIdx);
      const descriptionIdx = findColumnIndex(headerCols, DESCRIPTION_PATTERNS, claimed);
      if (codeIdx < 0 || amountIdx < 0) {
        enqueueSnackbar('CSV must have "Procedure Code" and "Amount" columns.', { variant: 'error' });
        return;
      }

      const codes: BillingChargeItemDefinitionProcedureCode[] = [];
      const skipped: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const code = values[codeIdx]?.trim();
        const amount = parseAmount(values[amountIdx]);
        if (!code || !Number.isFinite(amount) || amount < 0) {
          skipped.push(`Row ${i + 1}: invalid code or amount`);
          continue;
        }
        const modifier = modifierIdx >= 0 ? values[modifierIdx]?.trim() || undefined : undefined;
        const description = descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || undefined : undefined;
        codes.push({ code, description, modifier, amount });
      }
      if (!codes.length) {
        enqueueSnackbar('No valid rows found in the CSV file.', { variant: 'error' });
        return;
      }

      const dedupedByKey = new Map(codes.map((pc) => [codeKey(pc), pc]));
      setUploadedCodes([...dedupedByKey.values()]);
      setCsvHasDescriptions(descriptionIdx >= 0);
      setSkippedRows(skipped);
      setError(null);
      setPreviewOpen(true);
    } catch {
      enqueueSnackbar('Error reading CSV file. Please try again.', { variant: 'error' });
    }
  }, []);

  const saveCodes = useCallback(
    async (procedureCodes: BillingChargeItemDefinitionProcedureCode[]): Promise<void> => {
      if (!oystehrZambda) {
        setError('Client not ready');
        return;
      }
      setImporting(true);
      setError(null);
      try {
        await bulkAddChargeItemDefinitionProcedureCodes(oystehrZambda, {
          type,
          chargeItemDefinitionId: cid.id,
          procedureCodes,
          replaceAll: true,
        });
        await onSaved();
        setPreviewOpen(false);
        enqueueSnackbar('Procedure codes imported successfully.', { variant: 'success' });
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to import procedure codes' }));
      } finally {
        setImporting(false);
      }
    },
    [cid.id, onSaved, oystehrZambda, type]
  );

  // When the CSV has no description column, rows matched by code+modifier keep their existing description.
  // When the column is present, its cells are authoritative — a blank cell clears the description.
  const withDescriptionFallback = useCallback(
    (codes: BillingChargeItemDefinitionProcedureCode[]): BillingChargeItemDefinitionProcedureCode[] => {
      if (csvHasDescriptions) return codes;
      const currentByKey = new Map(cid.procedureCodes.map((pc) => [codeKey(pc), pc]));
      return codes.map((pc) => ({ ...pc, description: currentByKey.get(codeKey(pc))?.description }));
    },
    [cid.procedureCodes, csvHasDescriptions]
  );

  const handleImportDelta = useCallback(async (): Promise<void> => {
    const uploadedByKey = new Map(withDescriptionFallback(uploadedCodes).map((pc) => [codeKey(pc), pc]));
    const merged = cid.procedureCodes.map((pc) => uploadedByKey.get(codeKey(pc)) ?? pc);
    const currentKeys = new Set(cid.procedureCodes.map(codeKey));
    for (const pc of uploadedByKey.values()) {
      if (!currentKeys.has(codeKey(pc))) merged.push(pc);
    }
    await saveCodes(merged);
  }, [cid.procedureCodes, saveCodes, uploadedCodes, withDescriptionFallback]);

  const handleReplaceAll = useCallback(async (): Promise<void> => {
    await saveCodes(withDescriptionFallback(uploadedCodes));
  }, [saveCodes, uploadedCodes, withDescriptionFallback]);

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={(e) => void handleUploadCsv(e)} />
      <Button variant="outlined" startIcon={<DownloadIcon />} component="a" href="/charge-master-template.csv" download>
        Download Template
      </Button>
      <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
        Upload CSV
      </Button>
      <Dialog
        open={previewOpen}
        onClose={() => !importing && setPreviewOpen(false)}
        maxWidth={false}
        PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Bulk Import Preview</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {skippedRows.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Skipped {skippedRows.length} invalid row{skippedRows.length === 1 ? '' : 's'}:{' '}
              {skippedRows.slice(0, 5).join('; ')}
              {skippedRows.length > 5 ? '; …' : ''}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {addedCount} added · {changedCount} changed · {removedCount} removed · {delta.unchangedCount} unchanged
          </Typography>
          {delta.rows.length === 0 ? (
            <Alert severity="info">
              The uploaded file matches the current procedure codes exactly. There is nothing to import.
            </Alert>
          ) : (
            <Box sx={{ border: '1px solid', borderColor: 'divider', maxHeight: 420, overflow: 'auto' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'grey.50',
                  height: 45,
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Box sx={{ width: '12%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Status</Box>
                <Box sx={{ width: '15%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Code</Box>
                <Box sx={{ width: '38%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Description</Box>
                <Box sx={{ width: '15%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Modifier</Box>
                <Box sx={{ width: '20%', px: 2, fontWeight: 600, fontSize: '0.875rem' }}>Amount</Box>
              </Box>
              {delta.rows.map((row) => (
                <Box
                  key={`${row.status}-${codeKey(row.code)}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    minHeight: 45,
                  }}
                >
                  <Box sx={{ width: '12%', px: 2 }}>
                    <Chip label={row.status} size="small" color={DELTA_CHIP_COLOR[row.status]} variant="outlined" />
                  </Box>
                  <Box sx={{ width: '15%', px: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>{row.code.code}</Box>
                  <Box sx={{ width: '38%', px: 2, fontSize: '0.875rem' }}>
                    {row.code.description ? row.code.description.substring(0, 60) : '—'}
                  </Box>
                  <Box sx={{ width: '15%', px: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {row.code.modifier || '—'}
                  </Box>
                  <Box sx={{ width: '20%', px: 2, fontSize: '0.875rem' }}>
                    {row.status === 'changed' && row.previousAmount !== undefined
                      ? `$${row.previousAmount.toFixed(2)} → $${row.code.amount.toFixed(2)}`
                      : `$${row.code.amount.toFixed(2)}`}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            "Import Delta" applies additions and changes but keeps codes that are missing from the file. "Replace All"
            makes this {ChargeItemDefinitionLabels[type].singularText} match the file exactly
            {removedCount > 0 ? `, removing ${removedCount} existing code${removedCount === 1 ? '' : 's'}` : ''}.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewOpen(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleReplaceAll()}
            disabled={importing || delta.rows.length === 0}
          >
            Replace All
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleImportDelta()}
            disabled={importing || addedCount + changedCount === 0}
          >
            {importing ? 'Importing...' : 'Import Delta'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
