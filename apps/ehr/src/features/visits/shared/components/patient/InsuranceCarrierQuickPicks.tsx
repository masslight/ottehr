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
    // Pull the button visually closer to the Insurance carrier field it controls.
    <Box sx={{ mb: -1.5 }}>
      <QuickPicksButton<InsuranceQuickPickData>
        quickPicks={quickPicks}
        getLabel={(pick) => pick.name}
        onSelect={handleSelect}
        searchable
        label="Insurance Carrier Quick Picks"
      />
    </Box>
  );
};
