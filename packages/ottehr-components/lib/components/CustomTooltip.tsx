import { styled, Tooltip, tooltipClasses, TooltipProps } from '@mui/material';

export const CustomTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#F9FAFB',
    color: '#000000',
    boxShadow: `
    0px 1px 8px 0px rgba(0, 0, 0, 0.12),
    0px 3px 4px 0px rgba(0, 0, 0, 0.14),
    0px 3px 3px -2px rgba(0, 0, 0, 0.20)
  `,
    maxWidth: 350,
    padding: 5,
    fontSize: theme.typography.pxToRem(16),
    border: '1px solid #dadde9',
  },
  [`& .${tooltipClasses.arrow}`]: {
    backgroundColor: '#F9FAFB',
    boxShadow: `
    0px 1px 8px 0px rgba(0, 0, 0, 0.12),
    0px 3px 4px 0px rgba(0, 0, 0, 0.14),
    0px 3px 3px -2px rgba(0, 0, 0, 0.20)
  `,
  },
}));
