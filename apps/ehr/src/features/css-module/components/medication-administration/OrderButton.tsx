import React from 'react';
import { ButtonRounded } from '../RoundedButton';
import { useNavigate, useParams } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';
import { getNewOrderUrl } from '../../routing/helpers';
import { SxProps } from '@mui/material';

interface OrderButtonProps {
  size?: 'medium' | 'large';
  sx?: SxProps;
  dataTestId?: string;
}

export const OrderButton: React.FC<OrderButtonProps> = ({ size = 'large', sx, dataTestId }) => {
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
    <ButtonRounded variant="contained" color="primary" size={size} onClick={onClick} sx={sx} data-testid={dataTestId}>
      Order
    </ButtonRounded>
  );
};
