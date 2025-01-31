import { GenericToolTip } from '../../../components/GenericToolTip';
import { Box } from '@mui/system';
import { Button } from '@mui/material';
import { VisitStatusLabel } from 'utils';

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
