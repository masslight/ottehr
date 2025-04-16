import { IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Link } from 'react-router-dom';
import { PROJECT_NAME } from 'utils';

interface QuestionMarkButtonProps {
  url: string; // clicking the component redirects the user here
}

export const QuestionMarkButton = ({ url }: QuestionMarkButtonProps): JSX.Element => {
  return (
    <Link to={url} aria-label={`${PROJECT_NAME} website`} target="_blank">
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
