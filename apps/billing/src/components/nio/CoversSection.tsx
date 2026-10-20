import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { NIO_COVERAGE_CATEGORIES, NioCoverageCategory } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { NIO_COVERAGE_CATEGORY_LABELS } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { PayerSelect } from '../PayerSelect';
import { SubmissionMechanismFields } from './SubmissionMechanismFields';

// The "Covers" checkboxes; checking a category expands its detail card. Workers comp is special:
// bill a WC insurance payer (payer picker) or bill the organization directly (submission block).
export function CoversSection(): ReactElement {
  const { control, watch } = useFormContext();
  const enabled = Object.fromEntries(
    NIO_COVERAGE_CATEGORIES.map((category) => [category, watch(`covers.${category}.enabled`) as boolean])
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <FormLabel sx={{ fontSize: 14, color: 'primary.main' }}>Covers</FormLabel>
        <FormGroup row>
          {NIO_COVERAGE_CATEGORIES.map((category) => (
            <Controller
              key={category}
              name={`covers.${category}.enabled`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  }
                  label={NIO_COVERAGE_CATEGORY_LABELS[category]}
                />
              )}
            />
          ))}
        </FormGroup>
      </Box>
      {NIO_COVERAGE_CATEGORIES.filter((category) => enabled[category]).map((category) => (
        <CoverageCard key={category} category={category} />
      ))}
    </Box>
  );
}

function CoverageCard({ category }: { category: NioCoverageCategory }): ReactElement {
  const { control, watch } = useFormContext();
  const billingMode = watch('covers.workers-comp.billingMode') as string;
  const sameAsOrgAddress = watch('covers.workers-comp.sameAsOrgAddress') as boolean;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
        {NIO_COVERAGE_CATEGORY_LABELS[category]}
      </Typography>

      {category === 'workers-comp' && (
        <>
          <FormLabel sx={{ fontSize: 14 }}>Billing</FormLabel>
          <Controller
            name="covers.workers-comp.billingMode"
            control={control}
            render={({ field }) => (
              <RadioGroup row value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                <FormControlLabel value="insurance" control={<Radio size="small" />} label="Bill Insurance" />
                <FormControlLabel value="direct" control={<Radio size="small" />} label="Bill Directly" />
              </RadioGroup>
            )}
          />
          {billingMode === 'insurance' ? (
            <Controller
              name="covers.workers-comp.payerId"
              control={control}
              render={({ field }) => (
                <PayerSelect
                  multiple={false}
                  value={field.value}
                  onChange={field.onChange}
                  label="Workers Comp Insurance Payer"
                  initialOptions={
                    watch('covers.workers-comp.payerOption') ? [watch('covers.workers-comp.payerOption')] : undefined
                  }
                />
              )}
            />
          ) : (
            <>
              <Controller
                name="covers.workers-comp.sameAsOrgAddress"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={!!field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Same as organization address"
                  />
                )}
              />
              <SubmissionMechanismFields prefix="covers.workers-comp.submission" hideMailAddress={sameAsOrgAddress} />
            </>
          )}
        </>
      )}

      {category === 'occupational-medicine' && (
        <SubmissionMechanismFields prefix="covers.occupational-medicine.submission" />
      )}

      {category === 'other' && (
        <>
          <Controller
            name="covers.other.name"
            control={control}
            render={({ field }) => (
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <SubmissionMechanismFields prefix="covers.other.submission" />
        </>
      )}
    </Paper>
  );
}
