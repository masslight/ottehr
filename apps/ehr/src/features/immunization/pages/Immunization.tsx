import AddIcon from '@mui/icons-material/Add';
import { Stack } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { ROUTER_PATH } from 'src/features/css-module/routing/routesCSS';
import { PageTitle } from 'src/telemed/components/PageTitle';

export const Immunization: React.FC = () => {
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();

  const onNewOrderClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.IMMUNIZATION_NEW_ORDER}`);
  };
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Immunization" showIntakeNotesButton={false} />
        <RoundedButton variant="contained" onClick={onNewOrderClick} startIcon={<AddIcon />}>
          New Order
        </RoundedButton>
      </Stack>
    </Stack>
  );
};
