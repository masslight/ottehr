import { Box, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, Form, useFormContext } from 'react-hook-form';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  RulesEngineSubmissionInsurance,
  RulesEngineSubmissionType,
} from 'utils/lib/types/data/billing/rules-engine.constants';

export type ClaimSubmissionForm = {
  type: RulesEngineSubmissionType;
  insurance: RulesEngineSubmissionInsurance;
  payerClaimControlNumber: string;
};

export const ClaimSubmissionFormDefaults: ClaimSubmissionForm = {
  type: 'new',
  insurance: 'primary',
  payerClaimControlNumber: '',
};

export function ClaimSubmissionFields({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  const { control, getFieldState, setValue, watch } = useFormContext<ClaimSubmissionForm>();
  const insurance = watch('insurance');
  const type = watch('type');
  const pccn = watch('payerClaimControlNumber');

  // Reset pccn and type on insurance selection change
  useEffect(() => {
    if (!claim) return;
    setValue('type', 'new');
    setValue('payerClaimControlNumber', getPccnForInsuranceOrdinal(claim, insurance) ?? '');
  }, [claim, insurance, setValue]);

  // Reset pccn on type selection change, respecting dirtiness
  useEffect(() => {
    if (!claim) return;
    if (type === 'new') {
      setValue('payerClaimControlNumber', getPccnForInsuranceOrdinal(claim, insurance) ?? '');
      return;
    }
    if (getFieldState('payerClaimControlNumber').isDirty) return;
    setValue('payerClaimControlNumber', getPccnForInsuranceOrdinal(claim, insurance) ?? '');
  }, [claim, insurance, type, getFieldState, setValue]);

  return (
    <Form>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.25, maxWidth: 680 }}>
        {claim.secondaryCoverageFhirId ? (
          <Controller
            name="insurance"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel id="submission-type-label">Select Insurance</FormLabel>
                <RadioGroup
                  aria-labelledby="submission-type-label"
                  name="submission-type-group"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value as RulesEngineSubmissionInsurance)}
                >
                  <FormControlLabel
                    value="primary"
                    control={<Radio />}
                    label={`Primary — ${claim.payerName} (${claim.payerId})`}
                  />
                  {claim.secondaryCoverageFhirId ? (
                    <FormControlLabel
                      value="secondary"
                      control={<Radio />}
                      label={`Secondary — ${claim.secondaryPayerName} (${claim.secondaryPayerId})`}
                    />
                  ) : (
                    <></>
                  )}
                  {claim.tertiaryCoverageFhirId ? (
                    <FormControlLabel
                      value="tertiary"
                      control={<Radio />}
                      label={`Tertiary — ${claim.tertiaryPayerName} (${claim.tertiaryPayerId})`}
                    />
                  ) : (
                    <></>
                  )}
                  {claim.quaternaryCoverageFhirId ? (
                    <FormControlLabel
                      value="quaternary"
                      control={<Radio />}
                      label={`Quaternary — ${claim.quaternaryPayerName} (${claim.quaternaryPayerId})`}
                    />
                  ) : (
                    <></>
                  )}
                </RadioGroup>
              </FormControl>
            )}
          />
        ) : (
          <></>
        )}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel id="submission-type-label">Select Submission Type</FormLabel>
              <RadioGroup
                aria-labelledby="submission-type-label"
                name="submission-type-group"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value as RulesEngineSubmissionType)}
              >
                <FormControlLabel value="new" control={<Radio />} label="New Submission" />
                <FormControlLabel disabled={!pccn} value="correction" control={<Radio />} label="Correction" />
                <FormControlLabel disabled={!pccn} value="void" control={<Radio />} label="Void Claim" />
              </RadioGroup>
            </FormControl>
          )}
        />
        {type !== 'new' ? (
          <Controller
            name="payerClaimControlNumber"
            control={control}
            render={({ field }) => (
              <TextField
                label="Payer Claim Control Number"
                value={field.value}
                required={true}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        ) : (
          <></>
        )}
      </Box>
    </Form>
  );
}

function getPccnForInsuranceOrdinal(
  claim: ClaimDetailResponse,
  insurance: RulesEngineSubmissionInsurance
): string | undefined {
  return insurance === 'primary'
    ? claim.payerClaimControlNumber
    : insurance === 'secondary'
    ? claim.secondaryPayerClaimControlNumber
    : insurance === 'tertiary'
    ? claim.tertiaryPayerClaimControlNumber
    : claim.quaternaryPayerClaimControlNumber;
}
