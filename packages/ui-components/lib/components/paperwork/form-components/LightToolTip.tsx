import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';

export const LightToolTip = styled(
  ({ className, ...props }: TooltipProps & { backgroundColor: string; color: string }) => (
    <Tooltip {...props} classes={{ popper: className }} />
  )
)(({ backgroundColor, color }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: backgroundColor,
    color: color,
    boxShadow:
      '0px 1px 8px 0px rgba(0, 0, 0, 0.12), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 3px 3px -2px rgba(0, 0, 0, 0.2);',
    fontSize: 14,
    fontWeight: 400,
  },
}));
