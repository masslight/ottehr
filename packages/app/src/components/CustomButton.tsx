import { Button, SxProps, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';

interface CustomButtonProps {
  children: ReactNode;
  disabled?: boolean;
  fitContent?: boolean;
  icon?: ReactNode;
  onClick?: () => any;
  secondary?: boolean;
  submit?: boolean;
  sx?: SxProps;
}
export const CustomButton: FC<CustomButtonProps> = ({
  children,
  fitContent,
  icon,
  onClick,
  secondary,
  submit,
  sx,
  disabled,
}) => {
  const theme = useTheme();

  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      startIcon={icon}
      sx={{
        borderRadius: '4px',
        color: secondary ? theme.palette.primary.light : theme.palette.background.default,
        cursor: 'pointer',
        mt: 2,
        textAlign: 'center',
        textTransform: 'uppercase',
        width: fitContent ? 'fit-content' : '100%',
        ...sx,
      }}
      type={submit ? 'submit' : undefined}
      variant={secondary ? 'outlined' : 'contained'}
    >
      {children}
    </Button>
  );
};
