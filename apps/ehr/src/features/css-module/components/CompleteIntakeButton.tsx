import { Button } from '@mui/material';
import { Box } from '@mui/system';
import { useMemo } from 'react';
import { useAppointmentData } from 'src/telemed';
import { GetVitalsResponseData, VisitStatusLabel, VitalsObservationDTO } from 'utils';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useGetVitals } from './vitals/hooks/useGetVitals';

export function getAbnormalVitals(encounterVitals?: GetVitalsResponseData): GetVitalsResponseData {
  if (!encounterVitals) return {} as GetVitalsResponseData;

  const entries = Object.entries(encounterVitals)
    .map(([key, values]) => {
      if (Array.isArray(values)) {
        const filtered = (values as VitalsObservationDTO[]).filter((v) => !!v.alertCriticality);
        return [key, filtered];
      }
      return [key, []];
    })
    .filter(([, values]) => (values as VitalsObservationDTO[]).length > 0);

  return Object.fromEntries(entries) as GetVitalsResponseData;
}

export const CompleteIntakeButton: React.FC<{
  isDisabled: boolean;
  handleCompleteIntake: () => void;
  status: VisitStatusLabel | undefined;
}> = ({ isDisabled, handleCompleteIntake, status }) => {
  const {
    resources: { encounter },
  } = useAppointmentData();

  const { data: encounterVitals } = useGetVitals(encounter?.id);

  const abnormalVitalsValues: GetVitalsResponseData = useMemo(
    () => getAbnormalVitals(encounterVitals),
    [encounterVitals]
  );

  console.log('abnormalVitalsValues', abnormalVitalsValues);
  return (
    <GenericToolTip
      title={status !== 'intake' ? 'Only available in Intake status' : null}
      sx={{
        width: '120px',
        textAlign: 'center',
      }}
      placement="top"
    >
      <Box
        sx={{
          alignSelf: 'center',
        }}
      >
        <Button
          data-testid={dataTestIds.sideMenu.completeIntakeButton}
          variant="contained"
          sx={{
            alignSelf: 'center',
            borderRadius: '20px',
            textTransform: 'none',
          }}
          onClick={handleCompleteIntake}
          disabled={isDisabled}
        >
          Complete Intake
        </Button>
      </Box>
    </GenericToolTip>
  );
};
