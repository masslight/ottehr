import { Button } from '@mui/material';
import { Box } from '@mui/system';
import React, { useCallback } from 'react';
import { VisitStatusLabel } from 'utils';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useReactNavigationBlocker } from '../hooks/useReactNavigationBlocker';
import { AbnormalVitalsContent } from './vitals/components/AbnormalVitalsContent';
import { useGetAbnormalVitals } from './vitals/hooks/useGetVitals';

export const CompleteIntakeButton: React.FC<{
  isDisabled: boolean;
  handleCompleteIntake: () => void | Promise<void>;
  status: VisitStatusLabel | undefined;
}> = ({ isDisabled, handleCompleteIntake, status }) => {
  const { hasAny } = useGetAbnormalVitals();

  const shouldBlock = useCallback(() => hasAny, [hasAny]);

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

        <ConfirmationModal ContentComponent={<AbnormalVitalsContent />} />
      </Box>
    </GenericToolTip>
  );
};
