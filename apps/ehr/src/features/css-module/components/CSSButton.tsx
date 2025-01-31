import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { useTheme } from '@mui/material';
import { IconButtonContained } from '../../../telemed';
import { useCSSPermissions } from '../hooks/useCSSPermissions';
import { dataTestIds } from '../../../constants/data-test-ids';

export const CSSButton: React.FC<{
  isDisabled: boolean;
  handleCSSButton: (e: React.MouseEvent) => void;
  appointmentID: string;
}> = ({ isDisabled, handleCSSButton, appointmentID }) => {
  const theme = useTheme();

  const { view } = useCSSPermissions();

  if (!view) {
    return null;
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    handleCSSButton(e);
  };

  return (
    <IconButtonContained
      data-testid={dataTestIds.dashboard.intakeButton(appointmentID ?? undefined)}
      sx={{
        width: 'auto',
      }}
      variant="primary"
      onClick={handleClick}
      disabled={isDisabled}
    >
      <PersonSearchIcon sx={{ color: theme.palette.primary.contrastText }} />
    </IconButtonContained>
  );
};
