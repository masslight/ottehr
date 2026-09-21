import { styled, Tooltip, tooltipClasses, TooltipProps } from '@mui/material';

// Rich hover panel (light card look) for report widgets — same visual language as the EHR
// tracking board's GenericToolTip.
export const RichTooltip = styled(
  ({ className, customWidth, ...props }: TooltipProps & { customWidth?: number | string }) => (
    <Tooltip
      enterTouchDelay={0}
      placement="top"
      classes={{ popper: className }}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: customWidth ?? 400,
            backgroundColor: '#F9FAFB',
            color: '#000000',
            border: '1px solid #dadde9',
          },
        },
      }}
      {...props}
    />
  )
)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    boxShadow: theme.shadows[1],
    fontSize: theme.typography.pxToRem(12),
  },
}));
