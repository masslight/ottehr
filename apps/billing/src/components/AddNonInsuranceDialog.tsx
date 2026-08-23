import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Control, Controller, useFieldArray, useForm } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import {
  AddInsuranceDialog,
  AddInsuranceForm,
  InsuranceContactForm,
  SubmissionMechanism,
} from './AddInsuranceDialog';

export interface SubmissionDetailsForm {
  preferred: SubmissionMechanism;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  fax: string;
  portalUrl: string;
  portalDetails: string;
  email: string;
}

const emptySubmission: SubmissionDetailsForm = {
  preferred: 'portal',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  fax: '',
  portalUrl: '',
  portalDetails: '',
  email: '',
};

export interface AddNonInsuranceForm {
  name: string;
  employer: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  covers: {
    workersComp: boolean;
    occMed: boolean;
    medicalClearance: boolean;
    other: boolean;
  };
  coversOtherDetails: string;
  workersCompBilling: 'insurance' | 'direct';
  workersCompInsurance: string;
  workersCompSameAddress: boolean;
  workersCompDirect: SubmissionDetailsForm;
  occMed: SubmissionDetailsForm;
  medClearance: SubmissionDetailsForm;
  contacts: InsuranceContactForm[];
}

const emptyContact: InsuranceContactForm = { name: '', title: '', phone: '', email: '' };

const defaultValues: AddNonInsuranceForm = {
  name: '',
  employer: false,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  covers: { workersComp: false, occMed: false, medicalClearance: false, other: false },
  coversOtherDetails: '',
  workersCompBilling: 'insurance',
  workersCompInsurance: '',
  workersCompSameAddress: false,
  workersCompDirect: { ...emptySubmission },
  occMed: { ...emptySubmission },
  medClearance: { ...emptySubmission },
  contacts: [],
};

const COVERS_OPTIONS: { key: keyof AddNonInsuranceForm['covers']; label: string }[] = [
  { key: 'workersComp', label: 'Workers Comp' },
  { key: 'occMed', label: 'Occupational Medicine' },
  { key: 'medicalClearance', label: 'Medical Clearance' },
  { key: 'other', label: 'Other' },
];

type SubmissionSectionKey = 'workersCompDirect' | 'occMed' | 'medClearance';

// Reusable "how to submit" block (preferred mechanism + mail/fax/portal/email accordions).
function SubmissionSection({
  control,
  section,
  disableAddress,
}: {
  control: Control<AddNonInsuranceForm>;
  section: SubmissionSectionKey;
  disableAddress?: boolean;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FormControl>
        <FormLabel sx={{ fontSize: 14 }}>Preferred Submission Mechanism</FormLabel>
        <Controller
          name={`${section}.preferred`}
          control={control}
          render={({ field }) => (
            <RadioGroup {...field} row>
              <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
              <FormControlLabel value="portal" control={<Radio size="small" />} label="Portal" />
              <FormControlLabel value="fax" control={<Radio size="small" />} label="Fax" />
              <FormControlLabel value="mail" control={<Radio size="small" />} label="Mail" />
            </RadioGroup>
          )}
        />
      </FormControl>

      <Box>
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Mail</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Controller
              name={`${section}.addressLine1`}
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Address Line 1" size="small" fullWidth disabled={disableAddress} />
              )}
            />
            <Controller
              name={`${section}.addressLine2`}
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Address Line 2" size="small" fullWidth disabled={disableAddress} />
              )}
            />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Controller
                name={`${section}.city`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="City" size="small" sx={{ flex: 2 }} disabled={disableAddress} />
                )}
              />
              <Controller
                name={`${section}.state`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="State" size="small" sx={{ flex: 1 }} disabled={disableAddress} />
                )}
              />
              <Controller
                name={`${section}.zip`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="ZIP" size="small" sx={{ flex: 1 }} disabled={disableAddress} />
                )}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Fax</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Controller
              name={`${section}.fax`}
              control={control}
              render={({ field }) => <TextField {...field} label="Fax Number" size="small" fullWidth />}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Online Portal</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Controller
              name={`${section}.portalUrl`}
              control={control}
              render={({ field }) => <TextField {...field} label="Portal URL" size="small" fullWidth />}
            />
            <Controller
              name={`${section}.portalDetails`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Portal Details"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Login instructions, registration requirements, etc."
                />
              )}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Email</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Controller
              name={`${section}.email`}
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Email Address" size="small" type="email" fullWidth />
              )}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
}

interface AddNonInsuranceDialogProps {
  open: boolean;
  insuranceOptions: string[];
  onClose: () => void;
  onAdd: (data: AddNonInsuranceForm) => void;
  // Bubble up insurances created inline via the nested Add Insurance dialog.
  onInsuranceCreated?: (data: AddInsuranceForm) => void;
}

