import { Box, IconButton, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { commaFormattedName } from 'utils/lib/fhir/billing';
import { formatNdcForDisplay } from 'utils/lib/types/data/billing/billing.constants';
import { RichTooltip } from '../RichTooltip';
import { CapsuleIcon } from './CapsuleIcon';
import { DoctorIcon } from './DoctorIcon';

interface IndicatorDrug {
  ndc: string;
  quantity: string | number;
  units: string;
}

interface IndicatorProvider {
  firstName: string;
  lastName: string;
  npi?: string;
}

interface ServiceLineIndicatorsProps {
  drug: IndicatorDrug | null;
  orderingProvider: IndicatorProvider | null;
  onDrugClick: () => void;
  onProviderClick: () => void;
}

const TooltipContent = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}): ReactElement => (
  <Box sx={{ m: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {icon}
      <Typography variant="subtitle2">{title}</Typography>
    </Box>
    {children}
  </Box>
);

/**
 * Medication (NDC) + ordering-provider indicators shown to the left of a service line number.
 * Blue when the detail exists, grey when it doesn't; hover shows the detail, click opens its dialog.
 */
export function ServiceLineIndicators({
  drug,
  orderingProvider,
  onDrugClick,
  onProviderClick,
}: ServiceLineIndicatorsProps): ReactElement {
  return (
    <>
      <RichTooltip
        placement="top-start"
        customWidth={300}
        title={
          <TooltipContent
            icon={<CapsuleIcon sx={{ fontSize: 18, color: drug ? 'primary.main' : 'grey.500' }} />}
            title="Medication"
          >
            {drug ? (
              <>
                <Typography variant="body2">NDC: {formatNdcForDisplay(drug.ndc)}</Typography>
                <Typography variant="body2">
                  Quantity: {drug.quantity} {drug.units}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Add medication details for this service line
              </Typography>
            )}
          </TooltipContent>
        }
      >
        <IconButton
          size="small"
          onClick={onDrugClick}
          aria-label="Medication detail"
          sx={{ p: 0.25, color: drug ? 'primary.main' : 'grey.500' }}
        >
          <CapsuleIcon sx={{ fontSize: 24 }} />
        </IconButton>
      </RichTooltip>
      <RichTooltip
        placement="top-start"
        customWidth={300}
        title={
          <TooltipContent
            icon={<DoctorIcon sx={{ fontSize: 18, color: orderingProvider ? 'primary.main' : 'grey.500' }} />}
            title="Ordering Provider"
          >
            {orderingProvider ? (
              <>
                <Typography variant="body2">{commaFormattedName(orderingProvider)}</Typography>
                {orderingProvider.npi && <Typography variant="body2">NPI: {orderingProvider.npi}</Typography>}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Add ordering provider for this service line
              </Typography>
            )}
          </TooltipContent>
        }
      >
        <IconButton
          size="small"
          onClick={onProviderClick}
          aria-label="Ordering provider"
          sx={{ p: 0.25, color: orderingProvider ? 'primary.main' : 'grey.500' }}
        >
          <DoctorIcon sx={{ fontSize: 24 }} />
        </IconButton>
      </RichTooltip>
    </>
  );
}
