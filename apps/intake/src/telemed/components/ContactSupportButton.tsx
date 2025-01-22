import { Button, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface ContactSupportButtonProps {
  onClick: () => void;
}

export const ContactSupportButton = ({ onClick }: ContactSupportButtonProps): JSX.Element => {
  return (
    <Button
      aria-label="Help button"
      color="primary"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        backgroundColor: 'white',
        '&:hover': {
          backgroundColor: 'white',
        },
        borderRadius: '100px',
        px: 2,
        py: 1,
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
      }}
      onClick={onClick}
    >
      <HelpOutlineIcon fontSize="small" />
      <Typography variant="body2">Support</Typography>
    </Button>
  );
};
