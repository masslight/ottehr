import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { IconButton } from '@mui/material';

interface QuestionMarkButtonProps {
  onClick: () => void;
}

export const QuestionMarkButton = ({ onClick }: QuestionMarkButtonProps): JSX.Element => {
  return (
    <IconButton
      aria-label="Help button"
      color="primary"
      sx={{
        backgroundColor: 'white',
        '&:hover': {
          backgroundColor: 'white',
        },
      }}
      onClick={onClick}
    >
      <HelpOutlineIcon />
    </IconButton>
  );
};
export default QuestionMarkButton;
