import InfoIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip, TooltipProps, Typography } from '@mui/material';
import { Box } from '@mui/system';

export const DEFAULT_TOOLTIP_PROPS: Omit<TooltipProps, 'children' | 'title'> = {
  placement: 'top',
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5_000,
};

const CPT_TOOLTIP_CONTENT = (
  <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
    {`CPT copyright 2024 American Medical Association. All rights reserved.

Fee schedules, relative value units, conversion factors and/or related components are not assigned by the AMA, are not part of CPT, and the AMA is not recommending their use. The AMA does not directly or indirectly practice medicine or dispense medical services. The AMA assumes no liability for data contained or not contained herein.

CPT is a registered trademark of the American Medical Association.`}
  </Box>
);

const CPT_TOOLTIP_ICON = <InfoIcon sx={{ fontSize: 16, color: 'inherit', cursor: 'pointer' }} />;

export const CPT_TOOLTIP_PROPS: Pick<TooltipProps, 'children' | 'title'> = {
  title: CPT_TOOLTIP_CONTENT,
  children: CPT_TOOLTIP_ICON,
};

export const TooltipWrapper: React.FC<{
  children: React.ReactNode;
  tooltipProps: Pick<TooltipProps, 'children' | 'title'> & Partial<Omit<TooltipProps, 'children' | 'title'>>;
}> = ({ children, tooltipProps }) => {
  return (
    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {children}
      <Tooltip {...DEFAULT_TOOLTIP_PROPS} {...tooltipProps} />
    </Typography>
  );
};
