import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

export type QueueContext = 'insurance' | 'patient' | 'non-insurance';

const CONTEXT_LABELS: Record<QueueContext, string> = {
  insurance: 'Insurance',
  patient: 'Patient',
  'non-insurance': 'Non-Insurance',
};

// Status sets per AR context; the toggle swaps between the pre and post sets.
export const QUEUE_STATUS_SETS: Record<
  QueueContext,
  { toggleLabel: string; preLabel: string; postLabel: string; pre: string[]; post: string[] }
> = {
  insurance: {
    toggleLabel: 'Pre-Submission',
    preLabel: 'Pre-Submission Statuses',
    postLabel: 'Post-Submission Statuses',
    pre: ['None', 'Created'],
    post: ['Submitted', 'Adjudicated', 'Finalized'],
  },
  patient: {
    toggleLabel: 'Pre-Invoice',
    preLabel: 'Pre-Invoice Statuses',
    postLabel: 'Post-Invoice Statuses',
    pre: ['None', 'Not Invoiced', 'Ready to Invoice'],
    post: ['Invoiced', 'Paid'],
  },
  'non-insurance': {
    toggleLabel: 'Pre-Invoice',
    preLabel: 'Pre-Invoice Statuses',
    postLabel: 'Post-Invoice Statuses',
    pre: ['None', 'Not Invoiced', 'Ready to Invoice'],
    post: ['Invoiced', 'Paid'],
  },
};

// Fake non-insurance organizations, matching the Non-Insurance Organizations screen.
export const NON_INSURANCE_ORG_OPTIONS = [
  'Acme Manufacturing',
  'City Transit Authority',
  'Harbor Logistics Group',
  'Bright Path Staffing',
  'Summit Construction Co.',
];

export const QUEUE_OWNER_OPTIONS = ['Sarah Chen', 'Mike Rodriguez', 'Emily Parker', 'James Wu', 'Priya Natarajan'];

// Same plan types as insurance entry on visit details, shown with their claim filing codes.
const PLAN_TYPE_OPTIONS = VALUE_SETS.insuranceTypeOptions.map((option) => `${option.label} (${option.candidCode})`);

// Fake filter options until queues are backed by real data.
const PAYER_OPTIONS = [
  'Medicaid (MCD001)',
  'Medicare (MCR001)',
  'Blue Cross Blue Shield (00060)',
  'UnitedHealthcare (87726)',
  'Aetna (60054)',
  'Cigna (62308)',
  'Tricare (TREST)',
  'Humana (61101)',
];
const BILLING_ORG_OPTIONS = ['Ottehr Medical Group', 'Downtown Clinic LLC', 'Lakeside Physicians PA'];
const SERVICE_FACILITY_OPTIONS = ['Main Street Clinic', 'Northside Urgent Care', 'Harbor Health Center'];
const RENDERING_PROVIDER_OPTIONS = ['Dr. Alice Morgan', 'Dr. Ben Ortiz', 'Dr. Carol Singh', 'Dr. David Klein'];
const CPT_CODE_OPTIONS = ['99213', '99214', '99203', '99204', '73030', '81002'];
const MODIFIER_OPTIONS = ['25', '59', 'LT', 'RT', 'TC', '26'];
const DX_CODE_OPTIONS = ['M54.50', 'J06.9', 'S93.401A', 'Z00.00', 'E11.9', 'I10', 'M25.561'];

export interface WorkQueueForm {
  name: string;
  description: string;
  organization: string;
  preSubmission: boolean;
  statuses: string[];
  insuranceTypes: string[];
  payers: string[];
  billingOrganizations: string[];
  serviceFacilities: string[];
  renderingProviders: string[];
  cptCodes: string[];
  modifiers: string[];
  dxCodes: string[];
  owner: string;
}

const defaultValues: WorkQueueForm = {
  name: '',
  description: '',
  organization: '',
  preSubmission: false,
  statuses: [],
  insuranceTypes: [],
  payers: [],
  billingOrganizations: [],
  serviceFacilities: [],
  renderingProviders: [],
  cptCodes: [],
  modifiers: [],
  dxCodes: [],
  owner: '',
};

