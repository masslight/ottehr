import { FC } from 'react';
import { Button } from '@mui/material';

interface ShowMoreButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const ShowMoreButton: FC<ShowMoreButtonProps> = ({ isOpen, onClick }) => {
  return (
    <Button onClick={onClick} sx={{ p: 0 }}>
      {isOpen ? 'Hide' : 'Show more'}
    </Button>
  );
};

export default ShowMoreButton;
