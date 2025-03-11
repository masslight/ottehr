import React from 'react';
import { Button, ButtonProps, styled, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export const RoundedButton = styled(
  (props: ButtonProps & { to?: string; target?: '_self' | '_blank' | '_parent' | '_top' | string }) => (
    <Button
      variant="outlined"
      size="large"
      {...props}
      {...(props.to ? { component: Link, to: props.to, target: props.target } : {})}
    >
      <Typography
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {props.children}
      </Typography>
    </Button>
  )
)(() => ({
  whiteSpace: 'nowrap',
  minWidth: 'auto',
  borderRadius: 100,
  width: 'fit-content',
  root: {
    '&.Mui-disabled': {
      pointerEvents: 'auto',
    },
  },
}));
