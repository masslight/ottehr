import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { IconButton } from '@mui/material';
import { Link } from 'react-router-dom';

interface QuestionMarkButtonProps {
  url: string; // clicking the component redirects the user here
}

export const QuestionMarkButton = ({ url }: QuestionMarkButtonProps): JSX.Element => {
  return (
    <Link to={url} aria-label="Ottehr website" target="_blank">
      <IconButton
        aria-label="Help button"
        color="primary"
        sx={{
          backgroundColor: 'white',
          '&:hover': {
            backgroundColor: 'white',
          },
        }}
      >
        <HelpOutlineIcon />
      </IconButton>
    </Link>
  );
};
