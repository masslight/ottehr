import React, { FC, ReactNode } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { otherColors } from '../../CustomThemeProvider';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { PropsWithChildren } from '../../shared/types';

type AccordionCardProps = PropsWithChildren<{
  collapsed?: boolean;
  onSwitch?: () => void;
  label: string;
  headerItem?: ReactNode;
}>;

export const AccordionCard: FC<AccordionCardProps> = (props) => {
  const { collapsed, onSwitch, label, children, headerItem } = props;

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
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backgroundColor: otherColors.apptHover,
          py: 0.5,
          px: 2,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexGrow: 1,
          }}
        >
          {collapsed !== undefined && onSwitch && (
            <IconButton onClick={onSwitch} sx={{ p: 0 }}>
              <ArrowDropDownCircleOutlinedIcon
                fontSize="small"
                sx={{
                  color: theme.palette.primary.main,
                  rotate: collapsed ? '' : '180deg',
                }}
              ></ArrowDropDownCircleOutlinedIcon>
            </IconButton>
          )}
          <Typography variant="h6" color={theme.palette.primary.dark}>
            {label}
          </Typography>
        </Box>

        {headerItem}
      </Box>
      {!collapsed && (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};
