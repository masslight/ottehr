import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { IconButtonContained } from '../../../telemed';
import { useCSSPermissions } from '../hooks/useCSSPermissions';
import { dataTestIds } from '../../../constants/data-test-ids';
import { practitionerType } from '../../../helpers/practitionerUtils';
import { usePractitionerActions } from '../hooks/usePractitioner';

export const CSSButton = ({ appointmentID }: { appointmentID: string }): React.ReactElement | null => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isPractitionerLoading, handleButtonClick } = usePractitionerActions(
    appointmentID,
    'start',
    practitionerType.Admitter,
    true,
    'intake'
  );

  const { view } = useCSSPermissions();

  if (!view) {
    return null;
  }

  return (
    <IconButtonContained
      data-testid={dataTestIds.dashboard.intakeButton(appointmentID ?? undefined)}
      sx={{
        width: 'auto',
      }}
      variant="primary"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await handleButtonClick();
          navigate(`/in-person/${appointmentID}/patient-info`);
        } catch (error) {
          console.error(error);
        }
      }}
      disabled={isPractitionerLoading}
    >
      <PersonSearchIcon sx={{ color: theme.palette.primary.contrastText }} />
    </IconButtonContained>
  );
};
