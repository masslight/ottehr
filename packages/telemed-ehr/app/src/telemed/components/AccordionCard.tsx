import React, { FC } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { otherColors } from '../../CustomThemeProvider';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { PropsWithChildren } from '../../shared/types';

type AccordionCardProps = PropsWithChildren<{
  collapsed?: boolean;
  onSwitch?: () => void;
  label: string;
}>;

export const AccordionCard: FC<AccordionCardProps> = (props) => {
  const { collapsed, onSwitch, label, children } = props;

  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: otherColors.solidLine,
        border: `1px solid ${otherColors.solidLine}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: otherColors.apptHover, p: 2 }}>
        {collapsed !== undefined && onSwitch && (
          <IconButton onClick={onSwitch} sx={{ p: 0 }}>
            <ArrowDropDownCircleOutlinedIcon
              sx={{
                color: theme.palette.primary.main,
                rotate: collapsed ? '' : '180deg',
              }}
            ></ArrowDropDownCircleOutlinedIcon>
          </IconButton>
        )}
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {label}
        </Typography>
      </Box>
      {!collapsed && <Box sx={{ backgroundColor: theme.palette.background.paper }}>{children}</Box>}
    </Box>
  );
};
