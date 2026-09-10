import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  INSURANCE_ORG_CLAIM_FORMS,
  INSURANCE_ORG_SUBMISSION_MECHANISMS,
  INSURANCE_ORG_TYPES,
} from 'utils/lib/types/data/billing/insurance-org.schemas';
import {
  INSURANCE_ORG_CLAIM_FORM_LABELS,
  INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS,
  INSURANCE_ORG_TYPE_LABELS,
} from 'utils/lib/types/data/billing/insurance-org.types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { InsuranceOrgForm } from '../../constants/insuranceOrg';

// The whole custom Insurance Organization form body, shared by the create dialog and the detail
// page's edit mode. Must render inside a FormProvider whose values are an InsuranceOrgForm.
export function InsuranceOrgFormFields(): ReactElement {
  const { control } = useFormContext<InsuranceOrgForm>();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
      <Controller
        name="name"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error } }) => (
          <TextField
            label="Organization Name *"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!error}
            helperText={error?.message}
          />
        )}
      />
      <Controller
        name="orgId"
        control={control}
        rules={{
          required: REQUIRED_FIELD_ERROR_MESSAGE,
          pattern: { value: /^OTR-.+$/, message: 'Id must start with "OTR-"' },
        }}
        render={({ field, fieldState: { error } }) => (
          <TextField
            label="Id *"
            placeholder="OTR-"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!error}
            helperText={error?.message ?? 'Must start with "OTR-"'}
          />
        )}
      />

      <Typography variant="subtitle2" color="text.secondary">
        Insurance Type
      </Typography>
      <Controller
        name="insuranceTypes"
        control={control}
        render={({ field }) => (
          <FormGroup row>
            {INSURANCE_ORG_TYPES.map((type) => (
              <FormControlLabel
                key={type}
                label={INSURANCE_ORG_TYPE_LABELS[type]}
                control={
                  <Checkbox
                    size="small"
                    checked={field.value.includes(type)}
                    onChange={(e) => {
                      field.onChange(
                        e.target.checked ? [...field.value, type] : field.value.filter((value) => value !== type)
                      );
                    }}
                  />
                }
              />
            ))}
          </FormGroup>
        )}
      />

      <Controller
        name="submissionMechanism"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error } }) => (
          <FormControl error={!!error}>
            <FormLabel sx={{ fontSize: 14 }}>Submission Mechanism *</FormLabel>
            <RadioGroup row value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {INSURANCE_ORG_SUBMISSION_MECHANISMS.map((mechanism) => (
                <FormControlLabel
                  key={mechanism}
                  value={mechanism}
                  control={<Radio size="small" />}
                  label={INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS[mechanism]}
                />
              ))}
            </RadioGroup>
            {error && <FormHelperText>{error.message}</FormHelperText>}
          </FormControl>
        )}
      />

      <Controller
        name="acceptedClaimForm"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error } }) => (
          <FormControl error={!!error}>
            <FormLabel sx={{ fontSize: 14 }}>Accepted Claim Form *</FormLabel>
            <RadioGroup row value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {INSURANCE_ORG_CLAIM_FORMS.map((claimForm) => (
                <FormControlLabel
                  key={claimForm}
                  value={claimForm}
                  control={<Radio size="small" />}
                  label={INSURANCE_ORG_CLAIM_FORM_LABELS[claimForm]}
                />
              ))}
            </RadioGroup>
            {error && <FormHelperText>{error.message}</FormHelperText>}
          </FormControl>
        )}
      />

      <Controller
        name="note"
        control={control}
        render={({ field }) => (
          <TextField
            label="Note"
            size="small"
            fullWidth
            multiline
            minRows={3}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          />
        )}
      />
    </Box>
  );
}
