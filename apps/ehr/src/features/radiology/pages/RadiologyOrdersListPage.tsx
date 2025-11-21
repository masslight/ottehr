import { Box, Button, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { RadiologyTable, RadiologyTableColumn } from '../components/RadiologyTable';

const radiologyColumns: RadiologyTableColumn[] = ['studyType', 'dx', 'ordered', 'stat', 'status', 'actions'];

export const RadiologyOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const handleCreateOrder = useCallback((): void => {
    navigate('create');
  }, [navigate]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PageTitle label="Radiology" showIntakeNotesButton={false} />
        <Stack direction="row" spacing={2} alignItems="center">
          {!isReadOnly && (
            <Button
              onClick={handleCreateOrder}
              variant="contained"
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
                width: 120,
              }}
            >
              Order
            </Button>
          )}
        </Stack>
      </Box>
      <RadiologyTable
        encounterId={encounterId}
        columns={radiologyColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
      />
    </Stack>
  );
};
