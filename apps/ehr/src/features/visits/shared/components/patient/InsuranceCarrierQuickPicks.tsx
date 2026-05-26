import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMergedInsuranceQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { InsuranceQuickPickData } from 'utils';
import { QuickPicksButton } from '../QuickPicksButton';

interface InsuranceCarrierQuickPicksProps {
  fieldKey: string;
}

export const InsuranceCarrierQuickPicks: FC<InsuranceCarrierQuickPicksProps> = ({ fieldKey }) => {
  const { setValue } = useFormContext();
  const { quickPicks } = useMergedInsuranceQuickPicks();

  const handleSelect = (pick: InsuranceQuickPickData): void => {
    setValue(fieldKey, { reference: pick.organizationReference, display: pick.name }, { shouldDirty: true });
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
