import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  MoreVert as MoreVertIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
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
import { Box, SxProps } from '@mui/system';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { AddClaimWriteOffInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ClaimDetailResponse, ClaimWriteOff } from 'utils/lib/types/data/billing/billing.types';
import { NonPatientWriteOffReasons, PatientWriteOffReasons } from 'utils/lib/types/data/billing/write-off-reasons';
import { formatCurrency } from 'utils/lib/utils/convert';
import { AMOUNT_TOO_SMALL_MESSAGE, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import z from 'zod';
import { addClaimWriteOff, voidClaimWriteOff } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { formatDate } from '../utils/format';
import { Amount } from './Amount';
import { DateInput } from './DateInput';
import { DeleteDialog } from './DeleteDialog';
import { ReadOnlySection, thSx } from './ReadOnlySection';

interface WriteOffForm {
  amount: string;
  party: string;
  payer: string;
  date: string;
  reason: string;
  note: string;
}

export function WriteOffsSection({
  claimId,
  writeOffs,
  balance,
  payerName,
  payerId,
  secondaryPayerName,
  secondaryPayerId,
  tertiaryPayerName,
  tertiaryPayerId,
  quaternaryPayerName,
  quaternaryPayerId,
  refetchClaim,
}: { claimId: string; refetchClaim: () => Promise<void> } & Pick<
  ClaimDetailResponse,
  | 'writeOffs'
  | 'balance'
  | 'payerName'
  | 'payerId'
  | 'secondaryPayerName'
  | 'secondaryPayerId'
  | 'tertiaryPayerName'
  | 'tertiaryPayerId'
  | 'quaternaryPayerName'
  | 'quaternaryPayerId'
>): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: ClaimWriteOff } | null>(null);
  const [voiding, setVoiding] = useState<ClaimWriteOff | null>(null);
  const methods = useForm<WriteOffForm>({
    defaultValues: {
      amount: '',
      party: '',
      payer: '',
      date: '',
      reason: '',
      note: '',
    },
  });
  const { control, handleSubmit, reset, setValue, watch } = methods;
  const amount = watch('amount');
  const party = watch('party');
  useEffect(() => {
    if (party !== 'insurance') {
      setValue('payer', '');
    }
  }, [party, setValue]);
  const reasonOptions = useMemo(() => {
    return party === 'patient' ? PatientWriteOffReasons : NonPatientWriteOffReasons;
  }, [party]);
  useEffect(() => {
    setValue('reason', '');
  }, [reasonOptions, setValue]);
  const submitAdd = useCallback(
    async (form: WriteOffForm) => {
      if (!oystehrZambda) return;
      setSubmitting(true);
      try {
        await addClaimWriteOff(oystehrZambda, {
          claimId,
          amount: Number(form.amount),
          date: form.date,
          party: form.party as z.input<typeof AddClaimWriteOffInputSchema>['party'],
          reason: form.reason,
          note: form.note || undefined,
          payer: form.payer || undefined,
        });
        void refetchClaim();
        setAddModalOpen(false);
      } catch (err) {
        if (err instanceof Error) {
          setSubmitError(err.message);
        } else {
          setSubmitError(JSON.stringify(err));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [claimId, oystehrZambda, refetchClaim]
  );
  const submitVoid = useCallback(async () => {
    if (!oystehrZambda || !voiding) return;
    await voidClaimWriteOff(oystehrZambda, { writeOffId: voiding.id });
    void refetchClaim();
    setVoiding(null);
  }, [oystehrZambda, refetchClaim, voiding]);
  return (
    <ReadOnlySection
      title="Write-offs"
      action={
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => {
            reset();
            setAddModalOpen(true);
          }}
        >
          Add Write-off
        </Button>
      }
    >
      {writeOffs.length === 0 ? (
        'No write-offs yet'
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Date</TableCell>
                  <TableCell sx={thSx}>Responsible Party</TableCell>
                  <TableCell sx={thSx}>Payer</TableCell>
                  <TableCell sx={thSx}>Reason</TableCell>
                  <TableCell sx={thSx}>Note</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                  <TableCell sx={thSx}>Amount</TableCell>
                  <TableCell sx={thSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {writeOffs.map((writeOff) => (
                  <TableRow key={writeOff.id}>
                    <TableCell sx={tcSx(writeOff)}>{formatDate(writeOff.date) || '-'}</TableCell>
                    <TableCell sx={tcSx(writeOff)}>{PartyOptions[writeOff.party] || '-'}</TableCell>
                    <TableCell sx={tcSx(writeOff)}>{writeOff.payer || '-'}</TableCell>
                    <TableCell sx={tcSx(writeOff)}>
                      {writeOff.reason
                        ? writeOff.party === 'patient'
                          ? PatientWriteOffReasons[writeOff.reason]
                          : NonPatientWriteOffReasons[writeOff.reason]
                        : '-'}
                    </TableCell>
                    <TableCell sx={tcSx(writeOff)}>{writeOff.note || '-'}</TableCell>
                    <TableCell sx={tcSx(writeOff)}>{writeOff.status || '-'}</TableCell>
                    <TableCell sx={tcSx(writeOff)}>{formatCurrency(writeOff.amount)}</TableCell>
                    <TableCell>
                      {writeOff.status === 'active' ? (
                        <Tooltip title="More Actions">
                          <IconButton
                            aria-label="More actions"
                            onClick={(event) => setMenu({ anchor: event.currentTarget, row: writeOff })}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title={`Voided on: ${formatDate(writeOff.voidDate ?? '')}`}>
                          <InfoIcon sx={{ fontSize: '18px' }} />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem
              key="void"
              onClick={() => {
                if (!menu) return;
                setSubmitError('');
                setVoiding(menu.row);
                setMenu(null);
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Void Write-off</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="span" variant="h5">
            Add Write-off
          </Typography>
          <IconButton size="small" onClick={() => setAddModalOpen(false)} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FormProvider {...methods}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              {submitError && <Alert severity="error">{submitError}</Alert>}
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2.5 }}>
                <Controller
                  name="amount"
                  control={control}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                    min: { message: AMOUNT_TOO_SMALL_MESSAGE, value: 0.5 },
                  }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      label="Amount *"
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                <Amount
                  label="Remaining Claim Balance"
                  value={balance - Number(amount)}
                  sx={{ justifyContent: '', minWidth: '50%', minHeight: '' }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2.5 }}>
                <Controller
                  name="party"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <FormControl size="small" fullWidth>
                      <InputLabel id="party-select-label" error={!!fieldError}>
                        Write-off For *
                      </InputLabel>
                      <Select
                        label="Write-off For *"
                        labelId="party-select-label"
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldError}
                      >
                        {Object.keys(PartyOptions)
                          .sort()
                          .map((key) => (
                            <MenuItem key={key} value={key}>
                              {PartyOptions[key]}
                            </MenuItem>
                          ))}
                      </Select>
                      {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
                <Controller
                  name="payer"
                  control={control}
                  rules={{ required: party === 'insurance' ? REQUIRED_FIELD_ERROR_MESSAGE : undefined }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <FormControl size="small" fullWidth>
                      <InputLabel id="payer-select-label" error={!!fieldError} disabled={party !== 'insurance'}>
                        Insurance
                      </InputLabel>
                      <Select
                        label="Insurance"
                        labelId="payer-select-label"
                        size="small"
                        disabled={party !== 'insurance'}
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldError}
                      >
                        {payerId ? (
                          <MenuItem key={payerId} value={payerId}>
                            Primary &mdash; {payerName}
                          </MenuItem>
                        ) : (
                          <></>
                        )}
                        {secondaryPayerId ? (
                          <MenuItem key={secondaryPayerId} value={secondaryPayerId}>
                            Secondary &mdash; {secondaryPayerName}
                          </MenuItem>
                        ) : (
                          <></>
                        )}
                        {tertiaryPayerId ? (
                          <MenuItem key={tertiaryPayerId} value={tertiaryPayerId}>
                            Tertiary &mdash; {tertiaryPayerName}
                          </MenuItem>
                        ) : (
                          <></>
                        )}
                        {quaternaryPayerId ? (
                          <MenuItem key={quaternaryPayerId} value={quaternaryPayerId}>
                            Quaternary &mdash; {quaternaryPayerName}
                          </MenuItem>
                        ) : (
                          <></>
                        )}
                      </Select>
                      {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2.5 }}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <DateInput
                      label="Write-off Date *"
                      size="small"
                      fullWidth
                      value={field.value}
                      onChange={(val) => field.onChange(val)}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                <Controller
                  name="reason"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <FormControl size="small" fullWidth>
                      <InputLabel id="reason-select-label" error={!!fieldError}>
                        Reason *
                      </InputLabel>
                      <Select
                        label="Reason *"
                        labelId="reason-select-label"
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldError}
                      >
                        {Object.keys(reasonOptions).map((key) => (
                          <MenuItem key={key} value={key}>
                            {reasonOptions[key]}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Box>
              <Controller
                name="note"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    label="Notes"
                    size="small"
                    multiline
                    minRows={2}
                    maxRows={2}
                    fullWidth
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
            </Box>
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={handleSubmit(submitAdd)}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      <DeleteDialog
        open={!!voiding}
        title="Void Write-off"
        message="Are you sure you want to void this write-off? It will no longer contribute to the claim's balance."
        buttonText="Void"
        buttonTextInProgress="Voiding..."
        onClose={() => setVoiding(null)}
        onDelete={submitVoid}
      />
    </ReadOnlySection>
  );
}

export const PartyOptions: Record<string, string> = {
  insurance: 'Insurance',
  nio: 'Non-Insurance Organization',
  patient: 'Patient',
};

function tcSx(writeOff: ClaimWriteOff): SxProps {
  return {
    color: writeOff.status === 'active' ? 'initial' : 'lightgray',
  };
}