export function AddNonInsuranceDialog({
  open,
  insuranceOptions,
  onClose,
  onAdd,
  onInsuranceCreated,
}: AddNonInsuranceDialogProps): ReactElement {
  const { control, handleSubmit, reset, watch, getValues, setValue } = useForm<AddNonInsuranceForm>({ defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  const [addInsuranceOpen, setAddInsuranceOpen] = useState(false);
  const [localInsuranceOptions, setLocalInsuranceOptions] = useState<string[]>([]);

  const covers = watch('covers');
  const workersCompBilling = watch('workersCompBilling');
  const workersCompSameAddress = watch('workersCompSameAddress');

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setLocalInsuranceOptions([]);
    }
  }, [open, reset]);

  const allInsuranceOptions = [...insuranceOptions, ...localInsuranceOptions];

  const handleSameAddressChange = (checked: boolean): void => {
    setValue('workersCompSameAddress', checked);
    if (checked) {
      setValue('workersCompDirect.addressLine1', getValues('addressLine1'));
      setValue('workersCompDirect.addressLine2', getValues('addressLine2'));
      setValue('workersCompDirect.city', getValues('city'));
      setValue('workersCompDirect.state', getValues('state'));
      setValue('workersCompDirect.zip', getValues('zip'));
    }
  };

  const handleInsuranceCreated = (data: AddInsuranceForm): void => {
    setLocalInsuranceOptions((prev) => [...prev, data.name]);
    setValue('workersCompInsurance', data.name);
    onInsuranceCreated?.(data);
  };

  const handleSave = (data: AddNonInsuranceForm): void => {
    onAdd(data);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 1080, maxWidth: '95vw' } }}>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h5">Add Non-Insurance Organization</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
            {/* Left: identity + coverage */}
            <Box sx={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Controller
                name="name"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Organization Name"
                    size="small"
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="employer"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} size="small" />}
                    label="Employer"
                  />
                )}
              />

              <Typography variant="h6">Organization Address</Typography>
              <Controller
                name="addressLine1"
                control={control}
                render={({ field }) => <TextField {...field} label="Address Line 1" size="small" />}
              />
              <Controller
                name="addressLine2"
                control={control}
                render={({ field }) => <TextField {...field} label="Address Line 2" size="small" />}
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => <TextField {...field} label="City" size="small" sx={{ flex: 2 }} />}
                />
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => <TextField {...field} label="State" size="small" sx={{ flex: 1 }} />}
                />
                <Controller
                  name="zip"
                  control={control}
                  render={({ field }) => <TextField {...field} label="ZIP" size="small" sx={{ flex: 1 }} />}
                />
              </Box>

              <FormControl>
                <FormLabel sx={{ fontSize: 14 }}>Covers</FormLabel>
                <FormGroup row>
                  {COVERS_OPTIONS.map(({ key, label }) => (
                    <Controller
                      key={key}
                      name={`covers.${key}`}
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox {...field} checked={field.value} size="small" />}
                          label={label}
                        />
                      )}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              {covers.workersComp && (
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Workers Comp
                  </Typography>
                  <FormControl>
                    <FormLabel sx={{ fontSize: 14 }}>Billing</FormLabel>
                    <Controller
                      name="workersCompBilling"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field} row>
                          <FormControlLabel value="insurance" control={<Radio size="small" />} label="Bill Insurance" />
                          <FormControlLabel value="direct" control={<Radio size="small" />} label="Bill Directly" />
                        </RadioGroup>
                      )}
                    />
                  </FormControl>

                  {workersCompBilling === 'insurance' && (
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 1.5 }}>
                      <Controller
                        name="workersCompInsurance"
                        control={control}
                        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                        render={({ field, fieldState }) => (
                          <Autocomplete
                            options={allInsuranceOptions}
                            value={field.value || null}
                            onChange={(_, value) => field.onChange(value ?? '')}
                            sx={{ flex: 1 }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Search Insurance"
                                size="small"
                                required
                                error={!!fieldState.error}
                                helperText={fieldState.error?.message}
                              />
                            )}
                          />
                        )}
                      />
                      <Button
                        size="small"
                        startIcon={<AddIcon fontSize="small" />}
                        onClick={() => setAddInsuranceOpen(true)}
                        sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
                      >
                        Add New
                      </Button>
                    </Box>
                  )}

                  {workersCompBilling === 'direct' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={workersCompSameAddress}
                            onChange={(e) => handleSameAddressChange(e.target.checked)}
                            size="small"
                          />
                        }
                        label="Same as organization address"
                      />
                      <SubmissionSection
                        control={control}
                        section="workersCompDirect"
                        disableAddress={workersCompSameAddress}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {covers.occMed && (
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Occupational Medicine
                  </Typography>
                  <SubmissionSection control={control} section="occMed" />
                </Box>
              )}

              {covers.medicalClearance && (
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Medical Clearance
                  </Typography>
                  <SubmissionSection control={control} section="medClearance" />
                </Box>
              )}

              {covers.other && (
                <Controller
                  name="coversOtherDetails"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Other Coverage Details"
                      size="small"
                      required
                      multiline
                      minRows={2}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            </Box>

            {/* Right: contacts */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                borderLeft: 1,
                borderColor: 'divider',
                pl: 5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Contacts</Typography>
                <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => append(emptyContact)}>
                  Add Contact
                </Button>
              </Box>
              {fields.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No contacts added yet.
                </Typography>
              )}
              {fields.map((contactField, index) => (
                <Box
                  key={contactField.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">Contact {index + 1}</Typography>
                    <IconButton size="small" onClick={() => remove(index)} aria-label="Remove contact">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Controller
                    name={`contacts.${index}.name`}
                    control={control}
                    rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Name"
                        size="small"
                        required
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`contacts.${index}.title`}
                    control={control}
                    render={({ field }) => <TextField {...field} label="Title" size="small" />}
                  />
                  <Controller
                    name={`contacts.${index}.phone`}
                    control={control}
                    render={({ field }) => <TextField {...field} label="Phone" size="small" />}
                  />
                  <Controller
                    name={`contacts.${index}.email`}
                    control={control}
                    render={({ field }) => <TextField {...field} label="Email" size="small" type="email" />}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon fontSize="small" />} onClick={handleSubmit(handleSave)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <AddInsuranceDialog
        open={addInsuranceOpen}
        onClose={() => setAddInsuranceOpen(false)}
        onAdd={handleInsuranceCreated}
      />
    </>
  );
}
