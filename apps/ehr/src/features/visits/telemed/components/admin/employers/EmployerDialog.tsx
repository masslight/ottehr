import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ChargeItemDefinition, Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { CHARGE_MASTERS_URL, FEE_SCHEDULES_URL } from 'src/features/admin/adminRoutes';
import { useListChargeMastersQuery } from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  CreateEmployerInput,
  UpdateEmployerInput,
  useCreateEmployerMutation,
  useUpdateEmployerMutation,
} from 'src/rcm/state/employers';
import { CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM } from 'src/rcm/state/employers/employers.api';
import { useListFeeSchedulesQuery } from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CASE_RATE_CODE, RCM_TAG_SYSTEM } from 'utils';

type EmployerFormState = {
  name: string;
  category: 'Occupational Medicine';
  active: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  fax: string;
  email: string;
  notes: string;
};

const INITIAL_EMPLOYER_FORM: EmployerFormState = {
  name: '',
  category: 'Occupational Medicine',
  active: true,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  phone: '',
  fax: '',
  email: '',
  notes: '',
};

interface EmployerDialogProps {
  open: boolean;
  onClose: () => void;
  employer?: Organization | null;
}

function AssociationRow({
  item,
  type,
  linkBase,
}: {
  item: ChargeItemDefinition;
  type: 'fee-schedule' | 'charge-master';
  linkBase: string;
}): JSX.Element {
  const isCaseRate =
    type === 'fee-schedule' && item.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1,
        py: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 0.5,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {item.title || item.description}
          </Typography>
          {type === 'fee-schedule' &&
            (isCaseRate ? (
              <Chip
                label="Case Rate"
                size="small"
                sx={{ fontSize: '0.6rem', height: 18, backgroundColor: '#E65100', color: '#fff' }}
              />
            ) : (
              <Chip
                label="Fee-for-Service"
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 18, borderColor: '#2E7D32', color: '#2E7D32' }}
              />
            ))}
          <Chip
            label={item.status === 'active' ? 'Active' : 'Inactive'}
            size="small"
            sx={{
              fontSize: '0.6rem',
              height: 18,
              ...(item.status === 'active'
                ? { backgroundColor: '#E8F5E9', color: '#2E7D32' }
                : { backgroundColor: '#FFEBEE', color: '#C62828' }),
            }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Effective: {item.date ?? 'N/A'} · {item.propertyGroup?.length ?? 0} procedure codes
        </Typography>
      </Box>
      <Link to={`${linkBase}/${item.id}`}>
        <Button size="small" sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
          View
        </Button>
      </Link>
    </Box>
  );
}

