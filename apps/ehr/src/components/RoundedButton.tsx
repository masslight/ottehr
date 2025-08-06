import { LoadingButton } from '@mui/lab';
import { ButtonProps, styled } from '@mui/material';
import { Link } from 'react-router-dom';

export const RoundedButton = styled(
  (
    props: ButtonProps & { to?: string; target?: '_self' | '_blank' | '_parent' | '_top' | string; loading?: boolean }
  ) => (
    <LoadingButton
      variant="outlined"
      size="large"
      {...props}
      {...(props.to ? { component: Link, to: props.to, target: props.target } : {})}
    />
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
  textTransform: 'none',
  fontWeight: 500,
  fontSize: 14,
}));
