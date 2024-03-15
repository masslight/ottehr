import React, { FC } from 'react';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { Box, SvgIconTypeMap, Typography, useTheme } from '@mui/material';
import { IconButtonContained } from './IconButtonContained';

export const IconButtonWithLabel: FC<{
  SvgIcon: OverridableComponent<SvgIconTypeMap> & { muiName: string };
  label: string;
}> = (props) => {
  const { SvgIcon, label } = props;
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', width: '71.25px' }}>
      <IconButtonContained variant="primary">
        <SvgIcon
          sx={{
            color: theme.palette.primary.contrastText,
            height: '20px',
            width: '20px',
          }}
        ></SvgIcon>
      </IconButtonContained>
      <Typography noWrap sx={{ fontSize: '12px', fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
  );
};
