import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import HomepageOption from './HomepageOption';

export interface ServiceCategoryOption {
  /** URL-safe slug; what the caller cares about and what gets emitted by onSelect. */
  code: string;
  /** Human-readable label shown on the card. */
  display: string;
  /**
   * Optional override; falls back to a generic hospital icon. Callers that want
   * brand-specific icons (urgent-care, workers-comp, etc.) should resolve them
   * upstream and pass them in — keeping the icon map at the call site avoids
   * baking BOOKING_CONFIG-specific knowledge into a presentational component
   * that's also going to be used by FHIR-admin-managed categories.
   */
  icon?: ReactNode;
}

interface ServiceCategoryPickerProps {
  options: ServiceCategoryOption[];
  onSelect: (code: string) => void;
  /**
   * Optional test-id prefix; each card gets `${dataTestIdPrefix}-${code}` so
   * tests can target a specific category without hard-coding the icon shape.
   */
  dataTestIdPrefix?: string;
}

/**
 * Stateless picker UI for service categories. Knows nothing about URLs,
 * data fetching, or which-flow-am-I-in — every concern is lifted to the
 * caller. The intent is that walk-in, prebook, and any future flow can mount
 * this with their own filtered option list and their own onSelect handler.
 *
 * Pair with `useServiceCategories({ scheduleType, bookingOn })` on the
 * caller side when fetching the list, then filter to the relevant
 * `visitTypes` before passing in.
 */
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
