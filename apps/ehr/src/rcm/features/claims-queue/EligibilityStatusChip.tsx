import { Chip } from '@mui/material';
import { Appointment, CoverageEligibilityResponse } from 'fhir/r4b';
import { FC } from 'react';

// todo: delete this file?
type EligibilityStatusChipProps = {
  eligibilityResponse?: CoverageEligibilityResponse;
  appointment: Appointment;
};

const mapStatusToDisplay: { [value in EligibilityStatus]: { value: string; color: string; background: string } } = {
  passed: { value: 'Passed', color: '#1B5E20', background: '#C8E6C9' },
  bypassed: { value: 'Bypassed', color: '#E65100', background: '#FFE0B2' },
  unsupported: { value: 'Unsupported', color: '#E65100', background: '#FFE0B2' },
  'api-down': { value: 'Api down', color: '#E65100', background: '#FFE0B2' },
  ineligible: { value: 'Ineligible', color: '#B71C1C', background: '#FECDD2' },
};

const ELIGIBILITY_BENEFIT_CODES = 'UC,86,30';

type EligibilityStatus = 'bypassed' | 'unsupported' | 'api-down' | 'passed' | 'ineligible';

const getEligibilityStatus = ({
  eligibilityResponse,
  appointment,
}: {
  eligibilityResponse?: CoverageEligibilityResponse;
  appointment: Appointment;
}): EligibilityStatus => {
  if (!eligibilityResponse) {
    return 'bypassed';
  }

  const failureReason = appointment.meta?.tag?.find((tag) => tag.system?.includes('eligibility-failed-reason'))?.code;
  if (failureReason === 'real-time-eligibility-unsupported') {
    return 'unsupported';
  }
  if (failureReason === 'api-failure') {
    return 'api-down';
  }

  const eligible = eligibilityResponse.insurance?.[0].item?.some((item) => {
    const code = item.category?.coding?.[0].code;
    const isActive = item.benefit?.filter((benefit) => benefit.type.text === 'Active Coverage').length !== 0;
    return isActive && code && ELIGIBILITY_BENEFIT_CODES.includes(code);
  });

  if (eligible) {
    return 'passed';
  } else {
    return 'ineligible';
  }
};

export const EligibilityStatusChip: FC<EligibilityStatusChipProps> = (props) => {
  const { appointment, eligibilityResponse } = props;

  const status = getEligibilityStatus({ appointment, eligibilityResponse });

  return (
    <Chip
      size="small"
      label={mapStatusToDisplay[status].value}
      sx={{
        borderRadius: '4px',
        border: 'none',
        background: mapStatusToDisplay[status].background,
        height: 'auto',
        '& .MuiChip-label': {
          display: 'block',
          whiteSpace: 'normal',
          fontWeight: 500,
          fontSize: '12px',
          color: mapStatusToDisplay[status].color,
          textTransform: 'uppercase',
        },
      }}
      variant="outlined"
    />
  );
};
