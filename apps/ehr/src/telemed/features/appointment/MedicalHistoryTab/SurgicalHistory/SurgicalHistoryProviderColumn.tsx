import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { ActionsList } from '../../../../components';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';
import { ProceduresForm } from './ProceduresForm';
import { ProceduresNoteField, ProceduresNoteFieldSkeleton } from './ProceduresNoteField';

export const SurgicalHistoryProviderColumn: FC = () => {
  const { isChartDataLoading, chartData } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'chartData']);

  const procedures = chartData?.surgicalHistory || [];

  const cssColumnFeatureFlag = useFeatureFlags();

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isReadOnly ? (
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
      ) : (
        <Box data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn}>
          <ProceduresForm />
          {isChartDataLoading ? <ProceduresNoteFieldSkeleton /> : !cssColumnFeatureFlag.css && <ProceduresNoteField />}
        </Box>
      )}
    </Box>
  );
};
