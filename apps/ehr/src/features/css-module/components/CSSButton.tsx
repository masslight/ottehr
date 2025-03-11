import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { CircularProgress, useTheme } from '@mui/material';
import { IconButtonContained } from '../../../telemed';
import { useCSSPermissions } from '../hooks/useCSSPermissions';
import { dataTestIds } from '../../../constants/data-test-ids';

export const CSSButton: React.FC<{
  isDisabled: boolean;
  isLoading: boolean;
  handleCSSButton: (e: React.MouseEvent) => void;
}> = ({ isDisabled, isLoading, handleCSSButton }) => {
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
      data-testid={dataTestIds.dashboard.intakeButton}
      sx={{
        width: 'auto',
      }}
      variant={isLoading ? 'loading' : 'primary'}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {isLoading ? (
        <CircularProgress sx={{ color: theme.palette.primary.contrastText }} size={24} />
      ) : (
        <PersonSearchIcon sx={{ color: theme.palette.primary.contrastText }} />
      )}
    </IconButtonContained>
  );
};
