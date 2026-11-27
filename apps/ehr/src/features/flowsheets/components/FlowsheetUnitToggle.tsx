import { ToggleButtonGroup } from '@mui/material';
import { ReactElement, useState } from 'react';
import { ContainedPrimaryToggleButton } from 'src/components/ContainedPrimaryToggleButton';
import { useVitalsHeaderUnitSystem } from 'src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem';
import {
  VITALS_HEADER_UNIT_SYSTEM_LABELS,
  VITALS_HEADER_UNIT_SYSTEMS,
  VitalsHeaderUnitSystem,
} from 'utils/lib/types/api/progress-note-config/progress-note-config.types';

export const useFlowsheetUnitSystem = (): [VitalsHeaderUnitSystem, (unitSystem: VitalsHeaderUnitSystem) => void] => {
  const practiceSetting = useVitalsHeaderUnitSystem();
  const [picked, setPicked] = useState<VitalsHeaderUnitSystem>();
  return [picked ?? practiceSetting, setPicked];
};

interface FlowsheetUnitToggleProps {
  value: VitalsHeaderUnitSystem;
  onChange: (unitSystem: VitalsHeaderUnitSystem) => void;
}

export const FlowsheetUnitToggle = ({ value, onChange }: FlowsheetUnitToggleProps): ReactElement => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    onChange={(_, unitSystem: VitalsHeaderUnitSystem | null) => unitSystem && onChange(unitSystem)}
  >
    {VITALS_HEADER_UNIT_SYSTEMS.map((unitSystem) => (
      <ContainedPrimaryToggleButton key={unitSystem} value={unitSystem}>
        {VITALS_HEADER_UNIT_SYSTEM_LABELS[unitSystem]}
      </ContainedPrimaryToggleButton>
    ))}
  </ToggleButtonGroup>
);
