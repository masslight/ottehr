import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { ProceduresForm } from './ProceduresForm';

export const SurgicalHistoryProviderColumn: FC = () => {
  const { chartData } = useChartData();
  const procedures = chartData?.surgicalHistory || [];
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
        </Box>
      )}
    </Box>
  );
};
