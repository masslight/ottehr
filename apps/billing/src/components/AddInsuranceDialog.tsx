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
  InputAdornment,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

export const INSURANCE_ID_PREFIX = 'OTR-';

export type AcceptedFormType = 'cms-1500' | 'cms-1450' | 'other';

export type SubmissionMechanism = 'email' | 'portal' | 'fax' | 'mail';

export interface InsuranceContactForm {
  name: string;
  title: string;
  phone: string;
  email: string;
}

export interface AddInsuranceForm {
  name: string;
  // Stored without the OTR- prefix; the prefix is rendered as an input adornment.
  idSuffix: string;
  insuranceTypes: {
    workersComp: boolean;
    auto: boolean;
    medical: boolean;
    other: boolean;
  };
  preferredSubmission: SubmissionMechanism;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  fax: string;
  portalUrl: string;
  portalDetails: string;
  email: string;
  notes: string;
  acceptedForm: AcceptedFormType;
  acceptedFormOther: string;
  contacts: InsuranceContactForm[];
}

const emptyContact: InsuranceContactForm = { name: '', title: '', phone: '', email: '' };

const defaultValues: AddInsuranceForm = {
  name: '',
  idSuffix: '',
  insuranceTypes: { workersComp: false, auto: false, medical: false, other: false },
  preferredSubmission: 'portal',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  fax: '',
  portalUrl: '',
  portalDetails: '',
  email: '',
  notes: '',
  acceptedForm: 'cms-1500',
  acceptedFormOther: '',
  contacts: [],
};

const INSURANCE_TYPE_OPTIONS: { key: keyof AddInsuranceForm['insuranceTypes']; label: string }[] = [
  { key: 'workersComp', label: 'Workers Comp' },
  { key: 'auto', label: 'Auto' },
  { key: 'medical', label: 'Medical' },
  { key: 'other', label: 'Other' },
];

interface AddInsuranceDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: AddInsuranceForm) => void;
}

export function AddInsuranceDialog({ open, onClose, onAdd }: AddInsuranceDialogProps): ReactElement {
  const { control, handleSubmit, reset, watch } = useForm<AddInsuranceForm>({ defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  const acceptedForm = watch('acceptedForm');

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, reset]);

  const handleSave = (data: AddInsuranceForm): void => {
    onAdd(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Insurance</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
          {/* Left: identity + submission info */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Controller
              name="name"
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Insurance Name"
                  size="small"
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="idSuffix"
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="ID"
                  size="small"
                  required
                  InputProps={{ startAdornment: <InputAdornment position="start">{INSURANCE_ID_PREFIX}</InputAdornment> }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <FormControl>
              <FormLabel sx={{ fontSize: 14 }}>Insurance Type</FormLabel>
              <FormGroup row>
                {INSURANCE_TYPE_OPTIONS.map(({ key, label }) => (
                  <Controller
                    key={key}
                    name={`insuranceTypes.${key}`}
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

            <Typography variant="h6" sx={{ mt: 1 }}>
              How to Submit to This Insurance
            </Typography>

            <FormControl>
              <FormLabel sx={{ fontSize: 14 }}>Preferred Submission Mechanism</FormLabel>
              <Controller
                name="preferredSubmission"
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
              <Accordion defaultExpanded={false} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Mail</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Controller
                    name="addressLine1"
                    control={control}
                    render={({ field }) => <TextField {...field} label="Address Line 1" size="small" fullWidth />}
                  />
                  <Controller
                    name="addressLine2"
                    control={control}
                    render={({ field }) => <TextField {...field} label="Address Line 2" size="small" fullWidth />}
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
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded={false} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Fax</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Controller
                    name="fax"
                    control={control}
                    render={({ field }) => <TextField {...field} label="Fax Number" size="small" fullWidth />}
                  />
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded={false} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Online Portal</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Controller
                    name="portalUrl"
                    control={control}
                    render={({ field }) => <TextField {...field} label="Portal URL" size="small" fullWidth />}
                  />
                  <Controller
                    name="portalDetails"
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

              <Accordion defaultExpanded={false} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Email</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => <TextField {...field} label="Email Address" size="small" type="email" fullWidth />}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>

            <Controller
              name="notes"
              control={control}
              render={({ field }) => <TextField {...field} label="Notes" size="small" multiline minRows={2} />}
            />

            <FormControl>
              <FormLabel sx={{ fontSize: 14 }}>Accepted Claim Form</FormLabel>
              <Controller
                name="acceptedForm"
                control={control}
                render={({ field }) => (
                  <RadioGroup {...field} row>
                    <FormControlLabel value="cms-1500" control={<Radio size="small" />} label="CMS-1500" />
                    <FormControlLabel value="cms-1450" control={<Radio size="small" />} label="CMS-1450" />
                    <FormControlLabel value="other" control={<Radio size="small" />} label="Other" />
                  </RadioGroup>
                )}
              />
            </FormControl>
            {acceptedForm === 'other' && (
              <Controller
                name="acceptedFormOther"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Which form do they accept?"
                    size="small"
                    required
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
  );
}
