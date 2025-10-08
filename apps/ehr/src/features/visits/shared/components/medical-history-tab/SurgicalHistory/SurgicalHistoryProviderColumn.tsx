import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { useAppFlags } from '../../../stores/contexts/useAppFlags';
import { ProceduresForm } from './ProceduresForm';
import { ProceduresNoteField, ProceduresNoteFieldSkeleton } from './ProceduresNoteField';

export const SurgicalHistoryProviderColumn: FC = () => {
  const { chartData, isLoading: isChartDataLoading } = useChartData();
  const procedures = chartData?.surgicalHistory || [];
  const featureFlags = useAppFlags();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isReadOnly ? (
        <>
          <ActionsList
            data={procedures}
            getKey={(value) => value.resourceId!}
            renderItem={(value) => (
              <Typography>
                {value.code} {value.display}
              </Typography>
            )}
            divider
          />
          {!featureFlags.isInPerson && <ProceduresNoteField />}
        </>
      ) : (
        <Box
          data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <ProceduresForm />
          {isChartDataLoading ? <ProceduresNoteFieldSkeleton /> : !featureFlags.isInPerson && <ProceduresNoteField />}
        </Box>
      )}
    </Box>
  );
};
