import { SxProps } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNewMedicationOrderUrl } from '../../routing/helpers';
import { ButtonRounded } from '../RoundedButton';

interface OrderButtonProps {
  size?: 'medium' | 'large';
  sx?: SxProps;
  dataTestId?: string;
  // Overrides the default navigation to the order-new page — used by the Review & Sign inline edit flow
  onClick?: () => void;
}

export const OrderButton: React.FC<OrderButtonProps> = ({ size = 'medium', sx, dataTestId, onClick: onClickProp }) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();

  const onClick = (): void => {
    if (onClickProp) {
      onClickProp();
      return;
    }
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate(getNewMedicationOrderUrl(appointmentId));
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
