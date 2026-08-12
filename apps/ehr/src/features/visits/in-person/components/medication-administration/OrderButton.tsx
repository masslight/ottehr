import { SxProps, Tooltip } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getNewMedicationOrderUrl } from '../../routing/helpers';
import { ButtonRounded } from '../RoundedButton';

interface OrderButtonProps {
  size?: 'medium' | 'large';
  sx?: SxProps;
  dataTestId?: string;
}

export const OrderButton: React.FC<OrderButtonProps> = ({ size = 'medium', sx, dataTestId }) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  // Ordering in-house medications is NPI-gated — a user without an NPI (e.g. the Clinician role) can
  // still administer existing orders, but cannot create new ones.
  const hasNPI = useEvolveUser()?.hasNPI ?? false;

  const onClick = (): void => {
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate(getNewMedicationOrderUrl(appointmentId));
  };

  return (
    <Tooltip title={hasNPI ? '' : 'You need an NPI on file to order in-house medications'}>
      <span>
        <ButtonRounded
          variant="contained"
          color="primary"
          size={size}
          disabled={!hasNPI}
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
      </span>
    </Tooltip>
  );
};
