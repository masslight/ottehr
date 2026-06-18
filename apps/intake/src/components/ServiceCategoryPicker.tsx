import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import HomepageOption from './HomepageOption';

export interface ServiceCategoryOption {
  code: string;
  display: string;
  // Icons resolved at the call site so this component stays neutral on
  // BOOKING_CONFIG vs FHIR-managed categories.
  icon?: ReactNode;
}

interface ServiceCategoryPickerProps {
  options: ServiceCategoryOption[];
  onSelect: (code: string) => void;
  // Each card gets `${dataTestIdPrefix}-${code}`.
  dataTestIdPrefix?: string;
}

// Stateless picker. Caller owns the filter + the onSelect handler.
const ServiceCategoryPicker: FC<ServiceCategoryPickerProps> = ({ options, onSelect, dataTestIdPrefix }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {options.map((opt) => (
        <HomepageOption
          key={opt.code}
          title={opt.display}
          icon={opt.icon ?? <LocalHospitalOutlinedIcon />}
          handleClick={() => onSelect(opt.code)}
          dataTestId={dataTestIdPrefix ? `${dataTestIdPrefix}-${opt.code}` : undefined}
        />
      ))}
    </Box>
  );
};

export default ServiceCategoryPicker;
