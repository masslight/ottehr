import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import {
  CreateEmployerInput,
  useActivateEmployerMutation,
  useCreateEmployerMutation,
  useDeactivateEmployerMutation,
  useUpdateEmployerMutation,
} from 'src/rcm/state/employers';
import { CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM } from 'src/rcm/state/employers/employers.api';

type EmployerFormState = {
  name: string;
  category: 'Occupational Medicine';
  active: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  zipPlus4: string;
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
  zip: '',
  zipPlus4: '',
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

export default function EmployerDialog({ open, onClose, employer }: EmployerDialogProps): JSX.Element {
  const queryClient = useQueryClient();
  const createEmployerMutation = useCreateEmployerMutation();
  const updateEmployerMutation = useUpdateEmployerMutation();
  const activateEmployerMutation = useActivateEmployerMutation();
  const deactivateEmployerMutation = useDeactivateEmployerMutation();
  const [form, setForm] = React.useState<EmployerFormState>(INITIAL_EMPLOYER_FORM);
  const [addressExpanded, setAddressExpanded] = React.useState(false);
  const [contactExpanded, setContactExpanded] = React.useState(false);
  const [copiedOttehrId, setCopiedOttehrId] = React.useState(false);
  const [copiedCandidId, setCopiedCandidId] = React.useState(false);
  const isEditMode = Boolean(employer);
  const candidId = employer?.identifier?.find((id) => id.system === CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM)
    ?.value;

  React.useEffect(() => {
    if (!open) return;

    if (!employer) {
      setForm(INITIAL_EMPLOYER_FORM);
      setAddressExpanded(false);
      setContactExpanded(false);
      setCopiedOttehrId(false);
      setCopiedCandidId(false);
      return;
    }

    const primaryAddress = employer.address?.[0];
    const postalCode = (primaryAddress?.postalCode || '').trim();
    const [zip = '', zipPlus4 = ''] = postalCode.split('-');
    const telecom = employer.telecom || [];
    const notesExtension = employer.extension?.find(
      (ext) => ext.url === 'https://extensions.ottehr.com/fhir/StructureDefinition/employer-notes'
    );
    const notes = notesExtension?.valueString || '';

    setForm({
      name: employer.name || '',
      category: (employer.type?.[0]?.text as 'Occupational Medicine') || 'Occupational Medicine',
      active: employer.active !== false,
      addressLine1: primaryAddress?.line?.[0] || '',
      addressLine2: primaryAddress?.line?.[1] || '',
      city: primaryAddress?.city || '',
      state: primaryAddress?.state || '',
      zip,
      zipPlus4,
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
  }, [open, employer]);

  const resetAndClose = (): void => {
    setForm(INITIAL_EMPLOYER_FORM);
    setAddressExpanded(false);
    setContactExpanded(false);
    setCopiedOttehrId(false);
    setCopiedCandidId(false);
    onClose();
  };

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

  const handleSubmit = async (): Promise<void> => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      enqueueSnackbar('Employer name is required', { variant: 'error' });
      return;
    }

    const addressLine1 = form.addressLine1.trim();
    const addressLine2 = form.addressLine2.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    const zip = form.zip.trim();
    const zipPlus4 = form.zipPlus4.trim();
    const formattedPostalCode = zip ? `${zip}${zipPlus4 ? `-${zipPlus4}` : ''}` : '';

    const hasAddress = Boolean(addressLine1 || addressLine2 || city || state || formattedPostalCode);
    const phone = form.phone.trim();
    const fax = form.fax.trim();
    const email = form.email.trim();
    const notes = form.notes.trim();
    const hasContact = Boolean(phone || fax || email || notes);

    const payload: CreateEmployerInput = {
      name: trimmedName,
      active: form.active,
      category: form.category,
      address: hasAddress
        ? {
            line: [addressLine1, addressLine2].filter(Boolean),
            city: city || undefined,
            state: state || undefined,
            postalCode: formattedPostalCode || undefined,
            zipPlus4: zipPlus4 || undefined,
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

      savedEmployer = await updateEmployerMutation.mutateAsync({ employerId: employer.id, ...payload });
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

  const isSubmitting = createEmployerMutation.isPending || updateEmployerMutation.isPending;
  const isStatusUpdating = activateEmployerMutation.isPending || deactivateEmployerMutation.isPending;
  const pillButtonSx = { borderRadius: 999, textTransform: 'none' };

  const handleToggleActivation = async (): Promise<void> => {
    if (!employer?.id) return;

    if (form.active) {
      await deactivateEmployerMutation.mutateAsync({ employerId: employer.id });
      enqueueSnackbar('Employer deactivated', { variant: 'success' });
      setForm((prev) => ({ ...prev, active: false }));
    } else {
      await activateEmployerMutation.mutateAsync({ employerId: employer.id });
      enqueueSnackbar('Employer activated', { variant: 'success' });
      setForm((prev) => ({ ...prev, active: true }));
    }

    await queryClient.invalidateQueries({ queryKey: ['employers'] });
  };

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
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
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={isEditMode && employer?.id ? 6 : 12}>
            <FormControl fullWidth margin="dense">
              <InputLabel id="add-employer-category">Category</InputLabel>
              <Select
                labelId="add-employer-category"
                value={form.category}
                input={<OutlinedInput label="Category" />}
                size="small"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value as 'Occupational Medicine',
                  }))
                }
              >
                <MenuItem value="Occupational Medicine">Occupational Medicine</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {isEditMode && employer?.id && (
            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => void handleToggleActivation()}
                disabled={isStatusUpdating}
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
            </Grid>
          )}

          {isEditMode && employer?.id && (
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  gap: 0.25,
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
            </Grid>
          )}

          <Grid item xs={12}>
            <Accordion
              disableGutters
              elevation={0}
              expanded={addressExpanded}
              onChange={(_, expanded) => setAddressExpanded(expanded)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                <Typography variant="subtitle2">Address (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      margin="dense"
                      label="Address line 1"
                      fullWidth
                      size="small"
                      value={form.addressLine1}
                      onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      margin="dense"
                      label="Address line 2"
                      fullWidth
                      size="small"
                      value={form.addressLine2}
                      onChange={(e) => setForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      margin="dense"
                      label="City"
                      fullWidth
                      size="small"
                      value={form.city}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      margin="dense"
                      label="State"
                      fullWidth
                      size="small"
                      value={form.state}
                      onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      margin="dense"
                      label="ZIP"
                      fullWidth
                      size="small"
                      value={form.zip}
                      onChange={(e) => setForm((prev) => ({ ...prev, zip: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      margin="dense"
                      label="ZIP+4"
                      fullWidth
                      size="small"
                      value={form.zipPlus4}
                      onChange={(e) => setForm((prev) => ({ ...prev, zipPlus4: e.target.value }))}
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
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                <Typography variant="subtitle2">Contact Details (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      margin="dense"
                      label="Phone"
                      fullWidth
                      size="small"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      margin="dense"
                      label="Fax"
                      fullWidth
                      size="small"
                      value={form.fax}
                      onChange={(e) => setForm((prev) => ({ ...prev, fax: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      margin="dense"
                      label="Email"
                      fullWidth
                      size="small"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      margin="dense"
                      label="Notes"
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose} disabled={isSubmitting} variant="outlined" sx={{ ...pillButtonSx, mr: 'auto' }}>
          Cancel
        </Button>
        <Button onClick={() => void handleSubmit()} variant="contained" disabled={isSubmitting} sx={pillButtonSx}>
          {isEditMode ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
