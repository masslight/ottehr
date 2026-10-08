import { Grid, Typography } from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useMemo } from 'react';
import { evaluateCalculatedItems, formatCalculatedValue } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { usePaperworkContext } from '../context';
import { useQRState } from '../hooks/useFormHelpers';
import { StyledQuestionnaireItem } from '../hooks/useStyleItems';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';

interface CalculatedFieldProps {
  item: StyledQuestionnaireItem;
}

// a formula field: its value is derived from the other answers in the form on every render and is never stored
export const CalculatedField: FC<CalculatedFieldProps> = ({ item }) => {
  const { allItems } = usePaperworkContext();
  const { allFields } = useQRState();

  const display = useMemo(() => {
    const qrItems = Object.values(allFields).filter(
      (field): field is QuestionnaireResponseItem =>
        typeof field === 'object' && field !== null && typeof field.linkId === 'string'
    );
    return formatCalculatedValue(evaluateCalculatedItems(allItems, qrItems)[item.linkId]);
  }, [allFields, allItems, item.linkId]);

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