interface CreateWorkQueueDialogProps {
  open: boolean;
  context?: QueueContext;
  onClose: () => void;
  onCreate: (data: WorkQueueForm) => void;
}

export function CreateWorkQueueDialog({
  open,
  context = 'insurance',
  onClose,
  onCreate,
}: CreateWorkQueueDialogProps): ReactElement {
  const { control, handleSubmit, reset, watch, setValue } = useForm<WorkQueueForm>({ defaultValues });

  const statusSet = QUEUE_STATUS_SETS[context];
  const preSubmission = watch('preSubmission');
  const statusOptions = preSubmission ? statusSet.pre : statusSet.post;

  useEffect(() => {
    // All statuses of the selected mode start selected.
    if (open) reset({ ...defaultValues, statuses: [...QUEUE_STATUS_SETS[context].post] });
  }, [open, context, reset]);

  const handleSave = (data: WorkQueueForm): void => {
    onCreate(data);
    onClose();
  };

  const multiAutocomplete = (
    name: keyof Pick<
      WorkQueueForm,
      | 'insuranceTypes'
      | 'payers'
      | 'billingOrganizations'
      | 'serviceFacilities'
      | 'renderingProviders'
      | 'cptCodes'
      | 'modifiers'
      | 'dxCodes'
    >,
    label: string,
    options: string[],
    freeSolo = false
  ): ReactElement => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          freeSolo={freeSolo}
          options={options}
          value={field.value}
          onChange={(_, value) => field.onChange(value)}
          renderInput={(params) => <TextField {...params} label={label} size="small" />}
        />
      )}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 640, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Create Work Queue</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create a work queue for {CONTEXT_LABELS[context]} AR
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Controller
            name="name"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Queue Name"
                size="small"
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                size="small"
                multiline
                minRows={2}
                placeholder="Left blank, a description is generated from the selected filters."
              />
            )}
          />

          {context === 'non-insurance' && (
            <Controller
              name="organization"
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Organization"
                  size="small"
                  select
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {NON_INSURANCE_ORG_OPTIONS.map((org) => (
                    <MenuItem key={org} value={org}>
                      {org}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          <FormControlLabel
            control={
              <Controller
                name="preSubmission"
                control={control}
                render={({ field }) => (
                  <Switch
                    {...field}
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      setValue('statuses', e.target.checked ? [...statusSet.pre] : [...statusSet.post]);
                    }}
                    size="small"
                  />
                )}
              />
            }
            label={statusSet.toggleLabel}
          />

          <Controller
            name="statuses"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                options={statusOptions}
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={preSubmission ? statusSet.preLabel : statusSet.postLabel}
                    size="small"
                  />
                )}
              />
            )}
          />

          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Claim Filters
          </Typography>
          {context !== 'non-insurance' && multiAutocomplete('insuranceTypes', 'Insurance Plan Type', PLAN_TYPE_OPTIONS)}
          {context !== 'non-insurance' && multiAutocomplete('payers', 'Insurance Payer (Name / ID)', PAYER_OPTIONS)}
          {multiAutocomplete('billingOrganizations', 'Billing Organization', BILLING_ORG_OPTIONS)}
          {multiAutocomplete('serviceFacilities', 'Service Facility', SERVICE_FACILITY_OPTIONS)}
          {multiAutocomplete('renderingProviders', 'Rendering Provider', RENDERING_PROVIDER_OPTIONS)}
          {multiAutocomplete('cptCodes', 'CPT Code', CPT_CODE_OPTIONS, true)}
          {context !== 'non-insurance' && multiAutocomplete('modifiers', 'Modifier', MODIFIER_OPTIONS, true)}
          {multiAutocomplete('dxCodes', 'DX Code (ICD-10)', DX_CODE_OPTIONS, true)}

          <Controller
            name="owner"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Queue Owner (Optional)" size="small" select>
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {QUEUE_OWNER_OPTIONS.map((owner) => (
                  <MenuItem key={owner} value={owner}>
                    {owner}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon fontSize="small" />} onClick={handleSubmit(handleSave)}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