export default function EmployerDialog({ open, onClose, employer }: EmployerDialogProps): JSX.Element {
  const queryClient = useQueryClient();
  const createEmployerMutation = useCreateEmployerMutation();
  const updateEmployerMutation = useUpdateEmployerMutation();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<EmployerFormState>({
    defaultValues: INITIAL_EMPLOYER_FORM,
  });
  const form = watch();

  const [addressExpanded, setAddressExpanded] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [associationsExpanded, setAssociationsExpanded] = useState(false);
  const [copiedOttehrId, setCopiedOttehrId] = useState(false);
  const [copiedCandidId, setCopiedCandidId] = useState(false);
  const isEditMode = Boolean(employer);
  const candidId = employer?.identifier?.find((id) => id.system === CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM)
    ?.value;

  const { data: feeSchedules, isFetching: feeSchedulesFetching } = useListFeeSchedulesQuery({
    enabled: isEditMode && !!employer?.id,
  });
  const { data: chargeMasters, isFetching: chargeMastersFetching } = useListChargeMastersQuery({
    enabled: isEditMode && !!employer?.id,
  });

  const associatedFeeSchedules = useMemo(() => {
    if (!feeSchedules || !employer?.id) return [];
    return feeSchedules.filter(
      (fs) => fs.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${employer.id}`)
    );
  }, [feeSchedules, employer?.id]);

  const associatedChargeMasters = useMemo(() => {
    if (!chargeMasters || !employer?.id) return [];
    return chargeMasters.filter(
      (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${employer.id}`)
    );
  }, [chargeMasters, employer?.id]);

  useEffect(() => {
    if (!open) return;

    if (!employer) {
      reset(INITIAL_EMPLOYER_FORM);
      setAddressExpanded(false);
      setContactExpanded(false);
      setAssociationsExpanded(false);
      setCopiedOttehrId(false);
      setCopiedCandidId(false);
      return;
    }

    const primaryAddress = employer.address?.[0];
    const telecom = employer.telecom || [];
    const notesExtension = employer.extension?.find(
      (ext) => ext.url === 'https://extensions.ottehr.com/fhir/StructureDefinition/employer-notes'
    );
    const notes = notesExtension?.valueString || '';

    reset({
      name: employer.name || '',
      category: 'Occupational Medicine',
      active: employer.active !== false,
      addressLine1: primaryAddress?.line?.[0] || '',
      addressLine2: primaryAddress?.line?.[1] || '',
      city: primaryAddress?.city || '',
      state: primaryAddress?.state || '',
      postalCode: (primaryAddress?.postalCode || '').trim(),
      phone: telecom.find((item) => item.system === 'phone')?.value || '',
      fax: telecom.find((item) => item.system === 'fax')?.value || '',
      email: telecom.find((item) => item.system === 'email')?.value || '',
      notes,
    });

    setAddressExpanded(
      Boolean(
        primaryAddress?.line?.length || primaryAddress?.city || primaryAddress?.state || primaryAddress?.postalCode
      )
    );
    setContactExpanded(Boolean(telecom.length || notes));
    setCopiedOttehrId(false);
    setCopiedCandidId(false);
  }, [open, employer, reset]);

  const resetAndClose = useCallback((): void => {
    reset(INITIAL_EMPLOYER_FORM);
    setAddressExpanded(false);
    setContactExpanded(false);
    setAssociationsExpanded(false);
    setCopiedOttehrId(false);
    setCopiedCandidId(false);
    onClose();
  }, [reset, onClose]);

  const handleCopyEmployerId = async (): Promise<void> => {
    if (!employer?.id) return;

    await navigator.clipboard.writeText(employer.id);
    setCopiedOttehrId(true);
    window.setTimeout(() => setCopiedOttehrId(false), 2000);
  };

  const handleCopyCandidId = async (): Promise<void> => {
    if (!candidId) return;

    await navigator.clipboard.writeText(candidId);
    setCopiedCandidId(true);
    window.setTimeout(() => setCopiedCandidId(false), 2000);
  };

  const isSubmitting = createEmployerMutation.isPending || updateEmployerMutation.isPending;
  const pillButtonSx = { borderRadius: 999, textTransform: 'none' };

  const onSubmit = async (data: EmployerFormState): Promise<void> => {
    if (isEditMode && !isDirty) {
      resetAndClose();
      return;
    }

    const trimmedName = data.name.trim();

    const addressLine1 = data.addressLine1.trim();
    const addressLine2 = data.addressLine2.trim();
    const city = data.city.trim();
    const state = data.state.trim();
    const postalCode = data.postalCode.trim();

    const hasAddress = Boolean(addressLine1 || addressLine2 || city || state || postalCode);
    const phone = data.phone.trim();
    const fax = data.fax.trim();
    const email = data.email.trim();
    const notes = data.notes.trim();
    const hasContact = Boolean(phone || fax || email || notes);

    const payload: CreateEmployerInput = {
      name: trimmedName,
      active: data.active,
      category: data.category,
      address: hasAddress
        ? {
            line: [addressLine1, addressLine2].filter(Boolean),
            city: city || undefined,
            state: state || undefined,
            postalCode: postalCode || undefined,
          }
        : undefined,
      contact: hasContact
        ? {
            phone: phone || undefined,
            fax: fax || undefined,
            email: email || undefined,
            notes: notes || undefined,
          }
        : undefined,
    };

    let savedEmployer: Organization;

    if (isEditMode) {
      if (!employer?.id) {
        enqueueSnackbar('Employer ID is missing; unable to update employer', { variant: 'error' });
        return;
      }

      const updatePayload: UpdateEmployerInput = { employerId: employer.id, ...payload };
      savedEmployer = await updateEmployerMutation.mutateAsync(updatePayload);
    } else {
      savedEmployer = await createEmployerMutation.mutateAsync(payload);
    }

    await queryClient.invalidateQueries({ queryKey: ['employers'] });

    const savedCandidId = savedEmployer.identifier?.find(
      (id) => id.system === CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM
    )?.value;

    if (!savedCandidId) {
      enqueueSnackbar('Employer saved, but Candid sync failed', { variant: 'warning' });
      return;
    }

    enqueueSnackbar(isEditMode ? 'Employer updated successfully' : 'Employer created successfully', {
      variant: 'success',
    });
    resetAndClose();
  };

  const handleToggleActivation = async (): Promise<void> => {
    if (!employer?.id) return;

    const newActive = !form.active;
    await updateEmployerMutation.mutateAsync({ employerId: employer.id, active: newActive });
    enqueueSnackbar(newActive ? 'Employer activated' : 'Employer deactivated', { variant: 'success' });
    reset({ ...form, active: newActive });

    await queryClient.invalidateQueries({ queryKey: ['employers'] });
  };

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth sx={{ '.MuiPaper-root': { padding: 2 } }}>
      <DialogTitle
        variant="h4"
        color="primary.dark"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 3 }}
      >
        {isEditMode ? 'Employer Details' : 'Add Employer'}
        {isEditMode && employer?.id && (
          <BooleanStateChip label={form.active ? 'ACTIVE' : 'INACTIVE'} state={form.active} />
        )}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              autoFocus
              margin="dense"
              label="Employer name"
              fullWidth
              size="small"
              required
              error={!!errors.name}
              helperText={errors.name?.message ?? ''}
              {...register('name', {
                required: 'Employer name is required',
                validate: (v) => !!v.trim() || 'Employer name is required',
              })}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth margin="dense">
              <InputLabel id="add-employer-category">Category</InputLabel>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    labelId="add-employer-category"
                    input={<OutlinedInput label="Category" />}
                    size="small"
                    {...field}
                  >
                    <MenuItem value="Occupational Medicine">Occupational Medicine</MenuItem>
                  </Select>
                )}
              />
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Accordion
              disableGutters
              elevation={0}
              expanded={addressExpanded}
              onChange={(_, expanded) => setAddressExpanded(expanded)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0, m: '0px' }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ px: 0, minHeight: 'unset', '.MuiAccordionSummary-content': { my: '0px' } }}
              >
                <Typography variant="subtitle2">Address (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Grid container spacing={0.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      margin="dense"
                      label="Address line 1"
                      fullWidth
                      size="small"
                      {...register('addressLine1')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      margin="dense"
                      label="Address line 2"
                      fullWidth
                      size="small"
                      {...register('addressLine2')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <TextField margin="dense" label="City" fullWidth size="small" {...register('city')} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField margin="dense" label="State" fullWidth size="small" {...register('state')} />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField
                      margin="dense"
                      label="Postal code"
                      fullWidth
                      size="small"
                      placeholder="12345 or 12345-6789"
                      {...register('postalCode')}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          <Grid item xs={12}>
            <Accordion
              disableGutters
              elevation={0}
              expanded={contactExpanded}
              onChange={(_, expanded) => setContactExpanded(expanded)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0, m: '2px' }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ px: 0, minHeight: 'unset', '.MuiAccordionSummary-content': { my: '2px' } }}
              >
                <Typography variant="subtitle2">Contact Details (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Grid container spacing={0.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField margin="dense" label="Phone" fullWidth size="small" {...register('phone')} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField margin="dense" label="Fax" fullWidth size="small" {...register('fax')} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField margin="dense" label="Email" fullWidth size="small" {...register('email')} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      margin="dense"
                      label="Notes"
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      {...register('notes')}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {isEditMode && employer?.id && (
            <Grid item xs={12}>
              <Accordion
                disableGutters
                elevation={0}
                expanded={associationsExpanded}
                onChange={(_, expanded) => setAssociationsExpanded(expanded)}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0, m: '2px' }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon fontSize="small" />}
                  sx={{ px: 0, minHeight: 'unset', '.MuiAccordionSummary-content': { my: '2px' } }}
                >
                  <Typography variant="subtitle2">
                    Associations
                    {associatedFeeSchedules.length + associatedChargeMasters.length > 0 &&
                      ` (${associatedFeeSchedules.length + associatedChargeMasters.length})`}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {feeSchedulesFetching || chargeMastersFetching ? (
                    <Skeleton height={60} />
                  ) : associatedFeeSchedules.length === 0 && associatedChargeMasters.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No fee schedules or charge masters associated with this employer.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 1 }}>
                      {associatedFeeSchedules.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Fee Schedules
                          </Typography>
                          {associatedFeeSchedules.map((fs) => (
                            <AssociationRow key={fs.id} item={fs} type="fee-schedule" linkBase={FEE_SCHEDULES_URL} />
                          ))}
                        </Box>
                      )}
                      {associatedChargeMasters.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Charge Masters
                          </Typography>
                          {associatedChargeMasters.map((cm) => (
                            <AssociationRow key={cm.id} item={cm} type="charge-master" linkBase={CHARGE_MASTERS_URL} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      {isEditMode && employer?.id && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'grey.100',
            borderRadius: 1,
            mx: 3,
            mb: 2,
            px: 1,
            py: 0.5,
            gap: 0.25,
            fontSize: '0.7rem',
          }}
        >
          {/* Ottehr ID row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 26 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              Ottehr ID:
            </Typography>
            <Tooltip title={copiedOttehrId ? 'Copied' : 'Copy ID'}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => void handleCopyEmployerId()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleCopyEmployerId();
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  minWidth: 0,
                  color: 'text.secondary',
                  '&:hover': { opacity: 0.85 },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'text.secondary',
                  }}
                >
                  {employer.id}
                </Typography>
                {copiedOttehrId ? (
                  <CheckIcon color="success" sx={{ fontSize: 14 }} />
                ) : (
                  <ContentCopyIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                )}
              </Box>
            </Tooltip>
          </Box>

          {/* Candid ID row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 22 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              Candid ID:
            </Typography>
            {candidId ? (
              <Tooltip title={copiedCandidId ? 'Copied' : 'Copy ID'}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleCopyCandidId()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleCopyCandidId();
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    minWidth: 0,
                    color: 'text.secondary',
                    '&:hover': { opacity: 0.85 },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'text.secondary',
                    }}
                  >
                    {candidId}
                  </Typography>
                  {copiedCandidId ? (
                    <CheckIcon color="success" sx={{ fontSize: 14 }} />
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                </Box>
              </Tooltip>
            ) : (
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
                Candid Sync Failed
              </Typography>
            )}
          </Box>
        </Box>
      )}
      <DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
        <Button onClick={resetAndClose} disabled={isSubmitting} variant="outlined" sx={pillButtonSx}>
          Cancel
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isEditMode && employer?.id && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => void handleToggleActivation()}
              disabled={isSubmitting}
              sx={{
                ...pillButtonSx,
                ...(form.active
                  ? {
                      color: 'error.main',
                      borderColor: 'error.main',
                      '&:hover': {
                        borderColor: 'error.main',
                        backgroundColor: 'error.light',
                        color: 'error.dark',
                      },
                    }
                  : {}),
              }}
            >
              {form.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          <Button
            onClick={() => void handleSubmit(onSubmit)()}
            variant="contained"
            disabled={isSubmitting}
            sx={pillButtonSx}
          >
            {isEditMode ? (isDirty ? 'Save' : 'Done') : 'Add'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
