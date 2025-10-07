import { Button } from '@mui/material';
import { Box } from '@mui/system';
import React, { useCallback, useMemo } from 'react';
import { VisitStatusLabel } from 'utils';
import { GenericToolTip } from '../../../../components/GenericToolTip';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { AbnormalVitalsContent } from '../../shared/components/vitals/components/AbnormalVitalsContent';
import { useGetAbnormalVitals } from '../../shared/components/vitals/hooks/useGetVitals';
import { useReactNavigationBlocker } from '../../shared/hooks/useReactNavigationBlocker';

export const CompleteIntakeButton: React.FC<{
  isDisabled: boolean;
  handleCompleteIntake: () => void | Promise<void>;
  status: VisitStatusLabel | undefined;
}> = ({ isDisabled, handleCompleteIntake, status }) => {
  const abnormalVitals = useGetAbnormalVitals();

  const hasAny = useMemo(
    () =>
      abnormalVitals ? Object.values(abnormalVitals).some((list) => Array.isArray(list) && list.length > 0) : false,
    [abnormalVitals]
  );

  const shouldBlock = useCallback(() => hasAny, [hasAny]);

  const { ConfirmationModal, requestConfirmation } = useReactNavigationBlocker(
    shouldBlock,
    'You have entered an abnormal value. Please verify:',
    { interceptNavigation: false }
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

        <ConfirmationModal
          title="Abnormal Vital Value"
          confirmText="Back"
          closeButtonText="Continue"
          ContentComponent={<AbnormalVitalsContent />}
        />
      </Box>
    </GenericToolTip>
  );
};
