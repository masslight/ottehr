import { Box, Paper, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { AiObservationField, LabsTableColumn, ObservationTextFieldDTO } from 'utils';
import ListViewContainer from '../../common/ListViewContainer';
import { ButtonRounded } from '../../visits/in-person/components/RoundedButton';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { LabsTablePatientChart } from '../components/labs-orders/LabsTablePatientChart';

const externalLabsColumns: LabsTableColumn[] = [
  'testType',
  'dx',
  'ordered',
  'requisitionNumber',
  'status',
  'detail',
  'actions',
];

export const ExternalLabOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { chartData } = useChartData();

  const handleCreateOrder = useCallback((): void => {
    navigate(`create`);
  }, [navigate]);

  const aiExternalLabs = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.Labs
  ) as ObservationTextFieldDTO[];

  if (!encounterId) {
    console.error('No encounter ID found');
    return null;
  }

  return (
    <ListViewContainer>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <PageTitle label="External Labs" showIntakeNotesButton={false} />
          <Stack direction="row" spacing={2} alignItems="center">
            {!isReadOnly && (
              <ButtonRounded
                variant="contained"
                color="primary"
                size={'medium'}
                onClick={() => handleCreateOrder()}
                sx={{
                  py: 1,
                  px: 5,
                  textWrap: 'nowrap',
                }}
              >
                + External Lab
              </ButtonRounded>
            )}
          </Stack>
        </Box>
        {aiExternalLabs?.length > 0 && (
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            {/* <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} /> */}
            <AiSuggestion title={'Labs'} chartData={chartData} content={aiExternalLabs} />
          </Paper>
        )}
        <LabsTablePatientChart
          searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
          columns={externalLabsColumns}
          allowDelete={!isReadOnly}
          allowSubmit={!isReadOnly}
          onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
        />
      </Box>
    </ListViewContainer>
  );
};
