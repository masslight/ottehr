import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { RadiologyOrderCreateButton } from '../components/RadiologyOrderCreateButton';
import { RadiologyTable, RadiologyTableColumn } from '../components/RadiologyTable';

export const radiologyOrderListColumns: RadiologyTableColumn[] = [
  'studyType',
  'studyName',
  'dx',
  'ordered',
  'stat',
  'status',
  'actions',
];

export const RadiologyOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const handleCreateOrder = useCallback((): void => {
    navigate('create');
  }, [navigate]);

  const handleCreateExternalOrder = useCallback((): void => {
    navigate('create-external');
  }, [navigate]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PageTitle label="Radiology" showIntakeNotesButton={false} dataTestId={dataTestIds.radiologyPage.title} />
        <Stack direction="row" spacing={2} alignItems="center">
          {!isReadOnly && (
            <RadiologyOrderCreateButton
              onCreateOrder={handleCreateOrder}
              onCreateExternalOrder={handleCreateExternalOrder}
            />
          )}
        </Stack>
      </Box>
      <RadiologyTable
        encounterId={encounterId}
        columns={radiologyOrderListColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
      />
    </Stack>
  );
};
