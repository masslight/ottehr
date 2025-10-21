import { SxProps } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNewOrderUrl } from '../../routing/helpers';
import { ButtonRounded } from '../RoundedButton';

interface OrderButtonProps {
  size?: 'medium' | 'large';
  sx?: SxProps;
  dataTestId?: string;
}

export const OrderButton: React.FC<OrderButtonProps> = ({ size = 'medium', sx, dataTestId }) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();

  const onClick = (): void => {
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate(getNewOrderUrl(appointmentId));
  };

  return (
    <ButtonRounded
      variant="contained"
      color="primary"
      size={size}
      onClick={onClick}
      sx={{
        py: 1,
        px: 5,
        ...sx,
      }}
      data-testid={dataTestId}
    >
      Order
    </ButtonRounded>
  );
};
