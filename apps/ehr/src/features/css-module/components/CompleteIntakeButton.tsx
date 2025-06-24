import { Button } from '@mui/material';
import { Box } from '@mui/system';
import { VisitStatusLabel } from 'utils';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { dataTestIds } from '../../../constants/data-test-ids';

export const CompleteIntakeButton: React.FC<{
  isDisabled: boolean;
  handleCompleteIntake: () => void;
  status: VisitStatusLabel | undefined;
}> = ({ isDisabled, handleCompleteIntake, status }) => {
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
