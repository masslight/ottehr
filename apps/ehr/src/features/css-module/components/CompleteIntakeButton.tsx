import { Button } from '@mui/material';
import { Box } from '@mui/system';
import React, { useCallback, useMemo } from 'react';
import { useAppointmentData } from 'src/telemed';
import { getAbnormalVitals, VisitStatusLabel } from 'utils';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useReactNavigationBlocker } from '../hooks/useReactNavigationBlocker';
import { AbnormalVitalsContent, hasAbnormalVitals } from './vitals/components/AbnormalVitalsContent';
import { useGetVitals } from './vitals/hooks/useGetVitals';

export const CompleteIntakeButton: React.FC<{
  isDisabled: boolean;
  handleCompleteIntake: () => void | Promise<void>;
  status: VisitStatusLabel | undefined;
}> = ({ isDisabled, handleCompleteIntake, status }) => {
  const {
    resources: { encounter },
  } = useAppointmentData();

  const { data: encounterVitals } = useGetVitals(encounter?.id);

  const abnormalVitalsValues = useMemo(() => getAbnormalVitals(encounterVitals), [encounterVitals]);

  const shouldBlock = useCallback(() => hasAbnormalVitals(abnormalVitalsValues), [abnormalVitalsValues]);

  const { ConfirmationModal, requestConfirmation } = useReactNavigationBlocker(
    shouldBlock,
    'You have entered an abnormal value. Please verify:',
    {
      interceptNavigation: false,
      confirmText: 'Back',
      closeButtonText: 'Continue',
      title: 'Abnormal Vital Value',
    }
  );

  const onClick = useCallback(async () => {
    if (isDisabled) return;
    const canProceed = await requestConfirmation();
    if (!canProceed) return; // user pressed Back
    await handleCompleteIntake();
  }, [isDisabled, requestConfirmation, handleCompleteIntake]);

  return (
    <GenericToolTip
      title={status !== 'intake' ? 'Only available in Intake status' : null}
      sx={{ width: '120px', textAlign: 'center' }}
      placement="top"
    >
      <Box sx={{ alignSelf: 'center' }}>
        <Button
          data-testid={dataTestIds.sideMenu.completeIntakeButton}
          variant="contained"
          sx={{ alignSelf: 'center', borderRadius: '20px', textTransform: 'none' }}
          onClick={onClick}
          disabled={isDisabled}
        >
          Complete Intake
        </Button>

        <ConfirmationModal ContentComponent={<AbnormalVitalsContent vals={abnormalVitalsValues} />} />
      </Box>
    </GenericToolTip>
  );
};
