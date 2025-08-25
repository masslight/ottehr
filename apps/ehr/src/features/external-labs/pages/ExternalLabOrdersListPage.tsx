import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AiSuggestion from 'src/components/AiSuggestion';
import { AiObservationField, getSelectors, ObservationTextFieldDTO } from 'utils';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import ListViewContainer from '../../common/ListViewContainer';
import { ButtonRounded } from '../../css-module/components/RoundedButton';
import { LabsTable, LabsTableColumn } from '../components/labs-orders/LabsTable';

const externalLabsColumns: LabsTableColumn[] = [
  'testType',
  'dx',
  'ordered',
  'status',
  'requisitionNumber',
  'detail',
  'actions',
];

export const ExternalLabOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const encounterId = useAppointmentStore((state) => state.encounter?.id);
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

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
          </Stack>
        </Box>
        <LabsTable
          searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
          columns={externalLabsColumns}
          showFilters={false}
          allowDelete={true}
          allowSubmit={true}
          onCreateOrder={handleCreateOrder}
        />
        {aiExternalLabs?.length > 0 && (
          <>
            <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
            <AiSuggestion title={'Labs'} chartData={chartData} content={aiExternalLabs} />
          </>
        )}
      </Box>
    </ListViewContainer>
  );
};
