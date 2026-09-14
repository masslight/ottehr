import { Box, IconButton, styled, Tooltip, tooltipClasses, TooltipProps, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { CapsuleIcon } from './CapsuleIcon';
import { DoctorIcon } from './DoctorIcon';

interface IndicatorDrug {
  ndc: string;
  quantity: string | number;
  units: string;
}

interface IndicatorProvider {
  name: string;
  npi?: string;
  taxonomy?: string;
}

interface ServiceLineIndicatorsProps {
  drug: IndicatorDrug | null;
  orderingProvider: IndicatorProvider | null;
  onDrugClick: () => void;
  onProviderClick: () => void;
}

/** Light card-style tooltip matching the EHR tracking board's GenericToolTip. */
const RichTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip enterTouchDelay={0} placement="top-start" classes={{ popper: className }} {...props} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 300,
    backgroundColor: '#F9FAFB',
    color: '#000000',
    border: '1px solid #dadde9',
    boxShadow: theme.shadows[1],
  },
}));

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
        title={
          <TooltipContent
            icon={<CapsuleIcon sx={{ fontSize: 18, color: drug ? 'primary.main' : 'grey.500' }} />}
            title="Medication"
          >
            {drug ? (
              <>
                <Typography variant="body2">NDC: {drug.ndc}</Typography>
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
        title={
          <TooltipContent
            icon={<DoctorIcon sx={{ fontSize: 18, color: orderingProvider ? 'primary.main' : 'grey.500' }} />}
            title="Ordering Provider"
          >
            {orderingProvider ? (
              <>
                <Typography variant="body2">{orderingProvider.name}</Typography>
                {orderingProvider.npi && <Typography variant="body2">NPI: {orderingProvider.npi}</Typography>}
                {orderingProvider.taxonomy && (
                  <Typography variant="body2">Taxonomy: {orderingProvider.taxonomy}</Typography>
                )}
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
