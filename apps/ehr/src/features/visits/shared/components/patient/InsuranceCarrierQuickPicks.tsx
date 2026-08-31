import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMergedInsuranceQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { InsuranceQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { QuickPicksButton } from '../QuickPicksButton';

interface InsuranceCarrierQuickPicksProps {
  fieldKey: string;
  /** Form key for the "Insurance type" choice field; set only when the pick specifies a type. */
  planTypeFieldKey?: string;
  /** Form key for the "Relationship to insured" choice field; set only when the pick specifies one. */
  relationshipFieldKey?: string;
}

export const InsuranceCarrierQuickPicks: FC<InsuranceCarrierQuickPicksProps> = ({
  fieldKey,
  planTypeFieldKey,
  relationshipFieldKey,
}) => {
  const { setValue } = useFormContext();
  const { quickPicks } = useMergedInsuranceQuickPicks();

  const handleSelect = (pick: InsuranceQuickPickData): void => {
    // The pick's name is now an arbitrary label, so the carrier display comes from the stored payer
    // display (falling back to name for legacy picks that predate organizationDisplay).
    setValue(
      fieldKey,
      { reference: pick.organizationReference, display: pick.organizationDisplay || pick.name },
      { shouldDirty: true }
    );
    // Type and relationship are optional: only overwrite the form field when the pick specifies them,
    // otherwise leave the patient's current value untouched.
    if (pick.insuranceType && planTypeFieldKey) {
      setValue(planTypeFieldKey, pick.insuranceType, { shouldDirty: true });
    }
    if (pick.relationship && relationshipFieldKey) {
      setValue(relationshipFieldKey, pick.relationship, { shouldDirty: true });
    }
  };

  return (
    // Mirror the form's Row layout (30% label / 70% input + 5px gap) so the
    // button aligns with the Insurance carrier input column it controls.
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px', mb: -1.5 }}>
      <Box sx={{ flex: '0 1 30%' }} />
      <Box sx={{ flex: '1 1 70%' }}>
        <QuickPicksButton<InsuranceQuickPickData>
          quickPicks={quickPicks}
          getLabel={(pick) => pick.name}
          onSelect={handleSelect}
          searchable
          label="Insurance Carrier Quick Picks"
        />
      </Box>
    </Box>
  );
};
