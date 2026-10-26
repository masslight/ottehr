import { Grid, Typography } from '@mui/material';
import { FC, useMemo } from 'react';
import { formatCalculatedValue } from 'utils/lib/helpers/paperwork/calculated-answers';
import { evaluateEnabledCalculatedItems } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { useCalculationInput } from '../hooks/useCalculationInput';
import { useQRState } from '../hooks/useFormHelpers';
import { StyledQuestionnaireItem } from '../hooks/useStyleItems';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';

interface CalculatedFieldProps {
  item: StyledQuestionnaireItem;
}

// a formula field: its value is derived from the other answers in the form on every render. it is not a form field,
// so it never enters form state; PagedQuestionnaire records it by handing it to the host as `calculatedAnswers`.
// it is evaluated from the same input as that save, so a page that is not enabled counts toward neither
export const CalculatedField: FC<CalculatedFieldProps> = ({ item }) => {
  const calculationInput = useCalculationInput();
  const { formValues } = useQRState();

  const display = useMemo(
    () => formatCalculatedValue(evaluateEnabledCalculatedItems(calculationInput(formValues))[item.linkId]),
    [calculationInput, formValues, item.linkId]
  );

  return (
    <Grid item xs={12} md={item.width} sx={{ maxWidth: '100%' }}>
      <BoldPurpleInputLabel
        id={`${item.linkId}-label`}
        sx={{ whiteSpace: 'pre-wrap', position: 'unset', ...(item.hideControlLabel && { display: 'none' }) }}
      >
        {item.text}
      </BoldPurpleInputLabel>
      <Typography
        variant="body1"
        aria-labelledby={`${item.linkId}-label`}
        data-testid={`calculated-${item.linkId}`}
        sx={{ paddingTop: '8px', paddingBottom: '8px' }}
      >
        {display || '-'}
      </Typography>
    </Grid>
  );
};
