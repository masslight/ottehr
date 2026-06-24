import { Box, Typography } from '@mui/material';
import { JSX, ReactNode } from 'react';
import { VitalsUnitInputOrder } from 'utils';

interface VitalsUnitInputRowProps {
  /** Admin-configured order in which the metric/imperial inputs are rendered. */
  order: VitalsUnitInputOrder;
  /** The metric unit input(s) (e.g. kg, cm, °C). */
  metricInput: ReactNode;
  /** The imperial unit input(s) (e.g. lbs, ft/in, °F). */
  imperialInput: ReactNode;
}

/**
 * Renders the metric and imperial vital inputs in the admin-configured order, separated by "≈".
 *
 * The order is applied via DOM order (not `flex-direction: row-reverse`) so that the visual order,
 * keyboard tab order, and screen-reader order all match the configured order.
 */
export function VitalsUnitInputRow({ order, metricInput, imperialInput }: VitalsUnitInputRowProps): JSX.Element {
  const metricFirst = order === 'metric-imperial';
  const first = metricFirst ? metricInput : imperialInput;
  const second = metricFirst ? imperialInput : metricInput;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {first}
      <Typography fontSize={25}>≈</Typography>
      {second}
    </Box>
  );
}
