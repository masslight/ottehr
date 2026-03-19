import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ChargeItemDefinition } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useMemo, useState } from 'react';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAddProcedureCodeMutation,
  useDeleteProcedureCodeMutation,
  useUpdateProcedureCodeMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';

interface ProcedureCodesProps {
  feeSchedule: ChargeItemDefinition | undefined;
  isFetching: boolean;
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

const DESCRIPTION_TRUNCATE_LENGTH = 60;

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

export default function ProcedureCodes({ feeSchedule, isFetching }: ProcedureCodesProps): ReactElement {
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
  const { mutateAsync: addCode, isPending: adding } = useAddProcedureCodeMutation();
  const { mutateAsync: updateCode, isPending: updating } = useUpdateProcedureCodeMutation();
  const { mutateAsync: deleteCode, isPending: deleting } = useDeleteProcedureCodeMutation();

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

  const openEditDialog = (row: ProcedureCodeRow): void => {
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
  };

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
          feeScheduleId: feeSchedule.id,
          index: editIndex,
          code: formData.code,
          description: formData.description || undefined,
          modifier: formData.modifier || undefined,
          amount: amountNum,
        });
        enqueueSnackbar('Procedure code updated', { variant: 'success' });
      } else {
        await addCode({
          feeScheduleId: feeSchedule.id,
          code: formData.code,
          description: formData.description || undefined,
          modifier: formData.modifier || undefined,
          amount: amountNum,
        });
        enqueueSnackbar('Procedure code added', { variant: 'success' });
      }
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
      closeDialog();
    } catch {
      enqueueSnackbar('Error saving procedure code. Please try again.', { variant: 'error' });
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    if (!feeSchedule?.id) return;
    try {
      await deleteCode({ feeScheduleId: feeSchedule.id, index });
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
      enqueueSnackbar('Procedure code removed', { variant: 'success' });
    } catch {
      enqueueSnackbar('Error removing procedure code. Please try again.', { variant: 'error' });
    }
  };

  const isSaving = adding || updating;

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
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={openAddDialog}
          >
            Add procedure code
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Modifier</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 90 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {procedureCodes.length === 0
                      ? 'No procedure codes yet. Click "Add procedure code" to add a code and amount.'
                      : 'No matching procedure codes found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCodes.map((row) => {
                  const isTruncated = row.description.length > DESCRIPTION_TRUNCATE_LENGTH;
                  const displayDescription = isTruncated
                    ? `${row.description.substring(0, DESCRIPTION_TRUNCATE_LENGTH)}...`
                    : row.description;

                  return (
                    <TableRow key={row.index} hover>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{row.code}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{row.modifier || '—'}</TableCell>
                      <TableCell>${row.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditDialog(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(row.index)}
                              disabled={deleting}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
